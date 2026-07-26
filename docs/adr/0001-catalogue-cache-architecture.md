# ADR 0001 — Catalogue cache architecture

**Status:** accepted · **Date:** 2026-07-26 · **Phase:** M2A · **Supersedes:** the
deferred decision noted in `docs/catalogue-repository.md`

Next.js 16.2.11, React 19.2.4.

## Context

M2B points the storefront's server routes at the catalogue repository. Before
that, the caching architecture has to be chosen on evidence, because the wrong
choice is expensive to unwind once routes depend on it.

Three layers were evaluated independently in a disposable worktree
(`experiment/cache-proof` and `experiment/cache-components`, never pushed, since
removed). Nothing below is inferred from documentation; every result was
measured against this application.

## Decision

**Use Strategy B — the previous data-cache model (`unstable_cache`) — combined
with React `cache()` for per-render deduplication.** Cache Components is
rejected for this transformation.

`unstable_cache` is deprecated, so this is transitional technical debt and is
recorded as such. It is the bridge, not the destination.

---

## Layer A — React `cache()` request memoisation

**Result: adopt.** Works exactly as needed, with one limitation worth writing
down.

Measured in a real render, calling the memoised loader three times in one page:

| Observation | Value |
| --- | --- |
| Loader invocations for 3 calls in one render | **1** |
| Same object instance returned to all three callers | **yes** |
| Invocations across separate requests | **1 per request** — no cross-request reuse |

So it deduplicates within a render and provides no persistent caching, which is
precisely the division of labour wanted: `cache()` stops the homepage's
overlapping sections from loading the catalogue several times, and
`unstable_cache` handles persistence.

**Limitation:** `cache()` only memoises inside an active React render. Measured
outside one — plain Node, both the default and the `react-server` export
condition — it is a passthrough and every call reaches the loader:

```
calls for load("a"), load("a"), load("b")  →  3   (deduped: false)
```

This is why `src/data/catalogue-request-cache.ts` carries no unit test asserting
deduplication, and why scripts, jobs and tests must call `getCatalogue`
directly rather than relying on the request wrapper.

## Layer B — `unstable_cache`

**Result: adopt, with one mandatory guard.**

Measured against a production build (`next build` + `next start`), with
process-lifetime counters revealing actual loader invocations:

| Property | Result |
| --- | --- |
| Build with `unstable_cache`, no `cacheComponents` | **passes**, no warnings |
| Route map | 70 routes = the 69-route baseline + the proof route; no other change |
| Cross-request persistence | **yes** — loader ran once across repeated requests; `cachedAt` unchanged |
| Serialisable payload accepted | **yes** — `payloadHasMap: false`; slug index rebuilt to 35 entries (30 canonical + 5 legacy) |
| `revalidateTag("catalogue", "max")` invalidation | **yes** — loader re-ran |
| One tag invalidating several entries | **yes** — both the healthy and degraded entries refreshed from the single `catalogue` tag |
| Degraded snapshot caching | **cached identically to a healthy one** |

Three findings that change how M2B and M4 must be written:

1. **`revalidateTag` now takes two arguments.** In 16.2.11 the signature is
   `revalidateTag(tag: string, profile: string | CacheLifeConfig)`. The
   single-argument form no longer typechecks. `updateTag(tag)` is the
   single-argument variant, documented for read-your-own-writes inside Server
   Actions.

2. **`revalidateTag` cannot be called during a render.** It throws:
   *"used `revalidateTag catalogue` during render which is unsupported"*.
   Invalidation must live in a Server Action or Route Handler. Admin mutations
   already are Server Actions, so M4 has a valid home for it.

3. **Invalidation is stale-while-revalidate, not read-your-own-writes.** The
   request immediately after `revalidateTag` was still served the previous
   payload — `cachedAt` was unchanged while the loader re-ran — and the new
   value appeared on the *following* request. M4 must use `updateTag` in the
   admin Server Action if an administrator has to see their own change
   immediately after saving.

**The mandatory guard.** `unstable_cache` caches whatever the loader returns and
knows nothing about snapshot authority. A degraded snapshot — the static
fallback served because the database was unreachable — was cached for the full
lifetime exactly like authoritative data. A ten-second database blip would
therefore freeze the static catalogue for the whole authoritative lifetime.
M2B must branch on `snapshot.authority` **before** writing to the cache, never
after.

## Layer C — Cache Components

**Result: reject for this transformation.**

`cacheComponents: true` plus a minimal `use cache` catalogue module using
`cacheTag` and `cacheLife`. The build **never completed**, so there is no route
map to compare against the 69-route baseline. Three distinct blockers surfaced,
each only after the previous one was patched:

**1. Route segment config is incompatible.** `export const dynamic` is rejected
outright. Four files use it:

