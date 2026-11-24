'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';

interface CopyRow {
  id: string;
  copyIdentifier: string;
  destinationLocation: string | null;
  status: string;
}

export default function InventoryMapPage() {
  const { data, error } = useSWRLite<{ copies: CopyRow[] }>('/api/copies');
  const rows = data?.copies ?? [];

  const byLocation = new Map<string, CopyRow[]>();
  for (const r of rows) {
    const key = r.destinationLocation || 'Unassigned';
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key)!.push(r);
  }
  const zones = Array.from(byLocation.entries()).sort((a, b) => b[1].length - a[1].length);
  const activeStatuses = ['ISSUED', 'ACTIVE'];

  return (
    <div>
      <PageHeader
        title="Inventory Map"
        subtitle="Every controlled copy grouped by its declared physical location — where the floor would see pins on a plant map, this is the same data as a zone breakdown."
      />
      {error && <Card className="mb-5 text-sm text-nt-blocked">{error}</Card>}
      {!error && zones.length === 0 && <EmptyState message="No copies have been issued yet." />}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {zones.map(([location, copies]) => {
          const active = copies.filter((c) => activeStatuses.includes(c.status)).length;
          const flagged = copies.filter((c) => c.status === 'RECALL_PENDING' || c.status === 'LOST' || c.status === 'DAMAGED').length;
          return (
            <Card key={location}>
              <div className="text-nt-text text-sm font-medium mb-1">{location}</div>
              <div className="font-display text-2xl text-nt-text">{copies.length}</div>
              <div className="text-nt-muted text-xs mt-1">
                {active} active{flagged > 0 ? ` · ${flagged} flagged` : ''}
              </div>
              <div className="mt-3 space-y-1">
                {copies.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-nt-muted truncate">{c.copyIdentifier}</span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
                {copies.length > 4 && <div className="text-nt-muted2 text-[11px]">+{copies.length - 4} more</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
