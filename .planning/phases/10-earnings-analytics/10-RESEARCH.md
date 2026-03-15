# Phase 10: Earnings Analytics - Research

**Researched:** 2026-03-14
**Domain:** Recharts data visualization, Supabase RPC aggregate queries, CSV export, React tab UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANALYTICS-01 | Trainer sees earnings dashboard with week/month/quarter/year range selector | Time-range selector as React state (`'week' | 'month' | 'quarter' | 'year'`); date boundary computed from current date; all queries parameterized by `start` and `end` timestamps |
| ANALYTICS-02 | Trainer sees key metrics: gross earnings, net earnings, bookings count, avg price, discount adoption % | Computed from `payments` table (gross=`amount`, net=`trainer_payout`) and `bookings` table joined to `trainer_profiles.discount_percentage`; all aggregations scoped to `trainer_id` + time range |
| ANALYTICS-03 | Trainer sees charts: revenue trend line, booking count trend, peak hours heatmap | Recharts 3.5.1 `AreaChart`+`BarChart` for trend lines; 24x7 matrix for heatmap built from `availability_slots.start_time` grouped by `EXTRACT(DOW/HOUR)`; all via Supabase RPC SQL functions |
| ANALYTICS-04 | Admin sees aggregate metrics: total platform revenue, total trainer payouts, booking volume | Same `payments` table aggregation without trainer filter; admin queries use service role or RLS bypass via admin check |
| ANALYTICS-05 | Admin can segment analytics by trainer (top earners list) and by time period | Top earners: GROUP BY `trainer_id` on `payments` table, join `trainer_profiles` for name; time period filter same as trainer analytics |
| ANALYTICS-06 | Trainer can export earnings history as CSV | Client-side CSV generation from fetched payment rows using native Blob + anchor click pattern; no extra library needed |
</phase_requirements>

---

## Summary

Phase 10 adds an Analytics tab to both the Trainer Dashboard and the Admin Dashboard. The data layer is Supabase Postgres RPC functions — SQL functions returning aggregate rows called via `supabase.rpc()`. This avoids building complex query logic in TypeScript while letting Postgres handle all GROUP BY, date_trunc, and join operations efficiently.

Recharts 3.5.1 is already installed (`"recharts": "^3.5.1"` in package.json) and the `AreaChart` from AdminDashboard.tsx imports already use the recharts icon family. The two chart types needed are `AreaChart` (revenue trend line) and `BarChart` (booking count trend). The peak hours heatmap is a CSS grid rendered from a 7×24 matrix — no chart library needed for it.

For CSV export, no additional library is required. The native browser `Blob` + temporary anchor click pattern handles this cleanly with zero dependencies. The pattern is well-established and the data volume for individual trainer exports will always be small enough for client-side generation.

**Primary recommendation:** Put all aggregate SQL into three Postgres RPC functions (one for trainer metrics + time-series, one for trainer peak-hours, one for admin aggregate + top earners). Call them from a new `AnalyticsTab.tsx` component using `supabase.rpc()`. Add a new `Analytics` tab to `TrainerDashboard.tsx` and extend `AdminDashboard.tsx`'s existing analytics tab.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.5.1 | Revenue trend AreaChart, booking count BarChart | Already installed in project; AdminDashboard already imports it; no additional install needed |
| @supabase/supabase-js | 2.99.0 | `supabase.rpc()` calls to Postgres functions | Already installed and used throughout project |
| Native Blob API | Browser built-in | CSV file download without dependencies | No library needed; `new Blob([csv], { type: 'text/csv' })` + anchor click is the standard pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.555.0 | Icons (Download, TrendingUp, BarChart2) | Already in project; use Download icon for CSV export button |
| sonner | 2.0.7 | Toast on CSV export success/error | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres RPC functions | Client-side aggregation | Client-side aggregation requires fetching all raw rows; for large datasets this is slow and wasteful. RPC keeps aggregation in DB. |
| Native Blob CSV | papaparse / react-csv | Both add ~30KB to bundle. Native Blob is sufficient for this simple use case with fixed columns. |
| AreaChart + BarChart | recharts LineChart | AreaChart provides fill shading under the curve, making the revenue trend more visually distinct. The project already has recharts installed. |
| CSS grid heatmap | recharts ScatterChart | The peak hours heatmap is a simple 7×24 intensity grid; recharts ScatterChart would require more configuration with no visual benefit. A CSS grid with opacity-based coloring is simpler and matches the project's minimal aesthetic. |

