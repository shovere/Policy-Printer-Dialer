import {useEffect, useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {fetchDialerProfile} from '@/lib/api';

/**
 * Dial page — Subplan 01 stub. It proves the authenticated round-trip works
 * (handoff → JWT → /policyPrinter/dialer/profile) and shows the agent's
 * provisioning state. The real softphone UI (Ready/Paused toggle, campaign
 * dropdown, active-call banner, auto-answer) is built in Subplans 02–04.
 */
export default function Dial() {
	const [profile, setProfile] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchDialerProfile()
			.then(setProfile)
			.catch((err) =>
				setError(
					err?.response?.data?.statusMessage ||
						err?.message ||
						'Failed to load profile'
				)
			);
	}, []);

	return (
		<div className="mx-auto max-w-xl space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Softphone</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					{error && <p className="text-destructive">{error}</p>}
					{!error && !profile && (
						<p className="text-muted-foreground">Loading profile…</p>
					)}
					{profile && (
						<div className="space-y-1">
							<Row label="Dialer enabled" value={String(profile.dialer_enabled)} />
							<Row label="Provisioned" value={String(profile.provisioned)} />
							{profile.agent && (
								<>
									<Row label="Twilio identity" value={profile.agent.twilio_identity} />
									<Row
										label="SIP username"
										value={profile.agent.sip_username ?? '—'}
									/>
									<Row
										label="Retreaver buyer id"
										value={profile.agent.retreaver_buyer_id ?? '—'}
									/>
								</>
							)}
						</div>
					)}
					<p className="pt-2 text-xs text-muted-foreground">
						Ready/Paused, campaign selection, and the active-call experience arrive
						in later subplans.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

function Row({label, value}: {label: string; value: string}) {
	return (
		<div className="flex justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono">{value}</span>
		</div>
	);
}
