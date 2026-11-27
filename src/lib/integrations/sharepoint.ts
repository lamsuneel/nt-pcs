// Epic H — SharePoint adapter stub.
//
// This is the prioritized real integration target (per the PRD), but it
// needs a Microsoft 365 Developer Program sandbox (free, but requires the
// user's own Microsoft account signup — https://developer.microsoft.com/
// microsoft-365/dev-program) to build and test against real Graph API
// behavior. Implementing it against guesses now would risk shipping
// something that looks done but silently doesn't work against a real
// tenant's auth quirks.
//
// What's real today: the IntegrationAdapter contract this will implement,
// the webhook route that will call it, and the fact that registering this
// adapter is the ONLY change needed once a sandbox exists — nothing else
// in the request/approval/print pipeline needs to know SharePoint exists.
import type { IntegrationAdapter, ResolvedExternalDocument } from './adapter';

export const sharePointAdapter: IntegrationAdapter = {
  providerKey: 'SHAREPOINT',
  displayName: 'SharePoint',

  async resolveDocument(_externalRef: string, _opts?: { verifyAsEmail?: string }): Promise<ResolvedExternalDocument | null> {
    throw new Error(
      'SharePoint integration is not wired up yet — needs a Microsoft 365 Graph API connection. ' +
        'Set up a Microsoft 365 Developer Program sandbox, then this adapter can be implemented ' +
        'against it without changing anything else in the print pipeline.'
    );
  },
};
