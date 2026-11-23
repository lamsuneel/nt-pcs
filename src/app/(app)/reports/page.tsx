'use client';

import { PageHeader, Card } from '@/components/ui';

const REPORTS = [
  ['master-register', 'Master Document Register'],
  ['copy-register', 'Controlled Copy Register'],
  ['print-history', 'Print Request History'],
  ['recall-register', 'Document Recall Register'],
  ['destruction-register', 'Destruction Confirmation Register'],
  ['qr-scan-history', 'QR Scan and Verification History'],
  ['audit-trail', 'User Activity and Audit Trail'],
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Audit Reports" subtitle="Every important transaction is attributable to a user, timestamp and record. Export any register as CSV." />
      <div className="grid grid-cols-2 gap-4">
        {REPORTS.map(([key, label]) => (
          <Card key={key} className="flex items-center justify-between">
            <span className="text-sm text-nt-text">{label}</span>
            <a href={`/api/reports/${key}?format=csv`} className="text-nt-teal text-xs hover:underline">Download CSV</a>
          </Card>
        ))}
      </div>
    </div>
  );
}
