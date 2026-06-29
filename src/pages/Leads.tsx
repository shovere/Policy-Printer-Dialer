/**
 * Leads page — the agent's own lead tracker (Subplan 05).
 *
 * Lists the caller's leads (server-side scoped to their agent_id) with filters
 * (campaign, phone/name prefix search, date range), pagination, and an expandable
 * detail row showing the FROZEN form snapshot + answers, the disposition, the
 * event timeline, and a recording link (copied onto the call when Retreaver's
 * recording lands; "not available yet" until then).
 *
 * The detail re-uses FormRenderer in disabled mode so an old lead always renders
 * with its original layout, regardless of later form edits.
 */

import {useEffect, useMemo, useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {
	listCampaigns,
	listLeads,
	getLeadDetail,
	getLeadRecording,
	type DialerCampaign,
	type LeadDetailResponse,
	type LeadFilters,
	type LeadListItem
} from '@/lib/api';
import {FormRenderer} from '@/leads/FormRenderer';

const PAGE_SIZE = 25;
const inputClasses =
	'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export default function Leads() {
	const [campaigns, setCampaigns] = useState<DialerCampaign[]>([]);
	const [leads, setLeads] = useState<LeadListItem[]>([]);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Draft filter inputs (applied on submit / page change).
	const [campaignId, setCampaignId] = useState('');
	const [search, setSearch] = useState('');
	const [searchKind, setSearchKind] = useState<'name' | 'phone'>('name');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	// The filters actually in effect (bumped on Apply).
	const [applied, setApplied] = useState<LeadFilters>({});

	useEffect(() => {
		listCampaigns()
			.then((res) => setCampaigns(res.campaigns ?? []))
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		listLeads(applied, PAGE_SIZE, page)
			.then((res) => {
				if (cancelled) return;
				if (res.statusCode !== 'SP100') {
					setError(res.statusMessage || 'Failed to load leads');
					return;
				}
				setLeads(res.leads ?? []);
				setTotal(res.total ?? 0);
				setTotalPages(res.totalPages ?? 1);
			})
			.catch((err) => {
				if (cancelled) return;
				setError(readError(err, 'Failed to load leads'));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [applied, page]);

	const onApply = () => {
		setExpandedId(null);
		setPage(1);
		setApplied({
			campaign_id: campaignId || null,
			name: searchKind === 'name' ? search || null : null,
			caller_phone: searchKind === 'phone' ? search || null : null,
			created_from: from || null,
			created_to: to ? `${to} 23:59:59` : null
		});
	};

	const onReset = () => {
		setCampaignId('');
		setSearch('');
		setSearchKind('name');
		setFrom('');
		setTo('');
		setExpandedId(null);
		setPage(1);
		setApplied({});
	};

	return (
		<div className="mx-auto max-w-4xl space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>Leads</span>
						<span className="text-xs font-normal text-muted-foreground">
							{total} total
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					{/* Filter bar */}
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<select
							value={campaignId}
							onChange={(e) => setCampaignId(e.target.value)}
							className={inputClasses}
							aria-label="Campaign"
						>
							<option value="">All campaigns</option>
							{campaigns.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>

						<div className="flex gap-2">
							<select
								value={searchKind}
								onChange={(e) => setSearchKind(e.target.value as 'name' | 'phone')}
								className={`${inputClasses} w-28`}
								aria-label="Search by"
							>
								<option value="name">Name</option>
								<option value="phone">Phone</option>
							</select>
							<input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && onApply()}
								placeholder={searchKind === 'name' ? 'Name starts with…' : 'Phone starts with…'}
								className={inputClasses}
							/>
						</div>

						<label className="flex items-center gap-2 text-xs text-muted-foreground">
							From
							<input
								type="date"
								value={from}
								onChange={(e) => setFrom(e.target.value)}
								className={inputClasses}
							/>
						</label>
						<label className="flex items-center gap-2 text-xs text-muted-foreground">
							To
							<input
								type="date"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								className={inputClasses}
							/>
						</label>
					</div>

					<div className="flex gap-2">
						<Button size="sm" onClick={onApply}>
							Apply filters
						</Button>
						<Button size="sm" variant="outline" onClick={onReset}>
							Reset
						</Button>
					</div>

					{error && <p className="text-destructive">{error}</p>}

					{/* Table */}
					<div className="overflow-hidden rounded-md border border-border">
						<div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-muted-foreground">
							<span>Name</span>
							<span>Phone</span>
							<span>Campaign</span>
							<span>Disposition</span>
						</div>

						{loading && (
							<p className="px-3 py-4 text-muted-foreground">Loading…</p>
						)}
						{!loading && leads.length === 0 && (
							<p className="px-3 py-4 text-muted-foreground">No leads found.</p>
						)}

						{!loading &&
							leads.map((lead) => (
								<LeadRow
									key={lead.id}
									lead={lead}
									expanded={expandedId === lead.id}
									onToggle={() =>
										setExpandedId(expandedId === lead.id ? null : lead.id)
									}
								/>
							))}
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<Button
								size="sm"
								variant="outline"
								disabled={page <= 1 || loading}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<span className="text-xs text-muted-foreground">
								Page {page} of {totalPages}
							</span>
							<Button
								size="sm"
								variant="outline"
								disabled={page >= totalPages || loading}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function LeadRow({
	lead,
	expanded,
	onToggle
}: {
	lead: LeadListItem;
	expanded: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="border-b border-border last:border-b-0">
			<button
				type="button"
				onClick={onToggle}
				className="grid w-full grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/30"
			>
				<span className="truncate">{lead.name || '—'}</span>
				<span className="truncate font-mono text-xs">{lead.caller_phone || '—'}</span>
				<span className="truncate text-muted-foreground">
					{lead.campaign_name || '—'}
				</span>
				<span className="truncate text-muted-foreground">
					{lead.disposition_label || '—'}
				</span>
			</button>
			{expanded && <LeadDetailPanel leadId={lead.id} />}
		</div>
	);
}

function LeadDetailPanel({leadId}: {leadId: string}) {
	const [detail, setDetail] = useState<LeadDetailResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [recording, setRecording] = useState<string | null | undefined>(undefined);
	const [recLoading, setRecLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		getLeadDetail(leadId)
			.then((res) => {
				if (cancelled) return;
				if (res.statusCode !== 'SP100') {
					setError(res.statusMessage || 'Failed to load detail');
					return;
				}
				setDetail(res);
			})
			.catch((err) => {
				if (cancelled) return;
				setError(readError(err, 'Failed to load detail'));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [leadId]);

	const schema = useMemo(() => detail?.lead?.form_schema_snapshot ?? [], [detail]);

	const onLoadRecording = async () => {
		setRecLoading(true);
		try {
			const res = await getLeadRecording(leadId);
			setRecording(res.recording_url ?? null);
		} catch {
			setRecording(null);
		} finally {
			setRecLoading(false);
		}
	};

	if (loading) {
		return <p className="px-3 py-3 text-xs text-muted-foreground">Loading detail…</p>;
	}
	if (error) {
		return <p className="px-3 py-3 text-xs text-destructive">{error}</p>;
	}
	if (!detail?.lead) return null;

	return (
		<div className="space-y-4 bg-secondary/10 px-3 py-3 text-sm">
			{/* Frozen form snapshot + answers (read-only). */}
			{schema.length > 0 ? (
				<FormRenderer
					schema={schema}
					value={detail.lead.form_data ?? {}}
					onChange={() => undefined}
					disabled
				/>
			) : (
				<p className="text-xs text-muted-foreground">No form captured for this lead.</p>
			)}

			<div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
				<Row label="Campaign" value={detail.campaign_name || '—'} />
				<Row label="Disposition" value={detail.lead.disposition_label || '—'} />
				<Row label="Created" value={fmt(detail.lead.created_at)} />
				<Row label="Phone" value={detail.lead.caller_phone || '—'} />
			</div>

			{/* Recording */}
			<div className="border-t border-border pt-3">
				<p className="mb-1 text-xs text-muted-foreground">Recording</p>
				{recording === undefined ? (
					<Button size="sm" variant="outline" onClick={onLoadRecording} disabled={recLoading}>
						{recLoading ? 'Checking…' : 'Load recording'}
					</Button>
				) : recording ? (
					<a
						href={recording}
						target="_blank"
						rel="noreferrer"
						className="text-sm text-success underline"
					>
						Play recording ↗
					</a>
				) : (
					<p className="text-xs text-muted-foreground">Recording not available yet.</p>
				)}
			</div>

			{/* Event timeline */}
			{detail.events && detail.events.length > 0 && (
				<div className="border-t border-border pt-3">
					<p className="mb-1 text-xs text-muted-foreground">Activity</p>
					<ul className="space-y-1">
						{detail.events.map((ev) => (
							<li key={ev.id} className="flex justify-between gap-4 text-xs">
								<span>{ev.event_type}</span>
								<span className="text-muted-foreground">{fmt(ev.created_at)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
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

function fmt(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function readError(err: any, fallback: string): string {
	return err?.response?.data?.statusMessage || err?.message || fallback;
}
