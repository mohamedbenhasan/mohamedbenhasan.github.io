import { BillingCycle, RedeemCodeRecord, RedeemDurationCode } from '../types';

const REDEEM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars (exact divisor of 256)

export function normalizeRedeemCode(rawCode: string): string {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function maskRedeemCodeClient(normalizedCode: string): string {
  const clean = normalizeRedeemCode(normalizedCode);
  const parts = clean.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-••••-${parts[parts.length - 1]}`;
  }
  if (clean.length > 8) {
    return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
  }
  return 'VRU-••••';
}

export async function hashRedeemCodeClient(normalizedCode: string): Promise<string> {
  const clean = normalizeRedeemCode(normalizedCode);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Cryptographie Web SHA-256 indisponible sur cet appareil.');
  }
  const encoded = new TextEncoder().encode(clean);
  const digest = await subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function generateRandomChunk(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REDEEM_ALPHABET[bytes[i] % REDEEM_ALPHABET.length];
  }
  return out;
}

export function generateRandomRedeemCode(plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS'): string {
  const prefix = plan === 'FAMILY' ? 'VRU-FAM' : plan === 'BUSINESS' ? 'VRU-BIZ' : 'VRU-PREM';
  return `${prefix}-${generateRandomChunk(4)}-${generateRandomChunk(4)}-${generateRandomChunk(4)}`;
}

export function resolveBillingCycleForDuration(durationCode: RedeemDurationCode): BillingCycle {
  if (durationCode === '12m' || durationCode === '24m') return 'annual';
  if (durationCode === '1m') return 'monthly';
  return 'custom';
}

export function buildRedeemCsvContent(codes: RedeemCodeRecord[]): string {
  const header =
    'id,maskedCode,plan,durationCode,status,usesCount,maxUses,campaign,createdBy,createdAt,expiresAt,usedByEmail\n';
  const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = codes
    .map((c) =>
      [
        c.id || '',
        c.maskedCode || c.code,
        c.plan,
        c.durationCode || c.billingCycle,
        c.status,
        c.usesCount ?? 0,
        c.maxUses ?? 1,
        escapeCsv(c.campaign || ''),
        escapeCsv(c.createdBy || ''),
        c.createdAt ? new Date(c.createdAt).toISOString() : '',
        c.expiresAt ? new Date(c.expiresAt).toISOString() : '',
        escapeCsv(c.usedByEmail || ''),
      ].join(',')
    )
    .join('\n');
  return header + rows;
}