**Installation:**
```bash
# No new packages needed — recharts is already installed at 3.5.1
# Verify: package.json shows "recharts": "^3.5.1"
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── trainer/
│       ├── PayoutsTab.tsx          # Phase 9 — already exists
│       └── AnalyticsTab.tsx        # Phase 10 — new
├── pages/
│   ├── TrainerDashboard.tsx        # Add 'analytics' to tab union type
│   └── AdminDashboard.tsx          # Extend existing 'analytics' tab content

supabase/
├── functions/
│   └── (no new Edge Functions needed for analytics — RPC only)
└── migrations/
    └── 20260315000000_analytics_rpc.sql   # Three Postgres functions
```

No new Edge Functions are needed. All analytics queries are read-only and can be handled by Postgres RPC functions called directly from the frontend via the Supabase JS client.

### Pattern 1: Tab Extension (TrainerDashboard)
**What:** Add `'analytics'` to the existing tab union type and tab bar
**When to use:** ANALYTICS-01 — the trainer tab structure is `overview | payouts | analytics`

```typescript
// TrainerDashboard.tsx — change existing line 16
const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'analytics'>('overview');

// Tab bar — add 'analytics' to the array
{(['overview', 'payouts', 'analytics'] as const).map((tab) => (
  // ... identical to existing tab render pattern
))}

// After the payouts conditional:
{activeTab === 'analytics' && <AnalyticsTab />}
```

**Note:** Phase 9 CONTEXT.md explicitly said "Phase 10 adds Analytics" to the tab structure. This is the planned extension point.

### Pattern 2: Time Range Selector
**What:** React state with four range options; date boundaries computed from `Date.now()`
**When to use:** ANALYTICS-01 — all queries parameterized by time range

```typescript
type TimeRange = 'week' | 'month' | 'quarter' | 'year';

function getDateBounds(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (range === 'week')    start.setDate(start.getDate() - 7);
  if (range === 'month')   start.setMonth(start.getMonth() - 1);
  if (range === 'quarter') start.setMonth(start.getMonth() - 3);
  if (range === 'year')    start.setFullYear(start.getFullYear() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
```

### Pattern 3: Supabase RPC for Analytics Aggregation
**What:** Postgres function called via `supabase.rpc()` to return aggregated data
**When to use:** ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05

```typescript
// Source: https://supabase.com/docs/guides/database/functions
const { data, error } = await supabase.rpc('get_trainer_analytics', {
  p_trainer_id: trainerProfile.id,
  p_start: bounds.start,
  p_end: bounds.end,
  p_bucket: range === 'week' ? 'day' : range === 'month' ? 'day' : 'week',
});
```

The RPC function returns a JSON object with both scalar metrics AND time-series arrays, keeping it to a single round-trip.

### Pattern 4: Recharts AreaChart (Revenue Trend)
**What:** Responsive area chart with time-series data
**When to use:** ANALYTICS-03 — revenue trend line

```typescript
// Source: recharts.github.io/en-US/api + confirmed installed at 3.5.1
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Revenue trend:
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
    <Area type="monotone" dataKey="revenue" stroke="#2d2d2d" fill="rgba(45,45,45,0.08)" strokeWidth={1.5} />
  </AreaChart>
</ResponsiveContainer>
```

**Important Recharts 3.x note:** The API is backwards compatible with 2.x for these components. The 3.0 migration guide's breaking changes (removed `CategoricalChartState`, internal state props) only affect custom components that consumed internal Recharts state. Standard declarative usage as above is unaffected.

### Pattern 5: Peak Hours Heatmap (CSS Grid)
**What:** 7-row × 24-column intensity grid using CSS grid + opacity mapping
**When to use:** ANALYTICS-03 — peak hours heatmap

