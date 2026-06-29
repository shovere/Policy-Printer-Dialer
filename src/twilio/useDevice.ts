/**
 * useDevice — the Twilio browser softphone (Subplan 03).
 *
 * Mints a Voice access token, registers a Twilio `Device`, and AUTO-ANSWERS the
 * inbound call Retreaver bridged to this agent (Retreaver already selected a ready
 * agent, so there's no "accept?" step — the browser just picks up). It also:
 *   - reports the device registration status (consumed by useHeartbeat so the
 *     backend's computeReady only routes when the Device is actually 'registered'),
 *   - refreshes the token on `tokenWillExpire`,
 *   - signals on_call=true on accept / false on disconnect (mid-call availability=0),
 *   - exposes the live Call + mute/hangup so the active-call UI can drive it.
 *
 * No outbound dialing, no conference. Mic permission is requested up front (the
 * SDK needs it to answer). One Device per tab; cleaned up on unmount.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import {Call, Device} from '@twilio/voice-sdk';
import {getTwilioToken, setOnCall, type TwilioDeviceStatus} from '@/lib/api';

export interface ActiveCall {
	/** E.164 / SIP caller number from Twilio params (best-effort). */
	from: string;
	/** Twilio CallSid — ties the lead (Subplan 04) back to dialer_calls. */
	callSid: string;
	muted: boolean;
	/** Epoch ms when the call connected — the UI derives the timer from this. */
	startedAt: number;
}

export interface UseDeviceState {
	deviceStatus: TwilioDeviceStatus;
	/** Non-null while a call is connected. */
	activeCall: ActiveCall | null;
	/** Last device/call error message, for surfacing in the UI. */
	error: string | null;
	mute: (muted: boolean) => void;
	hangup: () => void;
}

export interface UseDeviceOptions {
	/** Gate device setup until a session + provisioning exist. */
	enabled?: boolean;
}

export function useDevice({enabled = true}: UseDeviceOptions = {}): UseDeviceState {
	const [deviceStatus, setDeviceStatus] = useState<TwilioDeviceStatus>('offline');
	const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
	const [error, setError] = useState<string | null>(null);

	const deviceRef = useRef<Device | null>(null);
	const callRef = useRef<Call | null>(null);

	const mute = useCallback((muted: boolean) => {
		const call = callRef.current;
		if (!call) return;
		call.mute(muted);
		setActiveCall((prev) => (prev ? {...prev, muted} : prev));
	}, []);

	const hangup = useCallback(() => {
		callRef.current?.disconnect();
	}, []);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		let device: Device | null = null;

		const fetchToken = async (): Promise<string> => {
			const res = await getTwilioToken();
			if (res.statusCode !== 'SP100' || !res.token) {
				throw new Error(res.statusMessage || 'Failed to get Twilio token');
			}
			return res.token;
		};

		/** Wire the per-call listeners + auto-answer. */
		const onIncoming = (call: Call) => {
			callRef.current = call;

			call.on('accept', () => {
				if (cancelled) return;
				setActiveCall({
					from: call.parameters.From || 'Unknown',
					callSid: call.parameters.CallSid || '',
					muted: false,
					startedAt: Date.now()
				});
				// Best-effort: tell the backend we're busy (mid-call availability=0).
				void setOnCall(true).catch(() => undefined);
			});

			const clearCall = () => {
				if (cancelled) return;
				callRef.current = null;
				setActiveCall(null);
				void setOnCall(false).catch(() => undefined);
			};
			call.on('disconnect', clearCall);
			call.on('cancel', clearCall);
			call.on('reject', clearCall);
			call.on('error', (e: {message?: string}) => {
				if (cancelled) return;
				setError(e?.message || 'Call error');
				clearCall();
			});

			// AUTO-ANSWER — Retreaver already chose this ready agent.
			call.accept();
		};

		const setup = async () => {
			try {
				const token = await fetchToken();
				if (cancelled) return;

				device = new Device(token, {
					codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
				});
				deviceRef.current = device;

				device.on('registered', () => !cancelled && setDeviceStatus('registered'));
				device.on('unregistered', () => !cancelled && setDeviceStatus('offline'));
				device.on('error', (e: {message?: string}) => {
					if (cancelled) return;
					setDeviceStatus('error');
					setError(e?.message || 'Device error');
				});
				device.on('incoming', onIncoming);

				// Refresh the (short-lived) Twilio token before it expires.
				device.on('tokenWillExpire', async () => {
					try {
						const fresh = await fetchToken();
						if (!cancelled) await device?.updateToken(fresh);
					} catch (e) {
						if (!cancelled) setError('Failed to refresh Twilio token');
					}
				});

				setDeviceStatus('connecting');
				await device.register();
			} catch (e) {
				if (cancelled) return;
				setDeviceStatus('error');
				setError(e instanceof Error ? e.message : 'Failed to start softphone');
			}
		};

		void setup();

		return () => {
			cancelled = true;
			try {
				callRef.current?.disconnect();
			} catch {
				/* ignore */
			}
			try {
				device?.destroy();
			} catch {
				/* ignore */
			}
			deviceRef.current = null;
			callRef.current = null;
		};
	}, [enabled]);

	return {deviceStatus, activeCall, error, mute, hangup};
}
