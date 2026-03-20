# Phase 25: AI Trainer-Client Matching - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Clients with a sufficiently complete Fitness Passport see a "Recommended for You" carousel of top 3 trainer matches on the search page, with percentage scores, qualitative labels, and specific data-driven explanations. Clients below the completeness threshold see an inline prompt to complete their passport. Match results are cached for 24 hours.

</domain>

<decisions>
## Implementation Decisions

### Match scoring criteria
- **Primary factor: Price compatibility** — trainer's rate falls within client's preferred budget range
- **Secondary factor: Goals + specialty alignment** — client's ranked fitness goals match trainer's specialty and workout types
- **Location proximity is NOT a scoring factor** — kept as a separate filter (already exists in map/search)
- Score displayed as **both percentage + label**: "87% — Great Match"
  - Tiers: Great Match (80%+), Good Match (60-79%), Fair Match (40-59%)
- Deterministic scoring (not ML) — weighted formula combining price fit and goals alignment

### Recommendation display
- **Horizontal carousel above search results** — 3-5 recommended cards above the regular grid/map
- Show **top 3** best matches only (exclusive feel, less scrolling)
- Carousel is always visible when passport meets completeness threshold
- Each card shows: trainer photo, name, specialty, rate, match % + label, 2-3 explanation bullets

### Passport completeness gate
- Threshold: **3 key fields filled** — fitness level + at least 1 goal + preferred workout type
- Below threshold: **inline card where carousel would be** — "Complete your Fitness Passport to get matched" with CTA to ClientPassport
- No partial recommendations below threshold — either full carousel or prompt card

### Match explanations
- **Specific with actual data**: "Matches your HIIT goals", "Within your $50-80 range", "3.5 mi away"
- References real client data and trainer attributes — not generic labels
- **2-3 top reasons** per trainer card (highest-scoring factors only)
- Bullet format with dot separator

### Claude's Discretion
- Exact scoring weights (price vs goals proportion)
- Cache implementation (Supabase table vs in-memory)
- Carousel card sizing and scroll behavior
- How to handle ties in match score
- Empty state when fewer than 3 trainers match above threshold

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Client profile data (input to matching)
- `src/pages/ClientPassport.tsx` — Where client data lives (goals, workout types, fitness level, intensity)
- `src/lib/profileConstants.ts` — FITNESS_GOALS, WORKOUT_TYPES, INTENSITY_LEVELS constants
- `src/lib/schemas.ts` — goalsRankedSchema, intensityPreferenceSchema

### Trainer data (input to matching)
- `src/pages/TrainerProfile.tsx` — Trainer specialty, rates
- `src/components/search/SearchSection.tsx` — Where carousel will be inserted above results

### Existing patterns
- `src/components/landing/BestDeals.tsx` — Horizontal card carousel pattern
- `src/components/client/ProfileProgressRing.tsx` — Completeness calculation reusable for threshold check

### Database
- `.planning/REQUIREMENTS.md` — AIMATCH-01 through AIMATCH-04 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- BestDeals.tsx: Horizontal card carousel with snap scrolling — adapt for recommendations
- ProfileProgressRing: Completeness calculation logic can inform the 3-field threshold check
- SearchSection.tsx: Integration point for carousel insertion
- Recharts: Already installed for any score visualization needs

### Established Patterns
- Supabase RPC for server-side computation (trainers_in_view pattern)
- 24hr cache pattern from session_logs 24hr lock
- Zustand stores for client-side state

### Integration Points
- SearchSection.tsx — insert carousel above trainer grid/map
- ClientPassport completeness — check 3 key fields
- trainer_profiles + client_profiles data — inputs to scoring function
- New match_cache table or Supabase RPC with cache logic

</code_context>

<specifics>
## Specific Ideas

- Match explanations should feel personal: "Matches YOUR HIIT goals" not just "Goals match"
- Price as primary factor makes sense for a marketplace — clients care about affordability first
- Top 3 only gives an exclusive, curated feel rather than a long list
- Inline passport prompt is a natural nudge without being annoying

</specifics>

<deferred>
## Deferred Ideas

- Collaborative filtering ("Clients like you also booked") — needs 6+ months booking data (already in REQUIREMENTS.md deferred)
- ML model training — no training data yet, deterministic scoring sufficient
- Match score on trainer profile page — could be a future enhancement

</deferred>

---

*Phase: 25-ai-trainer-client-matching*
*Context gathered: 2026-03-19*
