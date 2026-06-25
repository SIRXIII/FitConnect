// Prefer the SEO slug route; fall back to the UUID route when no slug exists.
export function trainerPath(t: { slug?: string | null; id: string }): string {
  return t.slug ? `/personal-trainer/${t.slug}` : `/trainers/${t.id}`;
}
