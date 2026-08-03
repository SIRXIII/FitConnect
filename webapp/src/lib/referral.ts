const COOKIE_NAME = 'fitc_ref';
const COOKIE_DAYS = 30;

export function captureReferralCode(code: string): void {
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function readReferralCode(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearReferralCode(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

export function buildReferralLink(code: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}
