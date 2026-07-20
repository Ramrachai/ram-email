// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * End the Cloudflare Access session and return to the app home page.
 * @see https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#log-out-as-a-user
 */
export function signOut(): void {
	const homeUrl = `${window.location.origin}/`;

	if (import.meta.env.DEV) {
		window.location.replace(homeUrl);
		return;
	}

	const redirect = encodeURIComponent(homeUrl);
	window.location.replace(`/cdn-cgi/access/logout?redirect=${redirect}`);
}