```typescript
// Data shape from RPC: [{ day_of_week: 0, hour: 9, count: 5 }, ...]
// Render as CSS grid, no recharts needed:
const intensity = (count: number) => Math.min(count / maxCount, 1);

<div className="grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
  {DAYS.map((day, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const cell = heatmap.find((c) => c.day_of_week === d && c.hour === h);
      return (
        <div
          key={`${d}-${h}`}
          className="h-6 border border-paper"
          style={{ backgroundColor: `rgba(45,45,45,${intensity(cell?.count ?? 0)})` }}
          title={`${day} ${h}:00 — ${cell?.count ?? 0} bookings`}
        />
      );
    })
  )}
</div>
```

### Pattern 6: Client-Side CSV Export
**What:** Generate CSV from payment rows using native Blob API, trigger download via temporary anchor
**When to use:** ANALYTICS-06 — trainer CSV export

```typescript
// Source: standard browser Blob API — no library needed
function downloadCSV(rows: PaymentRow[], filename: string) {
  const header = 'Date,Client,Gross,Net,Status\n';
  const lines = rows.map((r) =>
    `"${r.date}","${r.client}","${r.gross}","${r.net}","${r.status}"`
  ).join('\n');

  const blob = new Blob([header + lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Important:** Call `URL.revokeObjectURL` immediately after triggering the download to prevent memory leaks.

### Pattern 7: Admin Analytics — Top Earners Table
**What:** Trainer ranked by total net earnings in period, shown as a table
**When to use:** ANALYTICS-05

```typescript
// Data shape from RPC: [{ trainer_name, gross, net, bookings_count }, ...]
// Render as a simple border table matching AdminDashboard pattern:
<div className="border border-ink/10">
  <div className="grid grid-cols-[2fr_1fr_1fr_80px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
    <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Trainer</p>
    <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Gross</p>
    <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Net</p>
    <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Bookings</p>
  </div>
  {topEarners.map((row) => ( ... ))}
