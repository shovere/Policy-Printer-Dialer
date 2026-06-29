import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import type {ActiveCall} from '@/twilio/useDevice';

/**
 * Active-call banner (Subplan 03). Shows the caller number, a live call timer, and
 * mute / hang-up controls for the in-progress call. Pinned above the softphone card
 * while a call is connected; the lead form (Subplan 04) renders alongside it.
 */
export function ActiveCallBanner({
	call,
	onMute,
	onHangup
}: {
	call: ActiveCall;
	onMute: (muted: boolean) => void;
	onHangup: () => void;
}) {
	const elapsed = useElapsedSeconds(call.startedAt);

	return (
		<div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 px-4 py-3">
			<div className="space-y-0.5">
				<div className="flex items-center gap-2">
					<span className="h-2 w-2 animate-pulse rounded-full bg-success" />
					<span className="text-sm font-medium">On a call</span>
				</div>
				<div className="font-mono text-sm">{call.from}</div>
			</div>

			<div className="flex items-center gap-3">
				<span className="font-mono text-sm tabular-nums text-muted-foreground">
					{formatDuration(elapsed)}
				</span>
				<Button
					variant={call.muted ? 'secondary' : 'outline'}
					size="sm"
					onClick={() => onMute(!call.muted)}
				>
					{call.muted ? 'Unmute' : 'Mute'}
				</Button>
				<Button variant="destructive" size="sm" onClick={onHangup}>
					Hang up
				</Button>
			</div>
		</div>
	);
}

/** Seconds since `startedAt`, ticking once per second. */
function useElapsedSeconds(startedAt: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function formatDuration(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
