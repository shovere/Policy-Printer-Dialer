/**
 * FormRenderer — renders a lead form from its schema (Subplan 04).
 *
 * The schema is an ordered array of FormField objects served by the backend
 * (leadForm/get). One control per FieldType. Labels and help text are rendered as
 * TEXT (never HTML) — the backend stores schema, not markup. This component is
 * fully controlled: it owns no field state, only emits onChange so the parent
 * (LeadForm) holds the form_data and drives save.
 *
 * Client-side required/format hints are for UX only — the backend is the source
 * of truth and re-validates everything on save.
 */

import type {FormField} from '@/lib/api';

const inputClasses =
	'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export type LeadFormData = Record<string, unknown>;

export function FormRenderer({
	schema,
	value,
	onChange,
	disabled
}: {
	schema: FormField[];
	value: LeadFormData;
	onChange: (key: string, fieldValue: unknown) => void;
	disabled?: boolean;
}) {
	const fields = [...schema]
		.filter((f) => f.active !== false)
		.sort((a, b) => a.sort_order - b.sort_order);

	if (fields.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				This campaign’s form has no fields yet.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{fields.map((field) => (
				<Field
					key={field.key}
					field={field}
					value={value[field.key]}
					onChange={(v) => onChange(field.key, v)}
					disabled={disabled}
				/>
			))}
		</div>
	);
}

function Field({
	field,
	value,
	onChange,
	disabled
}: {
	field: FormField;
	value: unknown;
	onChange: (v: unknown) => void;
	disabled?: boolean;
}) {
	const id = `lf_${field.key}`;
	return (
		<div className="space-y-1">
			{field.type !== 'boolean' && (
				<label className="text-sm text-muted-foreground" htmlFor={id}>
					{field.label}
					{field.required && <span className="text-destructive"> *</span>}
				</label>
			)}
			<Control field={field} id={id} value={value} onChange={onChange} disabled={disabled} />
			{field.help && (
				<p className="text-xs text-muted-foreground">{field.help}</p>
			)}
		</div>
	);
}

function Control({
	field,
	id,
	value,
	onChange,
	disabled
}: {
	field: FormField;
	id: string;
	value: unknown;
	onChange: (v: unknown) => void;
	disabled?: boolean;
}) {
	const str = typeof value === 'string' ? value : '';

	switch (field.type) {
		case 'textarea':
			return (
				<textarea
					id={id}
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					rows={3}
					className={inputClasses.replace('h-10', 'min-h-[72px]')}
				/>
			);

		case 'select':
			return (
				<select
					id={id}
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					className={inputClasses}
				>
					<option value="">Select…</option>
					{(field.options ?? []).map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			);

		case 'radio':
			return (
				<div className="flex flex-wrap gap-3 pt-1">
					{(field.options ?? []).map((o) => (
						<label key={o.value} className="flex items-center gap-1.5 text-sm">
							<input
								type="radio"
								name={id}
								checked={str === o.value}
								disabled={disabled}
								onChange={() => onChange(o.value)}
							/>
							{o.label}
						</label>
					))}
				</div>
			);

		case 'checkbox': {
			const arr = Array.isArray(value) ? (value as string[]) : [];
			const toggle = (optValue: string) => {
				const next = arr.includes(optValue)
					? arr.filter((v) => v !== optValue)
					: [...arr, optValue];
				onChange(next);
			};
			return (
				<div className="flex flex-wrap gap-3 pt-1">
					{(field.options ?? []).map((o) => (
						<label key={o.value} className="flex items-center gap-1.5 text-sm">
							<input
								type="checkbox"
								checked={arr.includes(o.value)}
								disabled={disabled}
								onChange={() => toggle(o.value)}
							/>
							{o.label}
						</label>
					))}
				</div>
			);
		}

		case 'boolean':
			return (
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						id={id}
						checked={value === true}
						disabled={disabled}
						onChange={(e) => onChange(e.target.checked)}
					/>
					{field.label}
				</label>
			);

		case 'number':
			return (
				<input
					id={id}
					type="number"
					value={typeof value === 'number' ? value : str}
					disabled={disabled}
					onChange={(e) =>
						onChange(e.target.value === '' ? '' : Number(e.target.value))
					}
					className={inputClasses}
				/>
			);

		case 'date':
			return (
				<input
					id={id}
					type="date"
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					className={inputClasses}
				/>
			);

		case 'email':
			return (
				<input
					id={id}
					type="email"
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					className={inputClasses}
				/>
			);

		case 'phone':
			return (
				<input
					id={id}
					type="tel"
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					className={inputClasses}
				/>
			);

		case 'text':
		default:
			return (
				<input
					id={id}
					type="text"
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					className={inputClasses}
				/>
			);
	}
}