</div>
```

### Anti-Patterns to Avoid
- **Fetching raw payment rows for aggregation:** Don't pull all rows to TypeScript for reduce() — use Postgres RPC for GROUP BY queries. Raw row fetching is fine for small datasets but will degrade as booking volume grows.
- **Embedding SQL in Edge Functions for read-only analytics:** Edge Functions add cold-start latency and deployment friction. Postgres RPC functions are simpler for read-only queries.
- **Hardcoding time zone offsets:** Use `date_trunc` with `AT TIME ZONE` in Postgres, or always work in UTC and let the frontend format. Never do manual UTC offset math in TypeScript.
- **Forgetting RLS on analytics queries:** The trainer RPC function must filter by `trainer_id` matching the calling user. Admins need a separate function or an admin role check.
- **Blocking CSV export on large data fetch:** Fetch analytics data once for display; reuse the same fetched data for CSV export. Don't re-fetch when the download button is clicked.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series aggregation | GROUP BY logic in TypeScript | Postgres `date_trunc` + `SUM` in RPC function | Postgres handles aggregation in a single query; TypeScript would require fetching all rows |
| Revenue trend chart | Custom SVG path drawing | Recharts AreaChart (already installed) | Recharts handles responsive sizing, tooltips, axis scaling, and animation out of the box |
| CSV generation | Custom escape/quote logic | Native Blob API with explicit quoting | CSV edge cases (commas in names, quotes in strings) require careful escaping; use explicit quoting around all fields |
| Discount adoption % | Complex join logic in TypeScript | Postgres: `COUNT(CASE WHEN b.rate_charged < tp.hourly_rate THEN 1 END) / COUNT(*)` in RPC | Avoids fetching trainer_profiles rows to TypeScript for rate comparison |

**Key insight:** All heavy data work belongs in Postgres RPC functions. The TypeScript layer only formats and renders — it never aggregates.

---

## Common Pitfalls

### Pitfall 1: RLS Blocks Admin Analytics Queries
**What goes wrong:** Admin calls `get_admin_analytics` RPC function but gets empty results or permission error because RLS on `payments` only allows trainers to see their own rows.
**Why it happens:** Postgres RPC functions run with the caller's role by default (`SECURITY INVOKER`). An admin user's JWT doesn't automatically bypass trainer-scoped RLS policies.
**How to avoid:** Mark the admin analytics function as `SECURITY DEFINER` and validate the caller is an admin inside the function body (`SELECT role FROM profiles WHERE id = auth.uid()`). Alternatively, create a separate admin RLS policy on `payments` that allows `admin` role SELECT access.
**Warning signs:** Admin analytics tab shows zeros while trainer tab works correctly.

### Pitfall 2: date_trunc Bucket Mismatch With Range
**What goes wrong:** Weekly range uses `date_trunc('week', ...)` which produces only 1 data point instead of 7 daily points. Trend charts show a single bar rather than a line.
**Why it happens:** The bucket granularity must match the display intent. "Last 7 days" should bucket by `day`, not `week`.
**How to avoid:** Pass a `p_bucket` parameter to the RPC function. For `week` range → `day` bucket. For `month` range → `day` bucket. For `quarter` range → `week` bucket. For `year` range → `month` bucket.
**Warning signs:** Trend chart shows 1-4 data points instead of 7-12.

### Pitfall 3: Recharts ResponsiveContainer Height Requires Parent Dimensions
**What goes wrong:** Chart renders at 0px height. `ResponsiveContainer height={300}` works but `height="100%"` renders nothing.
**Why it happens:** `height="100%"` requires the parent container to have an explicit height. If the parent is `height: auto`, the percentage has nothing to resolve against.
**How to avoid:** Always use a fixed pixel height on `ResponsiveContainer` (e.g., `height={220}`) or give the parent an explicit height class. Do not use `height="100%"` without a fixed-height parent.
**Warning signs:** Chart renders but is invisible; inspect shows `height: 0px` on the SVG.

### Pitfall 4: CSV Values With Commas in Client Names
**What goes wrong:** A client named "Smith, Jr." breaks the CSV column alignment. Unquoted fields containing commas split into multiple columns.
**Why it happens:** CSV parsing treats bare commas as field separators.
**How to avoid:** Wrap every field in double quotes in the CSV output: `"${value.replace(/"/g, '""')}"`. This is standard RFC 4180 CSV escaping.
**Warning signs:** CSV opens with misaligned columns for any row where a name contains a comma.

### Pitfall 5: Discount Adoption % Definition Ambiguity
**What goes wrong:** Discount adoption % is calculated as "bookings where a discount was applied / total bookings" but different definitions give different numbers: (a) trainer had discount_percentage > 0 at time of booking, (b) rate_charged < optimized_rate, (c) payout < rate_charged × (1 - platform_fee).
**Why it happens:** The schema doesn't store a `discount_applied` boolean on bookings.
**How to avoid:** Use definition (b): `rate_charged < tp.optimized_rate` as the proxy for "discount was applied." This is the most reliable signal available in the current schema — the optimized_rate is the trainer's baseline, and rate_charged below that means a discount was in effect at booking time. Document this definition in the UI as "bookings with active discount."
**Warning signs:** Discount % doesn't match what trainers expect from their discount slider usage.

### Pitfall 6: Peak Hours Heatmap Using Booking created_at Instead of Slot start_time
**What goes wrong:** The heatmap shows booking *creation* times (when clients clicked "Book") instead of *session* times (when the actual workout happens).
**Why it happens:** `bookings.created_at` is the booking timestamp; `availability_slots.start_time` is the actual session time.
**How to avoid:** Join `bookings` to `availability_slots` via `bookings.slot_id` and use `EXTRACT(DOW FROM slots.start_time)` and `EXTRACT(HOUR FROM slots.start_time)` for the heatmap. This shows actual session peak times, which is useful for trainers.
**Warning signs:** Heatmap shows concentration at odd hours (e.g., 11pm) because clients book late at night.

---

## Code Examples

Verified patterns from project code and official sources:

