# TODOS

Design and engineering debt tracked from reviews. Each item has enough context to
pick up cold.

## Design debt (from /plan-design-review, 2026-06-17)

### Admin analytics — RPC error state
- **What:** The analytics tab has loading (skeleton) and empty states but no error
  state. If `get_admin_analytics` / `get_admin_free_session_metrics` /
  `get_admin_attention` fail (network, RPC exception), the UI leaves skeletons
  spinning or shows zeros, with no signal and no retry.
- **Why:** An exec staring at a stuck skeleton cannot tell "no data" from "it broke."
  Erodes trust in the numbers. See `DESIGN.md` section 6 (States).
- **Pros:** Honest failure surface, one-click recovery, no silent wrong-looking zeros.
- **Cons:** Small amount of state plumbing (an `error` flag per loader) and a retry
  handler; low risk.
- **Context:** Loaders live in `Cenlar demand gt 1-17/src/pages/AdminDashboard.tsx`
  (`fetchAdminAnalytics` useEffect ~line 820, free-metrics fetch ~line 589). The error
  branches currently null out state and return. Add an `analyticsError` boolean, and
  render a hairline card with "Couldn't load analytics" + a retry button that re-runs
  the fetch. Reuse the existing `border border-ink/10` surface.
- **Depends on:** nothing.
