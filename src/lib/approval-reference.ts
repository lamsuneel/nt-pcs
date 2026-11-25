import { customAlphabet } from 'nanoid';

// Human-readable but still effectively unguessable approval reference
// number — distinct from the cryptographic QR token used for controlled
// copies (see copy-id.ts). This one's only job is to give every
// e-signature event a unique, citable reference ("APR-20261125-K3F9QZ")
// that shows up in the audit trail and on the record itself.
const suffixAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generateSuffix = customAlphabet(suffixAlphabet, 6);

export function generateApprovalReferenceNumber(): string {
  const now = new Date();
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `APR-${ymd}-${generateSuffix()}`;
}

export const E_SIGNATURE_ATTESTATION =
  'By typing my full name and confirming, I am electronically signing this record. This signature is legally binding and equivalent to my handwritten signature.';
