// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context } from "hono";
import { z } from "zod";
import { sendEmail } from "../email-sender";
import { generateMessageId, getMailboxStub } from "../lib/email-helpers";
import { Folders } from "../../shared/folders";
import type { Env } from "../types";

const SendMailBody = z.object({
	to: z.string().email(),
	subject: z.string().min(1),
	html: z.string().min(1),
});

type RateLimitStub = { checkSendRateLimit: () => Promise<string | null> };

function timingSafeEqual(a: string, b: string): boolean {
	const aBytes = new TextEncoder().encode(a);
	const bBytes = new TextEncoder().encode(b);
	if (aBytes.length !== bBytes.length) return false;
	let result = 0;
	for (let i = 0; i < aBytes.length; i++) {
		result |= aBytes[i]! ^ bBytes[i]!;
	}
	return result === 0;
}

export async function handleSendMail(c: Context<{ Bindings: Env }>) {
	const configuredSecret = c.env.SENDMAIL_SECRET;
	if (!configuredSecret) {
		return c.json({ error: "Sendmail API is not configured" }, 503);
	}

	const secretKey = c.req.param("secretKey") ?? "";
	if (!timingSafeEqual(secretKey, configuredSecret)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const from = c.env.SENDMAIL_FROM.toLowerCase();
	const mailboxKey = `mailboxes/${from}.json`;
	if (!(await c.env.BUCKET.head(mailboxKey))) {
		return c.json({ error: `Sender mailbox not found: ${from}` }, 404);
	}

	let body: z.infer<typeof SendMailBody>;
	try {
		body = SendMailBody.parse(await c.req.json());
	} catch (e) {
		if (e instanceof z.ZodError) {
			return c.json({ error: "Invalid request body", details: e.flatten().fieldErrors }, 400);
		}
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	const { to, subject, html } = body;
	const toStr = to.toLowerCase();
	const fromDomain = from.split("@")[1];
	if (!fromDomain) {
		return c.json({ error: "Invalid sender address configuration" }, 500);
	}

	const stub = getMailboxStub(c.env, from);
	const rateLimitError = await (stub as unknown as RateLimitStub).checkSendRateLimit();
	if (rateLimitError) return c.json({ error: rateLimitError }, 429);

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);
	const sentAt = new Date().toISOString();

	await stub.createEmail(Folders.SENT, {
		id: messageId,
		subject,
		sender: from,
		recipient: toStr,
		cc: null,
		bcc: null,
		date: sentAt,
		body: html,
		in_reply_to: null,
		email_references: null,
		thread_id: messageId,
		message_id: outgoingMessageId,
		raw_headers: JSON.stringify([
			{ key: "from", value: from },
			{ key: "to", value: toStr },
			{ key: "subject", value: subject },
			{ key: "date", value: sentAt },
			{ key: "message-id", value: `<${outgoingMessageId}>` },
		]),
	}, []);

	c.executionCtx.waitUntil(
		sendEmail(c.env.EMAIL, {
			to: toStr,
			from,
			subject,
			html,
		}).catch((e) => console.error("Sendmail delivery failed:", (e as Error).message)),
	);

	return c.json({ id: messageId, status: "sent" }, 202);
}
