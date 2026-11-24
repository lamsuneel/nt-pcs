'use client';

import { PageHeader, Card } from '@/components/ui';

export default function MobilePage() {
  return (
    <div>
      <PageHeader
        title="Mobile App"
        subtitle="Max-tier preview — the same RBAC rules apply on a phone as on the desktop app; an Employee still can't approve or issue from their mobile session."
      />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">Scan to verify</div>
          <p className="text-nt-muted text-xs">Point the phone's camera at a copy's QR code to get the same ACTIVE / RECALLED verdict the desktop verify page gives — no login required, same as today.</p>
        </Card>
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">Acknowledge on the floor</div>
          <p className="text-nt-muted text-xs">An Employee can acknowledge receipt of an issued copy from where they're standing, instead of walking back to a workstation.</p>
        </Card>
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">Push alerts for recalls</div>
          <p className="text-nt-muted text-xs">Anyone holding a copy that just got recalled is notified immediately, with the escalation clock already visible.</p>
        </Card>
        <Card>
          <div className="text-nt-text text-sm font-medium mb-1">Same permissions, smaller screen</div>
          <p className="text-nt-muted text-xs">Approvals, issuance and recall closure stay gated to the roles that hold those permissions — mobile is a client, not a privilege escalation.</p>
        </Card>
      </div>
    </div>
  );
}