| File | Why it matters |
| --- | --- |
| `src/app/admin/layout.tsx` | the admin section's force-dynamic guarantee |
| `src/app/api/readiness/route.ts` | a readiness probe must never be cached |
| `src/app/api/health/route.ts` | same |
| `src/app/api/internal/jobs/run/route.ts` | a job runner; caching it would be dangerous |

**2. The shared footer breaks every prerendered route.** With those four
removed, the build failed on `new Date().getFullYear()` in
`src/components/footer.tsx` — the copyright year. The footer is in the root
layout, so this failed `/account/addresses`, `/brands/[slug]`,
`/products/[slug]` and every other prerendered route. Under Cache Components,
reading the current time in a Server Component requires first reading Request
data (`cookies()`, `headers()`, `connection()`, `searchParams`) or moving the
expression into a Client or Cache Component.

**3. The cascade reaches pricing policy.** With the footer patched, the build
failed on `src/lib/products.ts:87` — `new Date()` inside
`getPurchaseEligibility`, which every product card calls. Making that legal
means restructuring the price-staleness check.

That third blocker is decisive on its own. `getPurchaseEligibility` is the
function the M5 four-concept pricing split exists to rewrite, and M2A is
explicitly forbidden from touching pricing policy. Adopting Cache Components
would force M2 to make an M5 decision early, under build pressure, with no
tests for the new semantics.

Measured against the selection rule, Cache Components fails on four of the seven
prohibitions: broad unrelated route changes, admin rendering changes, API route
changes, and expanding M2 beyond catalogue cutover.

**This is not a verdict on Cache Components.** It is the right long-term
direction and the cascade is mostly this application carrying pre-Next-16
idioms. It should be revisited as its own phase after M5 has settled the pricing
clock, with `connection()` and Suspense boundaries designed deliberately rather
than added to make a build pass.

---

## Proposed production caching policy

For M2B to implement. Nothing below is wired up in M2A.

| Snapshot | `authority` | Cache | Lifetime | Tag |
| --- | --- | --- | --- | --- |
| Database catalogue | `database` | `unstable_cache` | `revalidate: 300` (5 min) | `catalogue` |
| Authoritative empty (`no_published_products`, `all_products_invalid`) | `database` | `unstable_cache` | `revalidate: 300` | `catalogue` |
| Static bootstrap, unconfigured (`database_not_configured`) | `static_bootstrap` | `unstable_cache` | `revalidate: 3600` | `catalogue` |
| Static bootstrap, unseeded (`database_empty`) | `static_bootstrap` | `unstable_cache` | `revalidate: 60` | `catalogue` |
| **Degraded** (`database_unavailable`, `configuration_check_failed`, `query_failed`) | `static_degraded` | **never cached** | — | — |

Reasoning:

- **5 minutes for authoritative data.** Short enough that a missed invalidation
  self-heals quickly, long enough to be worth having. Admin invalidation (M4)
  is the primary freshness mechanism; the lifetime is the safety net.
- **Authoritative-empty is cached like any other authoritative answer.** "No
  published products" is a real answer, not a failure, and re-querying every
  request for an empty result is pure cost. M4's invalidation makes the first
  publish appear promptly.
- **An unconfigured database is a stable condition,** so an hour is fine —
  local development, demos, unconfigured previews.
- **An unseeded database is a transient condition** that ends the moment
  seeding runs, so 60 seconds keeps the bootstrap from lingering.
- **Degraded snapshots are never persisted.** This is the guard from Layer B.
  A brief outage must not pin the static catalogue in place for the
  authoritative lifetime. The repository's own 30-second per-adapter cooldown
  already prevents re-dialling a dead database on every render, so skipping the
  cross-request cache costs little and recovers immediately.
- **Request memoisation applies to every case,** including degraded: one load
  per render regardless of outcome.

### Cache tags

**Start with one tag: `catalogue`.** Do not add per-product, per-category,
per-brand, homepage, comparison, builder or sitemap tags yet.

Thirty products fit in a single cache entry. A global invalidation after an
administrative mutation costs one catalogue reload; maintaining seven
overlapping tag families costs correctness — every mutation has to reason about
which entries it touched, and a missed tag is a stale storefront that nobody
notices. Layer B measured a single tag invalidating multiple derived entries
correctly, so one tag is sufficient.

M2B should therefore begin with one global `catalogue` tag plus targeted
`revalidatePath` for routes that need immediate path-level refresh. Split the
tag only when a measurement — not an intuition — shows the global invalidation
is too expensive.

## Consequences

- `unstable_cache` is deprecated. This is transitional debt with a named exit:
  revisit Cache Components after M5.
- M2B must branch on `authority` before caching. That is the single most
  important line in this document.
- M4 must call invalidation from a Server Action or Route Handler, use the
  two-argument `revalidateTag`, and use `updateTag` where an administrator must
  see their own write immediately.
- The cached payload is versioned (`CatalogueCachePayload.version`), so a shape
  change can reject stale entries rather than deserialise them wrongly.
