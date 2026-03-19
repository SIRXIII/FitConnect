# Phase 26: AI Discount Analytics - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** Auto-mode (Claude's best judgment based on project patterns)

<domain>
## Phase Boundary

Trainers see an "Optimization" section in their analytics dashboard with a day/hour heatmap of idle slot patterns, actionable discount recommendation cards for underutilized time blocks, and a numeric optimization score reflecting slot utilization.

</domain>

<decisions>
## Implementation Decisions

### Heatmap visualization
- Day/hour grid heatmap (7 days x 24 hours or reasonable subset like 6am-10pm)
- Color intensity: green (high utilization) to red (low utilization) — intuitive traffic-light scheme
- Shows last 4 weeks of booking data
- Clickable cells to see specific slot details
- Integrated as a new sub-section within the existing AnalyticsTab (not a separate tab)

### Discount recommendation cards
- Card format: "5 idle Tuesday 9am slots in last 4 weeks — try 20-30% off"
- Show top 3-5 worst-performing time blocks
- Each card has a "Set Discount" CTA that links to the trainer's rate/discount settings
- Recommendations are deterministic: based on booking fill rate per time block
- Cards sorted by idle count (worst first)

### Optimization score
- Single number 0-100 representing overall slot utilization
- Formula: (booked slots / total available slots) * 100 over the last 4 weeks
- Visual: circular gauge or large number with color indicator
- Green (80%+), Amber (50-79%), Red (below 50%)
- Updates in real-time as bookings come in (re-fetched on tab focus)

### Claude's Discretion
- Exact heatmap cell sizing and spacing
- Whether to use an existing Recharts heatmap or custom grid component
- Recommendation card layout details
- Score gauge implementation (SVG ring reuse from ProfileProgressRing or plain number)
- How to handle trainers with fewer than 2 weeks of data (show partial or "Not enough data" message)

</decisions>

<canonical_refs>
## Canonical References

### Existing analytics code
- `src/components/trainer/AnalyticsTab.tsx` — Current analytics with Recharts AreaChart/BarChart, chart colors, time range selector
- `src/lib/analytics.ts` — Time range utilities, date bounds, bucket formatting, CSV export

### Patterns to reuse
- `src/components/client/ProfileProgressRing.tsx` — SVG ring pattern (reusable for score gauge)
- `src/components/trainer/SleepTimerPills.tsx` — Pill button patterns

### Database
- `.planning/REQUIREMENTS.md` — AIANALYTICS-01 through AIANALYTICS-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- AnalyticsTab.tsx: Already has Recharts, chart colors, time range selector — extend with Optimization section
- ProfileProgressRing: SVG ring pattern reusable for optimization score gauge
- analytics.ts: Time range/bucket utilities

### Integration Points
- AnalyticsTab.tsx — add Optimization section below existing charts
- availability_slots + bookings tables — data source for utilization calculations

</code_context>

<specifics>
## Specific Ideas

- Heatmap should look clean and modern — not a spreadsheet, but a visual heat grid
- Recommendation cards should feel actionable, not just informational
- Score gauge gives trainers a quick at-a-glance number they can try to improve

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-ai-discount-analytics*
*Context gathered: 2026-03-19 via auto-mode*
