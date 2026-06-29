/**
 * Axios layer for the EmberQA backend.
 *
 * The backend's auth gate expects the access+refresh JWTs in ONE header:
 *   Authorization: <access>,<refresh>
 * and, when it rotates the access token, returns the fresh one in the RESPONSE
 * BODY as `newAccessToken` (not a header). So we:
 *   - attach the combined Authorization header on every request, and
 *   - capture `newAccessToken` from every response body and store it.
 *
 * All authenticated endpoints are POSTs under VITE_API_BASE/api/v1/qualityscore
 * with an empty-ish JSON body (the backend reads authPayload server-side).
 */

import axios, {AxiosInstance} from 'axios';
import {
	getAccessToken,
	getRefreshToken,
	setAccessToken,
	clearSession
} from '@/auth/session';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export const api: AxiosInstance = axios.create({
	baseURL: `${API_BASE}/api/v1`
});

api.interceptors.request.use((config) => {
	const access = getAccessToken();
	const refresh = getRefreshToken();
	if (access && refresh) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `${access},${refresh}`;
	}
	return config;
});

api.interceptors.response.use(
	(response) => {
		// Rotate the access token in place when the backend issued a fresh one.
		const newAccessToken = response.data?.newAccessToken;
		if (typeof newAccessToken === 'string' && newAccessToken.length > 0) {
			setAccessToken(newAccessToken);
		}
		return response;
	},
	(error) => {
		// A 401 means both tokens are dead — the session is unrecoverable here
		// (no password login on the dialer). Clear it; the app routes back to the
		// "relaunch from main app" screen.
		if (error?.response?.status === 401) {
			clearSession();
		}
		return Promise.reject(error);
	}
);

/** POST a qualityscore endpoint (path relative to /api/v1/qualityscore). */
export const qsPost = async <T = any>(
	path: string,
	body: Record<string, unknown> = {}
): Promise<T> => {
	const res = await api.post(`/qualityscore${path}`, body);
	return res.data as T;
};

/** The caller's dialer profile (lazily created server-side). */
export const fetchDialerProfile = () =>
	qsPost('/policyPrinter/dialer/profile');

/* -------------------------------------------------------------------------- */
/* Presence / heartbeat / campaigns (Subplan 02)                              */
/* -------------------------------------------------------------------------- */

/** Toggled availability the agent controls. */
export type PresenceStatus = 'ready' | 'paused';

/** Twilio Device registration state the FE reports each heartbeat (Subplan 03
 *  wires the real value; until then the dialer reports 'offline'). */
export type TwilioDeviceStatus =
	| 'registered'
	| 'offline'
	| 'connecting'
	| 'error';

/** Live presence row mirrored from the backend. */
export interface DialerPresence {
	agent_id: string;
	org_id: string;
	user_id: string;
	status: PresenceStatus;
	selected_campaign_id: string | null;
	on_call: boolean;
	last_heartbeat_at: string | null;
	session_id: string | null;
	twilio_device_status: TwilioDeviceStatus | null;
	updated_at: string;
}

/** Presence endpoints return the row plus the recomputed numeric availability
 *  (exactly what Retreaver would see right now). */
export interface PresenceResponse {
	statusCode: string;
	statusMessage: string;
	available?: 0 | 1;
	presence?: DialerPresence | null;
}

/** An org campaign the agent can select before going ready. */
export interface DialerCampaign {
	id: string;
	org_id: string;
	name: string;
	default_form_id: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CampaignsResponse {
	statusCode: string;
	statusMessage: string;
	campaigns?: DialerCampaign[];
}

/** Post one heartbeat. `sessionId` ties the beat to this browser tab; until the
 *  Twilio device exists (Subplan 03) the device status is reported as 'offline'. */
export const postHeartbeat = (
	sessionId: string,
	deviceStatus: TwilioDeviceStatus
): Promise<PresenceResponse> =>
	qsPost('/policyPrinter/dialer/heartbeat', {
		session_id: sessionId,
		device_status: deviceStatus
	});

/** Read current presence + availability (UI bootstrap). */
export const getPresence = (): Promise<PresenceResponse> =>
	qsPost('/policyPrinter/dialer/presence/get');

/** Set status and/or selected campaign. Omit a field to leave it unchanged. */
export const setPresence = (input: {
	status?: PresenceStatus;
	campaign_id?: string | null;
}): Promise<PresenceResponse> =>
	qsPost('/policyPrinter/dialer/presence/set', input);

/** The org's active campaigns for the dropdown (all of them in V1). */
export const listCampaigns = (): Promise<CampaignsResponse> =>
	qsPost('/policyPrinter/dialer/campaigns/list');

/* -------------------------------------------------------------------------- */
/* Twilio softphone (Subplan 03)                                              */
/* -------------------------------------------------------------------------- */

export interface TwilioTokenResponse {
	statusCode: string;
	statusMessage: string;
	token?: string;
	identity?: string;
}

/** Mint a short-lived Twilio Voice access token for this browser Device. */
export const getTwilioToken = (): Promise<TwilioTokenResponse> =>
	qsPost('/policyPrinter/dialer/twilio/token');

/** Signal call accept (true) / disconnect (false) → flips the on_call flag so
 *  mid-call availability is 0. Returns the recomputed availability/presence. */
export const setOnCall = (onCall: boolean): Promise<PresenceResponse> =>
	qsPost('/policyPrinter/dialer/presence/onCall', {on_call: onCall});
