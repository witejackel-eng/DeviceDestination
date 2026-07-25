# Mainline delta audit (Phase 0B)

Audited: 2026-07-25 · Worktree `C:\dev\DeviceDestination-mainline` ·
Branch `feat/feedforge-mainline-v2` · HEAD `9386216` (= `origin/main`).

Supersedes the earlier Phase 0 audit, which was performed against `03b520e`
and is now stale by 17 commits and 311 changed files. Where this document and
`feedforge-reference-audit.md` disagree, this document wins for architecture;
the reference audit remains valid for the FeedForge measurements themselves.

No application behaviour was changed during this audit.

---

## 1. Baseline validation

| Command | Result |
| --- | --- |
| `npm ci` | pass — 639 packages |
| `npm run lint` | **FAIL (exit 1)** — 109 problems: 27 errors, 82 warnings |
| `npm run typecheck` | pass |
| `npm run theme:validate` | pass — 179 files |
| `npm run products:validate` | pass — 30 products, 0 defects |
| `npm test` | pass — 13 passed / 5 skipped files; 104 passed / 41 skipped tests |
| `npm run build` | pass — 82 pages, 40s compile |
| `git fsck --full` | clean (one dangling tree from an earlier read-only `merge-tree`) |
| `git status` | clean |

**Pre-existing lint failure on main.** All 27 errors are
`@typescript-eslint/no-explicit-any` inside `tests/helpers/{failure-injection,setup}.ts`
and `tests/integration/*.test.ts`. The 82 warnings are unused imports across
`src/app/admin/actions/*`, `src/lib/{inventory,refunds,shipping,reconciliation,job-dispatcher,checkout-orchestrator}.ts`
and the integration tests. This is a real, currently-red gate that predates any
of this work.

The 41 skipped tests are the database integration suites, which self-skip
without `DATABASE_URL`.

---

## 2. Architecture map

### Routes

70 route files. **No route groups** — a single root `src/app/layout.tsx` wraps
every route, including `/admin`.

Storefront: `/`, `/products`, `/products/[slug]`, `/categories/[slug]`,
`/brands`, `/brands/[slug]`, `/compare`, `/system-builder`, `/downloads`,
`/cart`, `/checkout`, `/quote`, `/support`, `/contact`, `/about`, 8 policy pages,
`/order/[orderNumber]{,/success}`, `/sitemap.xml`, `/robots.txt`.

Account: `/account{,/addresses,/orders,/orders/[orderNumber],/profile}`,
`/login`, `/signup`, `/forgot-password`, `/reset-password`.

Admin (12): `/admin`, `/admin/audit`, `/admin/enquiries{,/[id]}`,
`/admin/inventory`, `/admin/orders{,/[id]}`, `/admin/pricing`,
`/admin/products{,/[id],/new}`, `/admin/quotes{,/[id]}`,
`/admin/settings{,/shipping}`.

