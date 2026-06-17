# FitRush Design System

The visual language for FitRush. Every new screen and component calibrates against
this. If a change conflicts with what is here, update this file in the same PR so the
system and the code never drift apart.

Aesthetic in one line: **editorial luxury** — warm paper, ink type, a single gold
accent, serif display headings, hairline borders, generous whitespace. Closer to a
print magazine spread than a SaaS template. Restraint is the brand.

---

## 1. Tokens (source of truth: `Cenlar demand gt 1-17/src/index.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--color-paper` | `#FDFCFB` | Page background. Warm off-white, never pure `#fff`. |
| `--color-ink` | `#1A1A1A` | Primary text, dark fills (funnel bars, nav underline). |
| `--color-accent` | `#C5A059` | Gold. The ONLY accent. Revenue, MRR, conversion, the one thing that should win the eye. |
| `--color-primary` | `#000000` | Reserved structural black. |
| `--font-serif` | `Cormorant Garamond` | Display headings only (page titles, italic). |

Color rule: **gold is the only accent, full stop.** No blue, no purple, no second
accent. If a chart needs a second series, use ink at reduced opacity (e.g.
`rgba(26,26,26,0.25)`), never a new hue. This is non-negotiable and is the single
biggest thing that separates FitRush from a generic dashboard template.

Opacity ramp on ink (use these, do not invent new ones):

| Class | Approx contrast on paper | Use |
|-------|--------------------------|-----|
| `text-ink` | full | values, primary text |
| `text-ink/70` | passes AA | section labels, secondary text |
| `text-ink/60` | passes AA (floor) | muted subtitles, captions. **Do not go lighter than /60 for any text that carries meaning.** |
| `text-ink/40` and below | fails AA | decorative only (empty-state filler, neutral placeholders) |

`text-ink/30` borders/icons are fine (non-text). The `/60` floor exists because
`/40` body text measured ~2.3:1, well under the 4.5:1 WCAG AA minimum.

---

## 2. Typography

- **Page title:** Cormorant Garamond, italic, ~34px (`text-3xl`/`text-4xl`), e.g. the
  "Admin Dashboard" header. Serif italic is the signature display move.
- **Section labels:** `text-[10px] uppercase tracking-[0.2em] text-ink/70 font-medium`.
  The tiny letter-spaced caps label is the connective tissue of every section.
- **KPI values:** `text-3xl` (or `text-4xl` for hero) `font-semibold tabular-nums
  tracking-tight`. Always `tabular-nums` so digits do not jitter between states.
- **Body / table text:** sans (`ui-sans-serif`), `text-sm`. Serif is for display, not
  for data.
- Numbers are always `tabular-nums`. No exceptions.

---

## 3. Layout & surfaces

- **Borders, not shadows.** Surfaces are defined by `border border-ink/10` hairlines.
  No drop shadows, no elevation. Flat and sharp.
- **Sharp corners.** No `rounded` on cards/containers (skeleton pulse blocks may use a
  tiny radius). Rounded-everything reads as template; sharp reads as editorial.
- **Generous padding.** Cards use `p-8`; hero cards `p-10`. Whitespace is a feature.
- **Section rhythm:** `space-y-8` between sections, `space-y-3` between a section label
  and its content.
- **Grids stack on mobile** via `md:` breakpoints (`grid-cols-1 md:grid-cols-N`).

---

## 4. Component vocabulary

These are the established patterns. Reuse them; do not invent parallel ones.

- **StatCard** (`AdminDashboard.tsx`): hairline card, bare icon (gold if `accent`, else
  `text-ink/30`), tiny caps label, big tabular value, optional subtitle + colored
  delta. Has a `loading` prop that renders a `bg-ink/[0.04] animate-pulse` skeleton
  bar (never show a bare "—" as a loading state).
- **Hero KPI strip:** 3 large cards (`p-10`, `text-4xl`) for the metrics an executive
  reads first (Revenue, Platform Fee, MRR), each with a period-over-period delta and,
  where a series exists, a `Sparkline`.
- **Sparkline:** inline SVG polyline, 160x32, single stroke in the series color, no
  fill, no axes. Micro-trend under a hero value. Derived from existing `time_series`.
- **Funnel bars:** a true narrowing horizontal bar per stage (ink fill, gold for the
  final converted stage), value inside the bar, stage conversion % in a right column.
  Replaces same-size cards so drop-off is visible at a glance. Use a layout, not a
  card grid, for any funnel.
- **Attention strip:** muted-amber hairline strip (`border-amber-700/30
  bg-amber-700/[0.04]`) that surfaces what needs a human now (past-due subs, payout
  backlog, no-shows). Renders only when a signal is nonzero. Amber is the one
  sanctioned exception to gold-only, reserved exclusively for "needs attention."
- **Delta:** colored text, `text-green-600` up / `text-red-500` down, with a `↑`/`↓`
  glyph and a "vs prior period" suffix. **Text, not a filled pill** (pills fight the
  restraint). The glyph means the color is never the only signal (a11y).

---

## 5. Charts (Recharts)

- Current series in gold (`#C5A059`) with a faint gold gradient area fill.
- Secondary series (fees) in ink at low opacity, faint fill.
- Comparison/prior-period series as a dashed ink line (`strokeDasharray="5 5"`,
  `rgba(26,26,26,0.3)`), no fill.
- Gridlines: horizontal only, `rgba(26,26,26,0.06)`, dashed, no vertical lines.
- Axes: no axis line, no tick line, 10px `rgba(26,26,26,0.4)` labels.
- Always include an inline legend above the chart (do not make users hover a tooltip
  to learn what a line means).

---

## 6. States

Every data surface specifies all of these:

- **Loading:** skeleton pulse (`animate-pulse`), never a bare "—".
- **Empty:** a sentence with context, not just "No data." Warm it where you can.
- **Error:** *(known gap, tracked in TODOS.md)* surface a retry affordance instead of
  leaving skeletons spinning on RPC failure.
- **Partial:** null-coalesce missing metrics to 0 / "0"; never render `NaN` or
  `undefined`.

---

## 7. Reference notes — Lytic (21st.dev / TailGrids)

Reviewed `21st.dev/community/templates/tailgrids-lytic` as a structural reference.

**Adopted (structure only, our palette):**
- Horizontal delta row: change on the left, muted context ("vs prior period") aligned
  right on the same baseline. Our hero/StatCard deltas already follow this.

**Considered but NOT adopted here:**
- Lytic leads its chart with a big "Revenue Performance $64,654" headline. That works
  for Lytic because it has no hero strip. We DO lead with a hero (Total Revenue), so
  repeating the period total above the chart would duplicate the hero number, the exact
  thing the hero/Platform-Stats de-duplication removed. One job per section wins: the
  hero owns the revenue headline, the chart keeps just its label. Use the
  headline-above-chart pattern only on a screen that has no hero.

**Explicitly rejected (would downgrade our system):**
- Blue accent and icons-in-colored-rounded-squares — this is the generic SaaS look our
  editorial system exists to avoid.
- Rounded cards with soft shadows — we use sharp hairline borders.
- Filled colored delta pills — we use colored text.

The rule that makes FitRush not-a-template: gold is the only accent, surfaces are
hairlines not shadows, headings are serif. Hold that line.
