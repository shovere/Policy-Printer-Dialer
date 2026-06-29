import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

/**
 * Leads page — Subplan 01 placeholder. The agent's own lead tracker (table,
 * filters, search, detail drawer, recording link) is built in Subplan 05.
 */
export default function Leads() {
	return (
		<div className="mx-auto max-w-3xl">
			<Card>
				<CardHeader>
					<CardTitle>Leads</CardTitle>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground">
					Your lead tracker will live here (Subplan 05).
				</CardContent>
			</Card>
		</div>
	);
}
