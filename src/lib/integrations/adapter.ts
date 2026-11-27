// Epic H — generic inbound print-trigger adapter contract.
//
// The problem this solves: a customer running MasterControl, SharePoint or
// Veeva Vault as their system of record wants to trigger a controlled print
// directly from that tool, without migrating off it or installing client
// software. Each of those systems is just "a place that knows a document
// changed and wants it printed" — so every adapter implements the same
// narrow contract, and the webhook route, the request-creation logic, and
// the approval/issue pipeline downstream of it are completely unaware of
// which system triggered the request.
//
// Isolation (H5) comes from this being the ONLY shape an adapter can take:
// resolveDocument() either returns a match or throws/returns null — it can
// never reach into another adapter's state, another printer's queue, or
// native (in-app) print requests. One provider being down, slow, or
// returning malformed data can only ever fail that one provider's webhook
// call; it has no path to affect anything else.

export type IntegrationProviderKey = 'GOOGLE_DRIVE' | 'SHAREPOINT' | 'MASTERCONTROL' | 'VEEVA';

export type ResolvedExternalDocument = {
  documentId: string;
  revisionId: string;
  documentNumber: string;
  revisionLabel: string;
};

export type PrintTriggerRequest = {
  // The external system's own identifier for the item (a Drive file ID, a
  // SharePoint item ID, etc.) — matched against documents.externalRef.
  externalRef: string;
  numberOfCopies: number;
  requestedByEmail: string;
  destinationLocation: string;
  departmentId: string;
  intendedPurpose?: string;
  isUrgent?: boolean;
};

export interface IntegrationAdapter {
  readonly providerKey: IntegrationProviderKey;
  readonly displayName: string;
  // Resolves the external reference to an internal document+revision that
  // is actually approved and printable. Returns null (not a throw) for "no
  // match" / "not approved yet" — those are expected, routine outcomes, not
  // adapter failures. A thrown error means the adapter itself (auth,
  // network, malformed payload) failed, which the webhook route reports as
  // a clear 502 scoped to that one provider.
  //
  // opts.verifyAsEmail: when a signed-in PrintAssure user is the one asking
  // (the interactive "pick from search" path), live verification should run
  // as THAT person — they're the one who could see the file in search in
  // the first place. Omitted for the webhook path, which has no signed-in
  // user and falls back to the adapter's own system/default subject.
  resolveDocument(externalRef: string, opts?: { verifyAsEmail?: string }): Promise<ResolvedExternalDocument | null>;
}

const registry = new Map<IntegrationProviderKey, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter) {
  registry.set(adapter.providerKey, adapter);
}

export function getAdapter(providerKey: IntegrationProviderKey): IntegrationAdapter | undefined {
  return registry.get(providerKey);
}
