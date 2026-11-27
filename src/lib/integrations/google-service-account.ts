// Epic H — Google Workspace service-account auth with domain-wide
// delegation (Option 1, per decision). One shared credential, provisioned
// once by the customer's Workspace admin, lets PrintAssure search Drive
// *as any user in their org* by impersonating that user's email in the
// token request — no per-user Google sign-in required.
//
// Deliberately dependency-free: Node's built-in `crypto` can do RS256
// signing, so this mints its own JWT and exchanges it at Google's token
// endpoint over plain fetch, rather than pulling in the googleapis SDK
// (which hit an unrelated workspace-protocol conflict in this repo's
// dependency tree when we tried installing it earlier).
//
// Setup the customer's Workspace admin needs to do (Google Admin Console
// -> Security -> API Controls -> Domain-wide Delegation):
//   1. Create a service account in Google Cloud Console, enable the Drive
//      API, download its JSON key.
//   2. Add its Client ID as a delegated OAuth client in Admin Console,
//      authorized for scope https://www.googleapis.com/auth/drive.readonly
//   3. Set GOOGLE_SERVICE_ACCOUNT_JSON (the full key file contents) and
//      optionally GOOGLE_WORKSPACE_DEFAULT_SUBJECT (a fallback mailbox to
//      impersonate for automated/webhook calls that have no signed-in
//      PrintAssure user) in the deployment's environment.
// Until that's done, every function here returns null/false rather than
// throwing — callers fall back to their existing non-live behavior.

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let cachedKey: ServiceAccountKey | null | undefined;

function getServiceAccountKey(): ServiceAccountKey | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) throw new Error('missing client_email/private_key');
    cachedKey = { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch (err) {
    console.error('[google-service-account] GOOGLE_SERVICE_ACCOUNT_JSON is set but invalid:', err);
    cachedKey = null;
  }
  return cachedKey;
}

export function isServiceAccountConfigured(): boolean {
  return getServiceAccountKey() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// subjectEmail is who to impersonate — this IS the domain-wide-delegation
// mechanism: Drive calls made with the resulting token run as that user,
// scoped to their own files, without that user ever logging in themselves.
async function signJwtAssertion(key: ServiceAccountKey, subjectEmail: string, scope: string): Promise<string> {
  const { createSign } = await import('node:crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: key.client_email,
    scope,
    aud: TOKEN_ENDPOINT,
    sub: subjectEmail,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(key.private_key));
  return `${signingInput}.${signature}`;
}

type CacheEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, CacheEntry>();

// Mints (and caches, ~55 min) a short-lived Drive-readonly access token
// impersonating subjectEmail. Returns null if no service account is
// configured, or if Google rejects the request (subject not provisioned,
// delegation not granted yet, etc.) — callers treat null as "live Drive
// access isn't available right now," never as a hard error.
export async function getDriveAccessTokenForUser(subjectEmail: string): Promise<string | null> {
  const key = getServiceAccountKey();
  if (!key) return null;

  const cacheKey = `${subjectEmail}:${DRIVE_READONLY_SCOPE}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  try {
    const assertion = await signJwtAssertion(key, subjectEmail, DRIVE_READONLY_SCOPE);
    // A hung token-endpoint connection must never stall the caller
    // indefinitely — this is what was leaving the search UI stuck on
    // "Searching Google Drive..." with no result and no error. 8s is well
    // inside any reasonable serverless function budget.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`[google-service-account] token exchange failed for ${subjectEmail}: ${res.status} ${body}`);
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 });
    return data.access_token;
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    console.error(`[google-service-account] token exchange ${timedOut ? 'timed out' : 'error'} for ${subjectEmail}:`, err);
    return null;
  }
}

// For automated calls with no signed-in PrintAssure user (the inbound
// webhook) — impersonates a dedicated mailbox the Workspace admin sets up
// for this purpose, e.g. printassure-integration@customerdomain.com.
export async function getDriveAccessTokenForSystem(): Promise<string | null> {
  const subject = process.env.GOOGLE_WORKSPACE_DEFAULT_SUBJECT;
  if (!subject) return null;
  return getDriveAccessTokenForUser(subject);
}
