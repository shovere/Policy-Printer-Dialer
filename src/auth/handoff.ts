/**
 * Auto-login handoff (dialer side).
 *
 * The main EmberQA app mints a single-use code and opens the dialer at
 * dialer.policyprinter.io/?code=<code>. On boot we trade that code — via the
 * UNAUTHENTICATED /dialer-auth/v1/exchange endpoint — for a real EXTENSION JWT
 * pair, store it, and strip the code from the URL so a refresh / shared link
 * can't replay it (the backend's single-use consume is the real guard; this is
 * just hygiene).
 */

import axios from 'axios';
import {setSession, hasSession} from './session';

const DIALER_AUTH_BASE =
	import.meta.env.VITE_DIALER_AUTH_BASE ??
	`${import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'}/dialer-auth/v1`;

export type HandoffResult =
	| {status: 'authenticated'}
	| {status: 'exchanged'}
	| {status: 'no-code'}
	| {status: 'failed'; message: string};

/** Pull ?code= out of the current URL, then remove it from history. */
const takeCodeFromUrl = (): string | null => {
	const url = new URL(window.location.href);
	const code = url.searchParams.get('code');
	if (code) {
		url.searchParams.delete('code');
		window.history.replaceState({}, '', url.toString());
	}
	return code;
};

/**
 * Run once at app boot. If a ?code is present, exchange it (overriding any stale
 * session). Otherwise fall back to an existing stored session.
 */
export const runHandoff = async (): Promise<HandoffResult> => {
	const code = takeCodeFromUrl();

	if (!code) {
		return hasSession() ? {status: 'authenticated'} : {status: 'no-code'};
	}

	try {
		const res = await axios.post(`${DIALER_AUTH_BASE}/exchange`, {code});
		const data = res.data ?? {};
		if (!data.access_token || !data.refresh_token) {
			return {
				status: 'failed',
				message: data.statusMessage || 'Exchange returned no session'
			};
		}

		setSession({
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			user: {
				user_id: data.user_id,
				org_id: data.org_id,
				first_name: data.first_name,
				last_name: data.last_name
			}
		});
		return {status: 'exchanged'};
	} catch (err: any) {
		const message =
			err?.response?.data?.statusMessage ||
			err?.message ||
			'Failed to exchange handoff code';
		return {status: 'failed', message};
	}
};
