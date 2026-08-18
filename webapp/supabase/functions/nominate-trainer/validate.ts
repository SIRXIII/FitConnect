// Pure, import-free normalization + validation for trainer nomination
// submissions. Import-free on purpose so it runs under BOTH Deno (the edge
// function) and Vitest (mirrors supabase/functions/_shared/payoutValidation.ts).

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

export type UsStateCode = (typeof US_STATE_CODES)[number];

const STATE_CODE_SET = new Set<string>(US_STATE_CODES);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NominationInput {
  first_name?: unknown;
  city?: unknown;
  state?: unknown;
  nominee_name?: unknown;
  nominee_email?: unknown;
  nominee_phone?: unknown;
}

export interface NominationData {
  first_name: string;
  city: string;
  state: UsStateCode;
  nominee_name?: string;
  nominee_email?: string;
  nominee_phone?: string;
}

export type ValidationResult =
  | { ok: true; data: NominationData }
  | { ok: false; error: string };

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateNomination(input: NominationInput): ValidationResult {
  const firstName = asTrimmedString(input.first_name);
  if (firstName.length < 1 || firstName.length > 80) {
    return { ok: false, error: 'First name is required' };
  }

  const rawCity = asTrimmedString(input.city);
  if (rawCity.length < 1 || rawCity.length > 100) {
    return { ok: false, error: 'City is required' };
  }
  const city = toTitleCase(rawCity);

  const rawState = asTrimmedString(input.state).toUpperCase();
  if (!STATE_CODE_SET.has(rawState)) {
    return { ok: false, error: 'Please select a valid state' };
  }
  const state = rawState as UsStateCode;

  const data: NominationData = { first_name: firstName, city, state };

  const nomineeName = asTrimmedString(input.nominee_name);
  if (nomineeName.length > 0) {
    if (nomineeName.length > 120) {
      return { ok: false, error: 'Nominee name is too long' };
    }
    data.nominee_name = nomineeName;
  }

  const nomineeEmail = asTrimmedString(input.nominee_email);
  if (nomineeEmail.length > 0) {
    if (nomineeEmail.length > 320 || !EMAIL_RE.test(nomineeEmail)) {
      return { ok: false, error: 'Please enter a valid nominee email' };
    }
    data.nominee_email = nomineeEmail.toLowerCase();
  }

  const nomineePhone = asTrimmedString(input.nominee_phone);
  if (nomineePhone.length > 0) {
    if (nomineePhone.length > 40) {
      return { ok: false, error: 'Nominee phone is too long' };
    }
    data.nominee_phone = nomineePhone;
  }

  return { ok: true, data };
}
