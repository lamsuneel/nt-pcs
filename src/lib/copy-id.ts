import { customAlphabet } from 'nanoid';

// Cryptographically unpredictable QR token: no sequential or guessable component.
// nanoid draws from a CSPRNG (crypto.getRandomValues under the hood).
const tokenAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateToken = customAlphabet(tokenAlphabet, 40);

export function generateQrToken(): string {
  return generateToken();
}

/**
 * Produces identifiers like SOP-PROD-001-REV03-COPY-0042.
 * The sequence number is NOT the security token (that's the qrToken) — it's
 * only for human readability, so it may legitimately be sequential per request.
 */
export function buildCopyIdentifier(documentNumber: string, revisionLabel: string, sequence: number): string {
  const padded = String(sequence).padStart(4, '0');
  return `${documentNumber}-REV${revisionLabel}-COPY-${padded}`;
}
