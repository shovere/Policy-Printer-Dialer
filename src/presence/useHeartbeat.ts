/**
 * useHeartbeat — the dialer's 5s presence heartbeat (Subplan 02).
 *
 * While the tab is visible it POSTs /policyPrinter/dialer/heartbeat every
 * HEARTBEAT_INTERVAL_MS, which refreshes the agent's `last_heartbeat_at` so the
 * backend's `computeReady` keeps returning 1 (i.e. Retreaver keeps routing to
 * this buyer). It pauses while the tab is hidden (a backgrounded tab shouldn't
 * advertise availability) and resumes — firing one immediate beat — on return.
 *
 * It returns the latest computed `available` (0|1) and the presence row the
 * backend echoes back, so the UI can mirror exactly what Retreaver sees. The
 * Twilio device status is reported as 'offline' until Subplan 03 wires the real
 * Device — which means `available` is correctly 0 until the softphone can
 * actually receive a call, even when the agent has toggled Ready.
 *
 * Multi-tab is intentionally last-writer-wins in V1: each tab heartbeats with its
 * own session id and overwrites `session_id`; both keep the agent fresh.
 */

import {useEffect, useRef, useState} from 'react';
import {
	postHeartbeat,
	type DialerPresence,
	type TwilioDeviceStatus
} from '@/lib/api';

const HEARTBEAT_INTERVAL_MS = 5_000;

/** Stable-per-tab session id (a backend `session_id` value). */
const newSessionId = (): string => {
	const c = globalThis.crypto;
	if (c && 'randomUUID' in c) return c.randomUUID();
	// Fallback for older browsers — uniqueness across tabs is all we need.
	return `s_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
};

export interface HeartbeatState {
	/** Numeric availability from the last heartbeat (what Retreaver would see). */
	available: 0 | 1 | null;
	presence: DialerPresence | null;
	/** True once at least one heartbeat round-tripped (UI can show "connected"). */
	connected: boolean;
}

export interface UseHeartbeatOptions {
	/** Pause heartbeating entirely (e.g. before a session exists). */
	enabled?: boolean;
	/** The Twilio device status to report. Defaults to 'offline' (pre-Subplan 03). */
	deviceStatus?: TwilioDeviceStatus;
}

export function useHeartbeat({
	enabled = true,
	deviceStatus = 'offline'
}: UseHeartbeatOptions = {}): HeartbeatState {
	const [state, setState] = useState<HeartbeatState>({
		available: null,
		presence: null,
		connected: false
	});

	// Session id is stable for the life of this hook instance (this tab).
	const sessionIdRef = useRef<string>('');
	if (!sessionIdRef.current) sessionIdRef.current = newSessionId();

	// Keep the latest device status in a ref so the interval reads fresh values
	// without re-subscribing every time it changes.
	const deviceStatusRef = useRef<TwilioDeviceStatus>(deviceStatus);
	deviceStatusRef.current = deviceStatus;

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | null = null;

		const beat = async () => {
			try {
				const res = await postHeartbeat(
					sessionIdRef.current,
					deviceStatusRef.current
				);
				if (cancelled) return;
				setState({
					available: (res.available ?? 0) as 0 | 1,
					presence: res.presence ?? null,
					connected: true
				});
			} catch {
				if (cancelled) return;
				// A failed beat means we are not advertising availability right now.
				setState((prev) => ({...prev, available: 0, connected: false}));
			}
		};

		const start = () => {
			if (timer) return;
			void beat(); // immediate beat so state is fresh on (re)start
			timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
		};

		const stop = () => {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		};

		const onVisibility = () => {
			if (document.hidden) stop();
			else start();
		};

		// Start only if currently visible; always listen for changes.
		if (!document.hidden) start();
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			cancelled = true;
			stop();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [enabled]);

	return state;
}
