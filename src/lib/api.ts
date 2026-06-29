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
