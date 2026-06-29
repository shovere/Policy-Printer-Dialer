/**
 * DispositionSelect — the call-outcome picker (Subplan 04).
 *
 * Renders the campaign's dispositions (from the lead bundle) as a single-choice
 * list. The agent picks one during or after the call; the selected
 * `disposition_key` is sent on save and the backend snapshots its trusted label
 * onto the lead. Controlled — the parent owns the selection.
 */

import {cn} from '@/lib/utils';
import type {DialerDisposition} from '@/lib/api';

export function DispositionSelect({
	dispositions,
	value,
	onChange,
	disabled
}: {
	dispositions: DialerDisposition[];
	value: string | null;
	onChange: (dispositionKey: string | null) => void;
	disabled?: boolean;
}) {
	if (dispositions.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No dispositions configured for this campaign yet.
			</p>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{dispositions.map((d) => {
				const selected = value === d.disposition_key;
				return (
					<button
						key={d.id}
						type="button"
						disabled={disabled}
						onClick={() => onChange(selected ? null : d.disposition_key)}
						className={cn(
							'rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
							selected
								? 'border-success bg-success/15 text-foreground'
								: 'border-input hover:bg-secondary/60'
						)}
					>
						{d.label}
					</button>
				);
			})}
		</div>
	);
}
