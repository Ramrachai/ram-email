<div align="center">

# Ram Email

**A $0 self-hosted email platform on Cloudflare — inbox, outbound mail, and a transactional REST API.**

Live at **[email.ramrachai.com](https://email.ramrachai.com)**

Forked and extended from [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox)

</div>

---

## Why I built this

Most developers pay monthly for Google Workspace, Zoho, or a transactional provider (SendGrid, Resend, Mailgun) just to own a few addresses on their domain and send OTP or contact-form emails from their apps.

**Ram Email replaces that stack with one project on Cloudflare's free tier:**

- **Receive** mail at any `@yourdomain.com` address you create
- **Send** from a full web inbox (compose, reply, forward, folders, search, attachments)
- **Send programmatically** from other apps (Next.js, scripts, backends) via a secured REST API
- **Scale addresses** — create as many mailboxes and custom addresses as you need, each with its own isolated inbox

No separate email SaaS bill. No vendor lock-in. You own the domain, the Worker, and the data path.

---

## What it does

| Capability | Description |
|------------|-------------|
| **Custom addresses** | Create mailboxes like `contact@`, `hello@`, `jobs@` on your domain |
| **Real inbox UI** | Modern React client — folders, threading, search, rich-text compose |
| **Inbound email** | Cloudflare Email Routing → Worker → per-mailbox Durable Object (SQLite) + R2 attachments |
| **Outbound email** | Cloudflare Email Service binding — send from your domain with proper deliverability |
| **Transactional API** | `POST /api/v1/sendmail` — call from your portfolio, auth flows, or any backend |
| **AI email agent** | Inherited from upstream — draft replies, search, MCP tools (optional) |
| **Production auth** | Cloudflare Access (OTP) protects the inbox; API uses Bearer token auth |

---

## Transactional email API

Use this from a **server-side** route only (never expose the secret in the browser).

```typescript
await fetch("https://email.ramrachai.com/api/v1/sendmail", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SENDMAIL_SECRET}`,
  },
  body: JSON.stringify({
    to: "user@example.com",
    subject: "Your verification code",
    html: "<p>Your code is <strong>482913</strong></p>",
  }),
});
```

**Response (`202`):**

```json
{ "id": "<message-id>", "status": "sent" }
```

| Field | Required | Notes |
|-------|----------|-------|
| `to` | Yes | Valid recipient email |
| `subject` | Yes | Subject line |
| `html` | Yes | HTML body — templates live in *your* app, not the Worker |

- **From address:** configured via `SENDMAIL_FROM` (e.g. `contact@ramrachai.com`)
- **Auth:** `Authorization: Bearer <SENDMAIL_SECRET>` (Worker secret)
- **Storage:** sent mail is recorded in the sender mailbox's **Sent** folder
- **Rate limits:** 20/hour, 100/day per mailbox

---

## How it benefits me

- **Portfolio & personal site** — contact forms, OTP, password reset, notifications without a paid email API
- **Professional identity** — real addresses on my domain (`contact@ramrachai.com`, etc.)
- **One platform** — same system for reading replies and sending transactional mail
- **Learning & ownership** — edge compute, Durable Objects, email routing, and API design in production
- **Cost** — built on Cloudflare Workers free tier; no monthly email SaaS subscription

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
  Inbound email     │           Cloudflare Worker             │
  (Email Routing)───┤  Hono API + React Router SSR            │
                    │                                         │
  Browser (inbox)───┤  /api/v1/*  ──► MailboxDO (SQLite)     │
                    │              └──► R2 (attachments)      │
  Next.js / API─────┤  POST /api/v1/sendmail ──► Email Service│
                    │                                         │
  AI / MCP ─────────┤  /agents/*  ──► EmailAgent + Workers AI │
                    └─────────────────────────────────────────┘
```

Each mailbox = one **Durable Object** with its own SQLite database. Attachments live in **R2**. Outbound mail uses the **Email Service** `send_email` binding.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router v7, Tailwind CSS, TanStack Query, TipTap, `@cloudflare/kumo` |
| Backend | Hono, Cloudflare Workers, Durable Objects, R2, Email Routing, Email Service |
| AI (optional) | Cloudflare Agents SDK, Workers AI, MCP at `/mcp` |
| Auth | Cloudflare Access (inbox) · Bearer token (sendmail API) |
| Deploy | Workers Builds · Git → `master` → production |

---

## Fork lineage

This project started from **[cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox)** — Cloudflare's reference email client with an AI agent.

**Custom work on top of upstream:**

- Transactional sendmail REST API (`/api/v1/sendmail`)
- Bearer-token auth and Cloudflare Access bypass for the API path
- `SENDMAIL_SECRET` / `SENDMAIL_FROM` configuration
- Sign-out flow via `/api/v1/auth/logout`
- Production deployment on `email.ramrachai.com` for `ramrachai.com`

---

## Getting started

### Prerequisites

- Cloudflare account + domain
- [Email Routing](https://developers.cloudflare.com/email-routing/) (receive)
- [Email Service](https://developers.cloudflare.com/email-service/) (send)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (protect inbox in production)

### Local development

```bash
git clone <your-repo>
cd ram-email
npm install
cp .dev.vars.example .dev.vars   # add SENDMAIL_SECRET, POLICY_AUD, TEAM_DOMAIN
npm run dev
```

Open `http://localhost:5173`

### Configure `wrangler.jsonc`

```jsonc
"vars": {
  "DOMAINS": "yourdomain.com",
  "SENDMAIL_FROM": "contact@yourdomain.com"
}
```

### Secrets (production)

```bash
npx wrangler secret put POLICY_AUD
npx wrangler secret put TEAM_DOMAIN
npx wrangler secret put SENDMAIL_SECRET
```

Also enable **Cloudflare Access** on the Worker (Settings → Domains & Routes) and set up **Email Routing** catch-all → this Worker.

### Deploy

```bash
npm run deploy
```

---

## Project structure

```
app/           React inbox UI (routes, components, queries)
workers/       Hono API, sendmail route, Durable Objects, email handler
shared/        Shared constants (folders, dates)
wrangler.jsonc Cloudflare bindings and environment
```

Key files:

- `workers/routes/sendmail.ts` — transactional email API
- `workers/app.ts` — Access JWT validation + SPA routing
- `workers/durableObject/` — mailbox storage (SQLite)
- `app/routes/home.tsx` — mailbox management UI

---

## Security model

| Surface | Protection |
|---------|------------|
| Inbox UI | Cloudflare Access (email OTP login) |
| Sendmail API | `Authorization: Bearer` + rate limits; no Access JWT required |
| Secrets | Worker secrets via `wrangler secret put` — survive Git deploys |

Never call `/api/v1/sendmail` from client-side code. Proxy through your backend (e.g. Next.js API route).

---

## Want this set up for your domain?

This repo is free and self-hosted — but the Cloudflare setup (Email Routing, Email Service, Access, secrets, custom domain, transactional API) takes time if you haven't done it before.

**I offer a paid setup service** to deploy the full **$0 self-hosted email stack** on your Cloudflare account and domain:

- Custom addresses and mailboxes (`contact@`, `hello@`, etc.)
- Inbound + outbound email on your domain
- Transactional REST API wired to your app (Next.js, portfolio, auth flows)
- Production hardening (Access, secrets, sendmail API)

**Interested?** Get in touch:

- **Email:** [contact@ramrachai.com](mailto:contact@ramrachai.com)
- **Web:** [ramrachai.com](https://ramrachai.com)

Tell me your domain and use case — I'll reply with scope and pricing.

---

## License

Apache 2.0 — inherited from [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox). See [LICENSE](LICENSE).
