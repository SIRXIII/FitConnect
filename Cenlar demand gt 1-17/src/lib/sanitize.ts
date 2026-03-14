/**
 * Sanitize a user-provided location search string before passing to Supabase ilike().
 * - Strips characters outside: letters, numbers, spaces, commas, periods, hyphens, apostrophes
 * - Caps at 50 characters to prevent DoS via excessive regex backtracking
 * - Trims surrounding whitespace
 */
export function sanitizeSearchInput(raw: string): string {
  return raw
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9\s,.\-']/g, '')
    .trim();
}