API (17): auth, orders, payments/verify, webhooks/razorpay, enquiries,
invoice, account/*, admin/{reconcile,refunds,jobs/[id]/cancel},
checkout/serviceability, internal/jobs/run, health, readiness.

### Layouts — unresolved separation

`src/app/layout.tsx` renders `<Header>`, `<Footer>`, `<CartDrawer>`,
`<CompareTray>`, `<CookieConsentBanner>`, `<CookiePreferencesModal>` around
**everything**. `src/app/admin/layout.tsx` (`force-dynamic`) nests inside it.

Browser-confirmed at `/admin`: public header, footer, a cart control and the
cookie banner all render. Route groups are still required.

### Auth / authz

`src/lib/admin-auth.ts` — `requireAdmin()` / `resolveAdmin()` / `AdminForbiddenError`,
matching the naming the original brief expected. Admin is a **flat boolean**:
`isAdminRole(role)` where role ∈ {`catalogue_manager`, `operations`, `admin`},
OR `isAdminEmail(email)` from `src/lib/env.ts`.

`user_role` enum on main: `customer`, `catalogue_manager`, `operations`, `admin`.
**No `owner` tier**, and no capability matrix.

> Regression vs. the preserved branch: `feat/feedforge-inspired-storefront-admin`
> carried `src/lib/authz.ts` with a 5-role × 7-capability matrix that re-read the
> role from the database on every call. Main's model is simpler but coarser — a
> `catalogue_manager` currently passes the same gate as an `admin` for order and
> settings actions. Worth a deliberate decision, not an accident.

### Catalogue sources

- `src/data/seed-products-source.ts` + `catalogue-expansion.ts` → `src/data/catalog.ts` (30 products)
- `src/data/repository.ts` — database-backed, **imported by nobody**
- `src/data/optimized-image-map.ts` — new on main
- `src/lib/featured-products.ts`, `src/lib/home/hero-products.ts` — resolvers, both static-backed

### Backend infrastructure (new on main, all substantial)

`checkout-orchestrator.ts` (476 lines, saga), `payment-processing.ts`,
`inventory.ts` (reservations + adjustments), `order-state.ts`, `jobs.ts`,
`job-dispatcher.ts`, `reconciliation.ts`, `refunds.ts`, `shipping.ts`,
`settings.ts`, `audit.ts` (with `redactSecrets`), `blob.ts`, `env.ts`,
`admin-alerts.ts`, `account.ts`, `spec-chips.ts`, `modal-layer.ts`.

---

## 3. Static-vs-database — unchanged and slightly worse

**27 modules import `@/data/catalog`. `src/data/repository.ts` is imported by 0.**

| Classification | Count | Files |
| --- | --- | --- |
| Server Component / server module | 8 | `app/page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `categories/[slug]/page.tsx`, `brands/page.tsx`, `brands/[slug]/page.tsx`, `downloads/page.tsx`, `sitemap.ts` |
| **Checkout / payment-critical** | 1 | `lib/checkout-orchestrator.ts` |
| Homepage-specific resolver | 2 | `lib/featured-products.ts`, `lib/home/hero-products.ts` |
| Seed / fallback-only | 1 | `data/repository.ts` |
| **Client Component** | 15 | `app/cart/page.tsx`, `lib/cart-store.ts`, `lib/compare-store.ts`, `components/{add-to-cart,cart-drawer,checkout-form,compare-toggle,compare-tray,comparison-page,mobile-product-bar,product-actions,product-card,product-search,recently-viewed,system-builder}.tsx` |
| Test-only | 0 | — |

The client count is the important one: the full 30-product catalogue — specs,
highlights, document paths — is serialised into the browser bundle. Confirmed in
the browser: `/compare` renders all 30 model names client-side with no network
call.

### Answers to the specific questions

| Question | Finding |
| --- | --- |
| Which routes are compile-time static? | `/` ○, `/products/[slug]` ●, `/categories/[slug]` ●, `/brands/[slug]` ●, `/brands` ○, `/cart` ○, `/checkout` ○, `/downloads` ○, `/system-builder` ○, `/sitemap.xml` ○ |
| Which access the database? | Only `/admin/**`, `/api/**`, `/account/orders/[orderNumber]`, `/order/[orderNumber]`, `/compare` ƒ, `/products` ƒ (dynamic for searchParams, still static data) |
| Is `repository.ts` unused? | **Yes** |
| Do admin mutations reach the storefront? | **No** |
| Cache tags / invalidation? | **No `revalidateTag`, no `unstable_cache`, no `cacheTag`, no `"use cache"`, no `export const revalidate` anywhere.** Only `revalidatePath`, and the sole storefront-facing call — `revalidatePath('/products/${slug}')` in `admin/actions/products.ts` — is a **no-op** because that route reads a compile-time constant |
| Can an empty configured DB render an empty shop? | Yes — `listProducts()` returns `[]` on zero published rows (`repository.ts:26`) |
| Do relations survive DB mapping? | **No.** `repository.ts` hard-codes `useCases: []`, `relatedProductIds: []`, `builderCompatibleIds: []`, `builderExclusions: []`, and flattens specs to `Record<string,string>`, discarding `productSpecs.groupName` and position |
| Static ID ↔ DB slug invariant? | **Intact and load-bearing.** Cart stores `product.id`; `checkout-orchestrator.ts:201` looks it up as `productTable.slug` |

---

## 4. Pricing and checkout

### What is correct and must be preserved

`src/lib/checkout-orchestrator.ts`:

- line 200–201: reads `productTable` `WHERE status='published' AND slug IN (...)` — **database is canonical for money**
- line 207–212: rejects unless price non-null, `priceSourceStatus='verified'`, stock sellable, `priceVerifiedAt` present and within `getPriceMaxAgeDays()`
- line 224–232: recomputes subtotal and included GST server-side, in paise
- client-submitted amounts are never trusted
- the static `catalogue` import is confined to `handleTestModeCheckout()` (dev-only, no Razorpay keys) — the correct boundary

### The 2026-08-21 cliff — still present, now proven

`src/data/catalog.ts:11` `const verifiedAt = "2026-07-22T00:00:00.000Z"` applied
to every product's `priceVerifiedAt`; `siteConfig.pricing.defaultMaxAgeDays = 30`;
`getPurchaseEligibility()` returns `stale_price` beyond that.

Measured against the real code with an injected clock:

```
static catalogue size: 30
2026-07-25  purchasable=30/30  blocked={}
2026-08-20  purchasable=30/30  blocked={}
2026-08-21  purchasable= 0/30  blocked={"stale_price":30}
2026-08-22  purchasable= 0/30  blocked={"stale_price":30}
2026-09-15  purchasable= 0/30  blocked={"stale_price":30}
```

Because `/` and `/products/[slug]` are prerendered from this static data and
`ProductCard` applies the same eligibility check, **the live storefront will show
"Request latest price" on all 30 products from 21 August 2026**, and
`cart-store.addItem()` will silently refuse every product. This is a total
commerce outage on a fixed date, independent of database state.

### Proposed replacement policy (not implemented)

Separate four concepts that are currently conflated in one function:

1. **Display eligibility** — may the product appear in catalogue, search,
   compare, sitemap? Depends only on publication status. Never expires.
2. **Price verification status** — `verified` / `needs_review` / `request_price`,
   plus `priceVerifiedAt`. A *fact*, surfaced honestly ("price last verified
   22 July 2026"), never silently rewritten.
3. **Purchase eligibility (display-time)** — may the Add to cart button be
   enabled? Requires verified status, a price, sellable stock, and freshness —
   but freshness is evaluated **per source**: database rows use their real
   `priceVerifiedAt`; static-fallback rows are treated as *unverified for
   purchase* rather than *expired*, so the shop degrades to "Request price" by
   design rather than by calendar accident.
4. **Server-authoritative checkout pricing** — unchanged. The database lookup and
   recompute in `checkout-orchestrator.ts` stays exactly as it is, and a product
   that cannot be securely priced is rejected with an explicit error.

The key change: stop encoding "static fallback" as "a database row whose
timestamp happens to be old". Give the fallback its own explicit
`priceSourceStatus`/provenance so it browses fully but never claims a verified
purchasable price. Tests must inject the clock and assert 20/21/22 August.

---

## 5. Migrations

| Migration | Contents |
| --- | --- |
| `0000_jazzy_shocker` | initial schema |
| `0001_ancient_sabretooth` | 9 new enums; tables `inventory_adjustments`, `inventory_reservations`, `jobs`, `order_status_events`, `payment_reconciliation_results`, **`product_price_history`**, `quotes`, `quote_items`, `quote_status_history`, `refunds`, `settings`, `shipping_zones`, `shipping_pincode_rules`; enquiry/order/audit columns; `price_source_status` converted to an enum |
| `0002_large_toad_men` | `checkout_attempts`, `payment_webhook_events`, `system_runs`; reservation status states; payment lifecycle timestamps; `jobs.dedupe_key` with a partial unique index |

### Historical `0001_keen_magma` (inspected, **not** copied)

Full contents: `ALTER TYPE "public"."user_role" ADD VALUE 'owner';`

| | |
| --- | --- |
| Already on main | Nothing — main's enum is `customer, catalogue_manager, operations, admin` |
| Genuinely missing | The `owner` enum value |
| Still required? | **Only if** the revised admin plan reinstates a tier above `admin` for settings/role management. Main's flat model does not use it |
| New `0003_*` needed? | **Not for Phase 2.** No data-layer change identified so far requires schema work. If the capability matrix is reinstated later, that phase owns the migration |

Phase 2 is expected to need **no migration**. The gaps it must close are mapping
and caching, not storage.

---

## 6. Admin capability matrix (revised)

| Capability | Status | Notes |
| --- | --- | --- |
| Product creation | **Complete** | `createProductAction`, `/admin/products/new` |
| Product editing | **Complete** | `updateProductAction` |
| Publishing / unpublishing | **Complete** | `updateProductStatusAction` |
| Archiving | **Partial** | status enum supports it; no distinct guarded action or order-reference safeguard |
| Pricing + history | **Complete** | `updateProductPriceAction` writes `product_price_history` |
| Inventory + adjustment history | **Complete** | `recordInventoryAdjustmentAction`; `lib/inventory.ts` writes `inventory_adjustments`; reservations modelled |
| Orders | **Complete** | 8 actions: transition, shipment, delivered, notes, notification retry, refund request |
| Enquiries | **Complete** | 4 actions incl. notification retry |
| Quotes | **Complete** | 4 actions |
| Settings / shipping | **Complete** | 8 actions |
| Audit history | **Complete** | `lib/audit.ts` with `redactSecrets`; `/admin/audit` |
| Dashboard monitoring | **Complete** | real metrics; explicit "not connected" state |
| Staff and permissions | **Partial / weaker than before** | no role-management UI; flat admin check; no `owner` tier; no capability matrix |
| **Image upload and management** | **Missing** | `lib/blob.ts` is written and tested (`tests/unit/blob.test.ts`) with MIME allowlists, signature validation and `safeFilename` — but **`uploadToBlob` is called from nowhere in `src/`**. `product_images` is read, never written |
| **Specifications** | **Missing** | `product_specs` read, never written; no group/reorder UI |
| **Highlights** | **Missing** | `product_highlights` read, never written |
| **Documents** | **Missing** | `product_documents` read, never written; `modelVerified` never set |
| **Compatibility** | **Missing** | `product_compatibility` read, never written |
| Draft preview | **Missing** | no protected preview route |
| Validation before publication | **Missing** | no publishing validator |
| **All catalogue mutations** | **Present but disconnected from the storefront** | every product action calls `revalidatePath` on routes that render from a compile-time constant |

Summary: main is far stronger than the old audit assumed on **orders, payments,
inventory, quotes, settings and audit**, and still missing the **product media /
specs / highlights / documents / compatibility** editing surface. The single
biggest issue is that even the parts that work cannot reach customers.

---

## 7. Design system

Palette is a coherent, restrained system with a renamed token vocabulary:

```
--accent #FF6A00   --background #F7F7F5   --surface #FFFFFF
--text-primary #111214   --dark #111214   --border #DADDE2
--radius-{btn 10, card 14, input, pill, stage, container}   --header-height 70px
```

Brand orange survives as `--accent #FF6A00` (shifted from the older `#FF8A00`);
`validate-theme.mjs` now enforces `#ff6a00/#e85f00/#fff0e6` and **explicitly
bans the old `#ff8a00`, `#ffb347`, `#ffa62b`** — i.e. main deliberately retired
the previous tangerine ramp. `globals.css` is 711 lines.

Typography: **Geist Sans + Geist Body + Geist Mono via `next/font/local`**,
exposed as `--font-display` / `--font-body` / `--font-mono`. Measured H1:
76.8px / line-height 0.98 / weight 650.

Homepage: `CinematicCommerceHero` + 4 sections; 24 product links, 6 category
links, search present; no horizontal overflow; **zero console messages**.
The required journey — search or choose a category → see products → compare or
buy — is intact and reachable above the fold.

### Assessment

| | |
| --- | --- |
| Keep | Token vocabulary and radius scale; restrained palette; warm near-black dark sections; Geist Mono already available for technical values; the hero → categories → products → compare/buy order |
| Refine | Motion tokens live only in TS with no CSS counterpart, so CSS transitions hard-code timings; `modalTiming.stagger` is 40ms against an audited 70–100ms; no `SplitLineReveal`-style masked heading reveal |
| Already satisfies the FeedForge objective | Cinematic hero, editorial section rhythm, near-zero shadow usage, confident large display type |
| Stale / misleading | `src/lib/motion/constants.ts` still ends with *"GSAP owns scroll/hero timelines, and Anime.js owns the DD mark"* — **both packages were removed in `0569a48`**. The comment is now false |
| Lacks ecommerce clarity | Product cards ship the entire catalogue to the client; `/products` has no visible filter form in the rendered output (`hasFilters: false`) despite 30 results |

**No redesign is proposed.** Main's visual work is good enough that the
FeedForge-inspired objective is largely met; the remaining gap is commerce
clarity and motion consistency, not aesthetics.

---

## 8. Typography options

Current: Geist Sans + Geist Body + Geist Mono, self-hosted via `next/font/local`.

| Option | Fit | Performance | Licensing | Verdict |
| --- | --- | --- | --- | --- |
| **1. Retain Geist** | Already coherent with the whole mainline system | Best — local, no extra family, already subset | OFL, shipped in-repo | **Recommended** |
| 2. Plus Jakarta Sans display + body, Geist Mono technical | Closer to FeedForge's optical character, but replaces a system main just built | One extra family; Google-hosted via `next/font/google` | OFL | Not now |
| 3. Plus Jakarta Sans display only, Geist for UI/body | Mixed-family risk; two grotesks at similar weights read as an accident | Two families loaded | OFL | Not now |

**Recommendation: option 1 — retain Geist.** Main's design system, theme
validator and 711-line `globals.css` were all built around it; swapping the
display face would touch every page and force a full visual regression pass for
a marginal difference between two contemporary grotesks. Geist Mono is already
in place for the model-number legibility win, which was the genuinely valuable
half of the earlier typography proposal. Revisit only if a later design phase
finds Geist too neutral for the hero.

---

## 9. Phase 1 salvage matrix (`d379210`, inspected — **not** cherry-picked)

| Change | Classification | Rationale |
| --- | --- | --- |
| `scripts/clean-generated.mjs` | **Still valuable — recreate** | Sandbox-proven safe; the `routes.d*.ts` collision is a Next 16 + tsconfig issue independent of branch. Cheap insurance |
| `package.json` `pretypecheck` / `prebuild` / `clean:generated` | **Still valuable — recreate** | Makes checks deterministic from any state |
| `next.config.ts` `turbopack.root` | **Verify then recreate** | Fixes the inferred-workspace-root warning caused by a stray `C:\Users\Aditya\package-lock.json`. Confirm the warning still occurs on main first |
| `.gitignore` (`.tmp/`, `docs/screenshots/review/`, `reports/`) | **Partially applicable** | Main tracks `reports/` already; re-evaluate per directory rather than reapplying wholesale |
| Design tokens in `globals.css` | **Superseded** | Main has its own complete token system with different names |
| Typography (Plus Jakarta Sans) | **Superseded / deferred** | See §8 — retain Geist |
| Motion constants rewrite | **Partially superseded** | Main has `modalTiming` and a `panel` spring the old branch lacked. The *audited easing/duration values* and CSS↔TS pairing remain worth adding, but as an addition to main's file, not a replacement |
| `validate-theme.mjs` token contract + CSS↔TS easing pairing | **Still valuable — recreate later** | Main's validator only checks colours. Adding a token/motion contract is genuinely useful — but must target main's token names |
| Retired-typeface check | **No longer applicable** | Would need to ban different families |
| Audit documentation | **Documentation-only** | `feedforge-reference-audit.md` stays valid (it measures FeedForge, not this repo). `ui-transformation-plan.md` / `admin-cms-plan.md` are superseded by this document |

Nothing from `d379210` is required by the revised data-layer phase. The build
hygiene items are the only near-term candidates, and they are independent.

---

## 10. Revised phase sequence

Numbering restarts; the old numbers no longer describe this architecture.

| # | Phase | Scope |
| --- | --- | --- |
| **M1** | Repository correctness | Fix `repository.ts`: restore spec groups + ordering, related products, builder compatibility, use cases, documents with `modelVerified`, image order, highlights. Fallback on unconfigured / init failure / read failure / zero published rows / failed integrity checks. Structured logging, no secret leakage, connection-failure memoisation. No route changes yet. Tests only |
| **M2** | Server route cutover + caching | Point the 8 server routes and 2 home resolvers at the repository. Add `unstable_cache` + tags (`catalogue`, `product:<slug>`, `category:<slug>`, `brand:<slug>`). Choose per-route rendering deliberately. Sitemap included |
| **M3** | Client boundary | Replace 15 client imports of the full catalogue with minimal serialisable projections passed from Server Components. Preserve cart, compare, search, system-builder, recently-viewed behaviour. Measure bundle delta |
| **M4** | Admin → storefront invalidation | Every catalogue mutation invalidates the right tags and paths, including sitemap on slug/publication change. Integration tests asserting invalidation |
| **M5** | Pricing policy | Implement the four-concept split from §4. Injectable clock. Boundary tests at 20/21/22 August 2026. Checkout path untouched except to make rejection explicit |
| **M6** | Product CMS gaps | Wire `lib/blob.ts` to real upload actions; images (order, alt, primary, delete), specs (group, reorder), highlights, documents (`modelVerified`), compatibility. Publishing validator, draft preview, guarded archive |
| **M7** | Admin/storefront layout separation | `(storefront)` / `(admin)` route groups. No URL changes |
| **M8** | Storefront hierarchy + motion | Motion CSS tokens paired with TS, masked heading reveal, catalogue filter clarity, fix the stale GSAP/Anime comment |
| **M9** | Hardening | Lint debt (27 errors), accessibility, performance, Playwright updates, deployment |

M1–M2 are the minimum to make admin edits visible to customers. M5 must land
before **21 August 2026**.

---

## 11. Testing plan

Unit / integration, using an injected clock and a disposable database only:

1. DB configured and populated → DB data wins
2. DB unavailable (init throws) → static fallback, error logged, no secret leak
3. DB configured but empty → static fallback, not an empty shop
4. DB returns zero published products → static fallback
5. Static fallback preserves the full public product shape
6. Spec groups and ordering survive mapping
7. Related-product and builder-compatible relations survive mapping
8. Client projections exclude catalogue-wide data
9. Admin update invalidates the expected tags and paths
10. Publication change updates catalogue availability and sitemap
11. Server-side order totals ignore client-submitted prices
12. Product identity and slug invariants intact (`id` ↔ `slug`)
13. Stale-price boundary at 2026-08-20 / 08-21 / 08-22
14. Invalid or missing price cannot be purchased
15. Order records readable after a product is archived
16. Malformed / missing relations degrade safely
17. Repeated DB failure does not retry per component render

Playwright: update only where M2/M3 change route behaviour.

---

## 12. Blockers requiring a decision

1. **Typography** — confirm retaining Geist (§8 recommendation).
2. **Role model** — keep main's flat admin check, or reinstate a capability
   matrix (and with it the `owner` enum value and a `0003_*` migration)?
3. **Lint debt** — `npm run lint` is currently red on main. Fix as part of M9,
   or immediately so that later phases have a green gate?
4. **Pricing policy shape** — confirm the four-concept split in §4 before M5.
5. **Database for testing** — M1/M2 need a disposable Postgres (local Docker or
   a scratch Neon branch). Confirm which, and supply a non-production
   `DATABASE_URL`, or M1–M4 verification stays limited to mocks.