### Postgres RPC Function: Trainer Analytics
```sql
-- Source: Supabase DB Functions docs + project schema inspection
CREATE OR REPLACE FUNCTION public.get_trainer_analytics(
  p_trainer_id  uuid,
  p_start       timestamptz,
  p_end         timestamptz,
  p_bucket      text  -- 'day' | 'week' | 'month'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  -- Verify caller owns this trainer profile
  SELECT user_id INTO v_user_id FROM public.trainer_profiles WHERE id = p_trainer_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH booking_ids AS (
    SELECT id, slot_id FROM public.bookings
    WHERE trainer_id = p_trainer_id
      AND status = 'completed'
      AND created_at BETWEEN p_start AND p_end
  ),
  payment_metrics AS (
    SELECT
      COALESCE(SUM(pm.amount), 0)          AS gross_earnings,
      COALESCE(SUM(pm.trainer_payout), 0)  AS net_earnings,
      COUNT(*)                             AS booking_count,
      CASE WHEN COUNT(*) > 0
        THEN COALESCE(AVG(pm.amount), 0)
        ELSE 0 END                         AS avg_price
    FROM public.payments pm
    INNER JOIN booking_ids bi ON bi.id = pm.booking_id
    WHERE pm.status = 'succeeded'
  ),
  discount_metrics AS (
    SELECT
      CASE WHEN COUNT(*) > 0
        THEN ROUND(100.0 * COUNT(CASE WHEN b.rate_charged < tp.optimized_rate THEN 1 END) / COUNT(*), 1)
        ELSE 0 END AS discount_adoption_pct
    FROM public.bookings b
    INNER JOIN booking_ids bi ON bi.id = b.id
    INNER JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
  ),
  trend AS (
    SELECT
      date_trunc(p_bucket, pm.created_at)  AS bucket,
      SUM(pm.amount)                       AS gross,
      SUM(pm.trainer_payout)               AS net,
      COUNT(*)                             AS count
    FROM public.payments pm
    INNER JOIN booking_ids bi ON bi.id = pm.booking_id
    WHERE pm.status = 'succeeded'
    GROUP BY bucket
    ORDER BY bucket
  )
  SELECT jsonb_build_object(
    'metrics', (SELECT row_to_json(payment_metrics) FROM payment_metrics) ::jsonb ||
               (SELECT row_to_json(discount_metrics) FROM discount_metrics) ::jsonb,
    'trend',   COALESCE((SELECT jsonb_agg(row_to_json(trend)) FROM trend), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

### Postgres RPC Function: Peak Hours
```sql
CREATE OR REPLACE FUNCTION public.get_trainer_peak_hours(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS TABLE(day_of_week int, hour int, count bigint)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    EXTRACT(DOW  FROM s.start_time)::int  AS day_of_week,
    EXTRACT(HOUR FROM s.start_time)::int  AS hour,
    COUNT(*)                              AS count
  FROM public.bookings b
  JOIN public.availability_slots s ON s.id = b.slot_id
  WHERE b.trainer_id = p_trainer_id
    AND b.status = 'completed'
    AND b.created_at BETWEEN p_start AND p_end
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;
```

### Postgres RPC Function: Admin Analytics + Top Earners
```sql
CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text  -- 'day' | 'week' | 'month'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS, must validate admin role
AS $$
DECLARE
  v_role text;
  v_result jsonb;
BEGIN
  -- Validate caller is admin
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH platform_totals AS (
    SELECT
      COALESCE(SUM(amount), 0)          AS total_revenue,
      COALESCE(SUM(platform_fee), 0)    AS total_platform_fee,
      COALESCE(SUM(trainer_payout), 0)  AS total_payouts,
      COUNT(*)                          AS booking_volume
    FROM public.payments
    WHERE status = 'succeeded'
      AND created_at BETWEEN p_start AND p_end
  ),
  top_earners AS (
    SELECT
      pr.full_name                      AS trainer_name,
      SUM(pm.amount)                    AS gross,
      SUM(pm.trainer_payout)            AS net,
      COUNT(*)                          AS bookings_count
    FROM public.payments pm
    JOIN public.bookings b  ON b.id = pm.booking_id
    JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
    JOIN public.profiles pr ON pr.id = tp.user_id
    WHERE pm.status = 'succeeded'
      AND pm.created_at BETWEEN p_start AND p_end
    GROUP BY pr.full_name
    ORDER BY net DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totals',     (SELECT row_to_json(platform_totals) FROM platform_totals)::jsonb,
    'top_earners', COALESCE((SELECT jsonb_agg(row_to_json(top_earners)) FROM top_earners), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

### Calling RPC from React
```typescript
// Source: supabase.rpc() — https://supabase.com/docs/reference/javascript/rpc
const [range, setRange] = useState<TimeRange>('month');

useEffect(() => {
  const bounds = getDateBounds(range);
  supabase.rpc('get_trainer_analytics', {
    p_trainer_id: trainerProfile.id,
    p_start: bounds.start,
    p_end: bounds.end,
    p_bucket: range === 'week' ? 'day' : range === 'month' ? 'day' : range === 'quarter' ? 'week' : 'month',
  }).then(({ data, error }) => {
    if (error) { toast.error('Failed to load analytics'); return; }
    setMetrics(data.metrics);
    setTrendData(data.trend.map((d: any) => ({
      label: formatBucketLabel(d.bucket, range),
      revenue: Number(d.gross),
      net: Number(d.net),
      bookings: Number(d.count),
    })));
  });
}, [range, trainerProfile.id]);
```

### Client-Side CSV Export
```typescript
// Source: browser Blob API — standard pattern, no library needed
function exportEarningsCSV(payments: EarningRow[], range: TimeRange) {
  const header = 'Date,Client,Gross,Net,Status\n';
  const lines = payments.map((r) => [
    `"${r.date}"`,
    `"${r.client.replace(/"/g, '""')}"`,  // escape embedded quotes per RFC 4180
    `"${r.gross.toFixed(2)}"`,
    `"${r.net.toFixed(2)}"`,
    `"${r.status}"`,
  ].join(',')).join('\n');

  const blob = new Blob(['\uFEFF' + header + lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fitrush-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Note:** The `\uFEFF` BOM prefix ensures Excel opens the UTF-8 CSV correctly without mojibake on non-ASCII characters (e.g., client names with accented letters).

### Recharts Chart Styling (matches project aesthetic)
```typescript
// Minimal styling to match the ink/paper project palette
const chartColors = {
  stroke: '#2d2d2d',       // var(--color-ink)
  fill: 'rgba(45,45,45,0.07)',
  grid: 'rgba(0,0,0,0.05)',
};

<AreaChart data={trendData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.4)' }} axisLine={false} tickLine={false} />
  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.4)' }} axisLine={false} tickLine={false} />
  <Tooltip
    contentStyle={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 0, fontSize: 11 }}
    formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
  />
  <Area type="monotone" dataKey="revenue" stroke={chartColors.stroke} fill={chartColors.fill} strokeWidth={1.5} dot={false} />
</AreaChart>
```

---

## Data Model Reference

Phase 9 created the following schema that Phase 10 builds on:

### Existing Tables Available for Analytics

```
payments
  id                      uuid
  booking_id              uuid  → bookings.id
  amount                  numeric(10,2)   -- gross client charge
  platform_fee            numeric(10,2)   -- 8% platform cut
  trainer_payout          numeric(10,2)   -- net to trainer
  status                  text            -- 'succeeded' | 'failed' | etc.
  created_at              timestamptz
  payout_transaction_id   uuid  → payout_transactions.id (nullable)

bookings
  id          uuid
  client_id   uuid  → profiles.id
  trainer_id  uuid  → trainer_profiles.id
  slot_id     uuid  → availability_slots.id
  status      text  -- 'completed' | 'confirmed' | 'pending' | 'cancelled'
  rate_charged  numeric(10,2)  -- actual rate billed (may be discounted)
  trainer_payout  numeric(10,2)  -- net trainer earnings for this booking
  created_at  timestamptz

availability_slots
  id          uuid
  trainer_id  uuid
  start_time  timestamptz   -- actual session time (use this for peak hours heatmap)
  end_time    timestamptz

trainer_profiles
  id                  uuid
  user_id             uuid  → profiles.id
  hourly_rate         numeric(10,2)   -- standard rate
  optimized_rate      numeric(10,2)   -- FitRush AI-optimized rate
  discount_percentage numeric         -- current active discount %

payout_transactions (Phase 9)
  id          uuid
  trainer_id  uuid
  amount      numeric(10,2)
  status      text   -- 'pending' | 'processing' | 'completed' | 'failed'
  created_at  timestamptz
```

**Key field for discount adoption:** `bookings.rate_charged < trainer_profiles.optimized_rate` is the proxy for "discount was applied."

**Key field for gross vs net:** `payments.amount` is gross (what the client paid); `payments.trainer_payout` is net (what the trainer receives after platform fee + Stripe fees).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side GROUP BY (reduce over all rows) | Postgres `date_trunc` + GROUP BY in RPC function | Supabase RPC GA | Single query instead of N rows fetched; scales with data volume |
| D3.js for custom charts | Recharts (already in project) | ~2022 | Recharts composable React API; D3 not needed for these chart types |
| FileSaver.js / papaparse for CSV | Native Blob + anchor click | Modern browser baseline | No extra dependency; same result; FileSaver.js adds 15KB for no gain |
| Recharts 2.x `CategoricalChartState` internal props | Recharts 3.x clean component API | Recharts 3.0, mid-2024 | Internal state props removed; standard declarative usage unchanged |

**Deprecated/outdated:**
- `recharts` v2 internal state customization (removed in v3): Don't use `activeIndex`, `points`, `payload` as undocumented component props — they no longer exist in v3.5.1.
- Calling `supabase.from('payments').select(...)` with JavaScript reduce for aggregation: Works but doesn't scale. RPC is the correct approach for GROUP BY analytics.

---

## Open Questions

1. **Admin role check in Postgres — is there an `admin` role value in profiles.role?**
   - What we know: `profiles.role` is constrained to `CHECK (role IN ('trainer', 'client'))` in the base migration. AdminDashboard uses a client-side check via `useAuthStore`.
   - What's unclear: Whether an `admin` role value exists in the DB — the constraint may block it. The `20260313120000_admin_role.sql` migration may have extended the enum.
   - Recommendation: The planner should read `20260313120000_admin_role.sql` and confirm how admin is identified at the DB level before writing the admin RPC function. If no DB-level admin role exists, the admin function should use a hardcoded admin user ID list from `platform_settings` OR use a separate `is_admin` boolean column.

2. **Recharts 3.5.1 — confirmed API backward compatible for these chart types?**
   - What we know: 3.0 migration guide says breaking changes affect internal state consumption patterns (custom components using `CategoricalChartState`). Standard declarative AreaChart/BarChart usage is unaffected.
   - What's unclear: Whether any minor 3.x releases between 3.0 and 3.5 introduced additional breaking changes to standard axes/area components.
   - Recommendation: Confidence is HIGH for the standard usage patterns shown in Code Examples above. If a chart renders incorrectly at runtime, check the recharts GitHub releases for 3.x changelogs.

3. **Supabase RPC function permissions for trainer-facing analytics**
   - What we know: The RPC function runs as `SECURITY INVOKER` (default) — the caller's RLS policies apply. Trainer JWT should satisfy existing payments/bookings RLS.
   - What's unclear: Whether the existing RLS policies on `payments` allow trainers to SELECT rows joining through `bookings.trainer_id`. The Phase 9 payout system queries payments client-side via booking_ids join — that same logic should hold in SQL.
   - Recommendation: Set the trainer analytics function to `SECURITY INVOKER` with an explicit `trainer_id = p_trainer_id` WHERE clause AND an auth.uid() ownership check. This is defense in depth against any RLS gap.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install Vitest |
| Config file | `vitest.config.ts` — Wave 0 creates |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Note:** Phase 9 research also flagged Vitest as a Wave 0 install. Phase 9 plans were executed without installing it. Phase 10 should install Vitest in Wave 0 before writing tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANALYTICS-01 | `getDateBounds('week')` returns `start` 7 days before now | unit | `npx vitest run src/lib/analytics.test.ts` | Wave 0 |
| ANALYTICS-01 | `getDateBounds('quarter')` returns `start` 3 months before now | unit | `npx vitest run src/lib/analytics.test.ts` | Wave 0 |
| ANALYTICS-02 | AnalyticsTab renders metric cards when RPC returns data | unit | `npx vitest run src/components/trainer/AnalyticsTab.test.tsx` | Wave 0 |
| ANALYTICS-02 | AnalyticsTab shows loading skeleton while fetching | unit | `npx vitest run src/components/trainer/AnalyticsTab.test.tsx` | Wave 0 |
| ANALYTICS-03 | Recharts AreaChart renders with trend data | unit | `npx vitest run src/components/trainer/AnalyticsTab.test.tsx` | Wave 0 |
| ANALYTICS-04 | Admin analytics RPC returns platform totals | manual-only | Supabase SQL Editor: `SELECT get_admin_analytics(...)` | N/A |
| ANALYTICS-05 | Top earners table renders with sorted rows | unit | `npx vitest run src/pages/AdminDashboard.test.tsx` | Wave 0 |
| ANALYTICS-06 | `exportEarningsCSV` generates blob with correct headers | unit | `npx vitest run src/lib/analytics.test.ts` | Wave 0 |
| ANALYTICS-06 | CSV fields are quoted (handles commas in names) | unit | `npx vitest run src/lib/analytics.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `src/lib/analytics.ts` — extract `getDateBounds()` and `exportEarningsCSV()` as pure functions (testable without DOM)
- [ ] `src/lib/analytics.test.ts` — covers ANALYTICS-01, ANALYTICS-06 (pure function tests)
- [ ] `src/components/trainer/AnalyticsTab.test.tsx` — covers ANALYTICS-02, ANALYTICS-03 (mocked supabase.rpc)
- [ ] `src/pages/AdminDashboard.test.tsx` — covers ANALYTICS-05 top earners rendering

*(RPC function correctness and chart visual rendering are manual-only — they require a live Supabase environment)*

---

## Sources

### Primary (HIGH confidence)
- Project codebase — direct read of `TrainerDashboard.tsx`, `AdminDashboard.tsx`, `PayoutsTab.tsx`, `package.json`, `20260314200000_payout_system.sql`, `20260311143000_fitconnect_current_schema.sql`
- Phase 9 SUMMARY files (09-01, 09-02, 09-03) — confirmed schema, data shapes, and tab extension point
- Supabase Database Functions docs — https://supabase.com/docs/guides/database/functions — verified `supabase.rpc()` call pattern, `SECURITY DEFINER` vs `INVOKER`, `returns setof` pattern

### Secondary (MEDIUM confidence)
- Recharts 3.0 migration guide — https://github.com/recharts/recharts/wiki/3.0-migration-guide — verified 3.x breaking changes do not affect standard AreaChart/BarChart declarative usage
- Recharts official API — https://recharts.github.io/en-US/api/LineChart — verified LineChart/AreaChart child component structure
- WebSearch verification of Blob+anchor CSV download pattern — confirmed as established standard pattern across multiple sources

### Tertiary (LOW confidence)
- Recharts 3.5.1 → 3.8.0 changelog (not read) — version in package.json is 3.5.1; migration guide verified for 3.0 breaking changes but intermediate releases not checked

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts already installed, supabase already in use, no new libraries, Blob API is browser built-in
- Architecture: HIGH — tab extension point explicitly called out in Phase 9 CONTEXT.md, RPC pattern verified against Supabase docs, data model confirmed from actual migration files
- Pitfalls: HIGH — SECURITY DEFINER/INVOKER distinction verified against Supabase docs; date_trunc bucket mismatch is a well-known Postgres analytics issue; CSV quoting is RFC 4180 standard; other pitfalls derived from schema inspection

**Research date:** 2026-03-14
**Valid until:** 2026-04-13 (stable APIs; Recharts and Supabase versions pinned in project)
