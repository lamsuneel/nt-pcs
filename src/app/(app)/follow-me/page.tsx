'use client';

import { PageHeader, Card } from '@/components/ui';

export default function FollowMePage() {
  return (
    <div>
      <PageHeader
        title="Follow-Me Print"
        subtitle="Max-tier preview — the controlled print job waits in a secure hold queue and only releases at the printer once the requester badges in, so nothing sits unattended in an open output tray."
      />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">1. Request held</div>
          <p className="text-nt-muted text-xs">An approved, issued copy is sent to the hold queue instead of a physical tray the moment it's released for printing.</p>
        </Card>
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">2. Badge to release</div>
          <p className="text-nt-muted text-xs">The requester walks to any enrolled printer on site and badges in — the job releases only to that device, only for them.</p>
        </Card>
      </div>
      <Card>
        <div className="text-sm text-nt-text font-medium mb-1">Why it matters for GMP floors</div>
        <p className="text-nt-muted text-xs">
          A controlled copy left in an open tray is an uncontrolled copy from the moment it lands. Follow-Me print removes that
          window entirely — the physical document and the person authorized to hold it are matched at release, not after the fact.
        </p>
      </Card>
    </div>
  );
}
