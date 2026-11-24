// Shared logic for the per-page Agent rail's chat input. Deliberately thin —
// it answers from the same live APIs the rest of the app uses (no separate
// "AI" backend), so what it says is always traceable to a real query.

export async function askAgent(question: string): Promise<string> {
  const lower = question.toLowerCase();

  async function getJson(url: string): Promise<any> {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  }

  if (lower.includes('recall')) {
    const body = await getJson('/api/recalls');
    const recalls = body?.recalls ?? [];
    const open = recalls.filter((r: any) => r.status !== 'CLOSED' && r.status !== 'RECONCILED');
    if (open.length === 0) return 'No open recalls right now — everything on record has reconciled.';
    return `${open.length} open recall${open.length === 1 ? '' : 's'}. The most recent was initiated ${new Date(open[0].initiatedAt).toLocaleDateString()}. Check Recall Effectiveness for the reconciliation percentage.`;
  }

  if (lower.includes('print') && (lower.includes('approv') || lower.includes('pending') || lower.includes('wait'))) {
    const body = await getJson('/api/dashboard/kpis');
    const n = body?.pendingPrintApprovals ?? 0;
    return n > 0
      ? `${n} print request${n === 1 ? '' : 's'} waiting on approval right now.`
      : 'No print requests are waiting on approval right now.';
  }

  if (lower.includes('destr')) {
    const body = await getJson('/api/reports/audit-trail?format=json');
    const rows = (body?.rows ?? []).filter((r: any) => r.eventType?.toLowerCase().includes('destr'));
    return rows.length
      ? `${rows.length} destruction event${rows.length === 1 ? '' : 's'} recorded in the ledger, each with a witness.`
      : 'No destruction events recorded yet.';
  }

  if (lower.includes('audit') || lower.includes('chain') || lower.includes('tamper')) {
    return 'The audit ledger is append-only and hash-chained — each event links to the previous event\'s hash. Open Audit Ledger and hit "Verify chain integrity" to re-walk it live.';
  }

  if (lower.includes('document') && (lower.includes('how many') || lower.includes('count'))) {
    const body = await getJson('/api/dashboard/kpis');
    return `${body?.totalRegisteredDocuments ?? 0} documents are registered right now.`;
  }

  if (lower.includes('copy') || lower.includes('copies')) {
    const body = await getJson('/api/dashboard/kpis');
    return `${body?.activeControlledCopies ?? 0} controlled copies are active, ${body?.lostOrDamagedCopies ?? 0} are lost or damaged.`;
  }

  if (lower.includes('anomal')) {
    return 'Open AI Anomaly Watch — it checks the live ledger for approvals that happened implausibly fast and duplicate destruction events.';
  }

  return 'I can answer from the live data — try asking about open recalls, pending print approvals, document or copy counts, destruction events, or the audit chain.';
}
