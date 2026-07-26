# Catalogue repository (M1)

The canonical server-side catalogue abstraction. M1 makes it correct and fully
tested; it does **not** connect it to any route. No storefront, checkout, admin,
pricing or visual behaviour changed — `src/data/repository.ts` is still imported
by zero application modules, exactly as it was before.

M2 performs the route cutover and adds caching.

## Modules

| File | Responsibility | Server-only |
| --- | --- | --- |
| `src/data/repository.ts` | Public API, source selection, diagnostics | yes |
| `src/data/catalogue-db-adapter.ts` | Drizzle implementation of the database seam | yes |
| `src/data/catalogue-mapping.ts` | Row → `CatalogueProduct` mapping and ordering | no |
| `src/data/catalogue-integrity.ts` | Value normalisers, fatal checks, relation repair | no |
| `src/data/catalogue-static.ts` | Static fallback catalogue and enrichment index | no |
| `src/data/catalogue-types.ts` | Shared serialisable types | no |

`repository.ts` and `catalogue-db-adapter.ts` reach `@/db/client` and must never
enter a client bundle. `tests/unit/catalogue-server-boundary.test.ts` walks the
import graph of every `"use client"` module and fails if either becomes
reachable. `"use server"` modules terminate the walk — Next.js replaces those
imports with server references, so nothing behind them ships to the browser.

## API

```ts
getCatalogue(options?):                 Promise<CatalogueSnapshot>
listProducts(options?):                 Promise<CatalogueProduct[]>
getProduct(slug, options?):             Promise<CatalogueProduct | undefined>
listProductsByCategory(slug, options?): Promise<CatalogueProduct[]>
listProductsByBrand(slug, options?):    Promise<CatalogueProduct[]>
listCategories(options?):               Promise<CatalogueTaxonomyEntry[]>
listBrands(options?):                   Promise<CatalogueTaxonomyEntry[]>
```

`getCatalogue()` is the single load path; every other function is a projection
over one snapshot, so route-specific filtering never becomes a second query
path. M2 wraps `getCatalogue` once, with tags, rather than caching per route.

`options` is the dependency-injection seam: `{ adapter, logger, now,
failureCooldownMs }`. Tests inject a fake adapter and run with no PostgreSQL.

### Changed signatures

| Before | After | Why |
| --- | --- | --- |
| `listProducts(): Promise<Product[]>` | `listProducts(options?): Promise<CatalogueProduct[]>` | `CatalogueProduct` is a strict superset of `Product`; `options` adds the test seam |
| `getProduct(slug): Promise<Product \| undefined>` | `getProduct(slug, options?): Promise<CatalogueProduct \| undefined>` | same |

`src/lib/products.ts` is unchanged. The grouped and ordered data the database
holds is carried on `CatalogueProduct` instead of widening the shared public
contract, so client components are unaffected by M1 and by M2's cutover.

`CatalogueSnapshot` exposes `source` and `reason` so M2 can choose a cache
policy — a static-fallback snapshot should not be cached as though it were
authoritative data.

## Source selection

| Condition | Source | `reason` |
| --- | --- | --- |
| `DATABASE_URL` absent | static | `database_not_configured` |
| Client initialisation throws | static | `database_unavailable` |
| Catalogue query throws | static | `query_failed` |
| No products at all | static | `database_empty` |
| Products exist, none published | static | `no_published_products` |
| ≥1 product survives integrity validation | **database** | `database` |
| 0 products survive integrity validation | static | `all_products_invalid` |

A configured-but-empty database serves the full static catalogue rather than an
empty shop. A partially malformed database keeps its valid products: only the
irrecoverable ones are excluded, and each exclusion is logged.

After a connection failure the repository stops re-dialling for 30 seconds, so a
down database costs one attempt rather than one per server-component render.
Query failures are not memoised — they may be transient.

## Field authority

### Database-authoritative

Never overwritten by static values when a usable database product exists:

`slug`, `legacySlugs`, `model`, `title`, `shortDescription`, `longDescription`,
`brand`, `brandSlug`, `category`, `categorySlug`, publication state,
`stockStatus`, `sellingPriceInclGstPaise`, `mrpInclGstPaise`,
`compareAtPriceInclGstPaise`, `compareAtLabel`, `gstRateBasisPoints`,
`gstIncluded`, `priceVerifiedAt`, `priceSourceStatus`, `officialSourceUrl`,
`verifiedAt`, `warrantySummary`, images, documents, specifications, highlights.

### Static enrichment

Filled from the static catalogue because the schema has no representation at
all:

| Field | Reason |
| --- | --- |
| `useCases` | no column or table |
| `relatedProductIds` | no column or table |
| `builderExclusions` | no column or table |

Conditional — the schema *does* represent these, so enrichment applies only when
the database holds nothing:

| Field | Enriched when |
| --- | --- |
| `builderCompatibleIds` | `product_compatibility` has no usable row for the product |
| `images` | `product_images` has no row for the product |

Each product reports what it used in `enrichedFields`. A product created in
admin with no static counterpart is fully valid and receives `[]` for every
enrichment field — enrichment never invents relationships or content, and never
touches pricing, publication or inventory.

The `builderCompatibleIds` rule is transitional: nothing writes
`product_compatibility` today, so every product currently falls through to
static enrichment. When M6 gives admin a compatibility editor, the database side
takes over automatically.

### Identity resolution

A database product is matched to its static counterpart by exact identifiers
only. Precedence is strict and each step must resolve to exactly one static
product:

| Step | Match | `enrichmentSource` |
| --- | --- | --- |
| 1 | database canonical slug ≡ static canonical slug | `canonical_slug` |
| 2 | any exact legacy-slug match — database slug ∈ static legacy slugs, database legacy slug ≡ static canonical slug, or the two legacy sets intersect | `legacy_slug` |
| 3 | `normalizeModel(model)` equality | `model` |
| 4 | nothing matched | `none` |

Two or more distinct static candidates at step 2 or 3 is an **ambiguity**, never
a guess: no enrichment is applied, `enrichmentSource` is `ambiguous`, a warning
is emitted, and the database product is kept in full. One static product reached
by several routes is a match, not a collision.

Model comparison uses `normalizeModel` — the same normalisation
`validateProductCatalogue` uses to prove models are unique, so it tolerates case
and separator differences from admin input. Product names, titles and
descriptions are never compared; there is no fuzzy matching anywhere.

Resolution provenance lives on `CatalogueProduct.enrichmentSource` and in
diagnostics. It is `null` in static mode, where enrichment does not apply, and
never reaches the browser. The public `id` remains the database slug regardless
of how enrichment resolved, so the checkout invariant is unaffected.

Before M1.1 the lookup used a single flat map keyed by the database canonical
slug alone. A product renamed in admin lost its enrichment silently, and because
canonical and legacy keys shared one namespace with unconditional writes, a
legacy slug could overwrite a canonical entry. The current static catalogue has
no such collision, so the output was correct — but the structure permitted a
silent wrong answer.

### Image fallback — transitional

Order: database image rows → static counterpart images → placeholder. A row is
usable only if its URL is root-relative or absolute `http(s)`; anything else is
discarded so no structurally broken URL reaches a page. "No valid database row"
and "no row at all" are treated identically.

**This is a migration policy, not the end state.** While admin cannot yet manage
images, an empty `product_images` collection means "not migrated yet", so
restoring the static images is right. Once image administration is live, an
intentionally empty collection should mean "show the placeholder" — an operator
who deletes every image expects them gone, not silently replaced by legacy
static assets. M6 owns that switch. It needs no schema column: the distinction
is whether image administration is active, not a new field.

### Derived

| Field | Derivation |
| --- | --- |
| `id` | `products.slug` — **not** the uuid (see below) |
| `imageModel` | `products.model` |
| `specs` | flattened from `specGroups`, first label occurrence wins |
| `searchText` | title, model, brand, category, description, highlights, use cases, specs |
| `inventory` | `inventory.quantity_available - reserved`, floored at 0 |

`inventory` is informational. It never alters `stockStatus`, which stays
database-authoritative on the product row.

### The id ↔ slug invariant

The public `id` is the slug in both modes. The cart stores `product.id`, and
`checkout-orchestrator.ts` resolves that value against `products.slug`. The
previous repository mapped `id` to the uuid primary key, which would have broken
every database-backed checkout the moment a route started using it. The uuid is
still available as `databaseId` for admin and audit correlation.

## Integrity policy

**Fatal — excludes that product only**, never the catalogue:

missing slug, model or title; missing brand or category; missing short
description; missing official source URL; unusable `verified_at`; unrecognised
`stock_status` or `price_source_status`; `gst_included` not true; invalid GST
rate.

**Repaired — the product survives, a diagnostic is emitted:**

| Problem | Repair |
| --- | --- |
| Structurally invalid price | set to `null`, never fabricated |
| Compare-at label unrecognised | label *and* compare-at price both discarded |
| No image anywhere | `/images/products/placeholder.svg` |
| Relation to a missing product | reference filtered out |
| Duplicate relation | deduplicated, first valid order kept |
| Self-reference | removed |
| Missing spec group | `General` |
| Duplicate spec positions | tiebroken on label |
| Blank spec label, image URL or document title | row dropped |

A missing or invalid price stays explicitly `null`. M1 deliberately implements
no pricing policy: the M5 four-concept split decides what an unpriced product
means. The 2026-08-21 stale-price cliff is untouched by M1.

## Query strategy

Seven queries per catalogue load, independent of catalogue size:

1. `products ⋈ brands ⋈ categories WHERE status = 'published'`, ordered by slug
2–7. `product_images`, `product_documents`, `product_specs`,
`product_highlights`, `product_compatibility`, `inventory` — each
`WHERE product_id IN (…)`, issued together with `Promise.all`

Child rows are grouped into maps once, so mapping is linear rather than the
per-product array scans the previous implementation used. An eighth `count(*)`
runs only when the published query returns nothing, to tell an empty database
apart from one with no published rows.

`getProduct` resolves from the loaded snapshot — canonical slug, then legacy
slug, then exact model — and issues no additional query.

## Logging

Diagnostics carry a code, a safe message and, where relevant, the public product
id. Failure classification and the originating error's constructor name are the
only things recorded from a driver error; messages and stacks are dropped
because they routinely embed the connection string. Nothing reaches the browser.

| Code | Level |
| --- | --- |
| `database_not_configured` | debug |
| `enrichment_matched_legacy_slug` | debug |
| `enrichment_matched_model` | debug |
| `enrichment_absent` | debug |
| `image_placeholder_applied` | debug |
| `database_unavailable` | error |
| `configuration_check_failed` | error |
| `query_failed` | error |
| `database_empty` | warn |
| `no_published_products` | warn |
| `product_excluded` | warn |
| `product_mapping_failed` | warn |
| `relation_discarded` | warn |
| `image_row_discarded` | warn |
| `enrichment_ambiguous` | warn |
| `all_products_invalid` | warn |

The debug tier is deliberate: a product created in admin has no static
counterpart and no images yet, and neither is a defect. Warnings are reserved
for data that is genuinely malformed or ambiguous, so log volume stays
proportional to real problems.

`isConfigured()` is called inside the error boundary. If it throws — a broken
environment read, or arbitrary work in a custom adapter — the repository serves
the static catalogue under reason `configuration_check_failed`, applies the
failure cooldown, and records only the error's constructor name. `getCatalogue`
never rejects.

The cooldown is keyed by adapter instance rather than held in a single module
variable, so a failing adapter cannot suppress an unrelated one.

## Schema limitations

None require a migration; each is handled in mapping.

| Limitation | Handling |
| --- | --- |
| No storage for `useCases`, `relatedProductIds`, `builderExclusions` | static enrichment |
| `product_documents` has no `position` | ordered by type, then title, then id |
| No storage for a product's static counterpart identity | resolved by exact slug/model, never persisted |
| `product_images` has no `is_primary` | primary = lowest position |
| `price_source_status` is snake_case, the public contract is kebab-case | normalised in mapping |
| `Product.specs` is a flat record | groups preserved additively on `CatalogueProduct` |
| No subcategory or form-factor column | not present in the public contract either |

## Tests

`tests/unit/catalogue-repository.test.ts` — 56 deterministic tests covering
fallback paths, database preference, partial validity, ordering, grouping, field
authority, enrichment resolution end to end, relation repair, integrity, price
handling, the image fallback chain, the configuration-check boundary, logging
safety, bounded access, failure memoisation and selector consistency.

`tests/unit/catalogue-enrichment-resolution.test.ts` — 10 tests for the
resolution hierarchy against a synthetic catalogue. The real catalogue contains
no ambiguous identity by construction, so precedence and ambiguity can only be
exercised with substituted data.

`tests/unit/catalogue-server-boundary.test.ts` — 5 tests enforcing the client
boundary, including a non-vacuity control proving the import walk resolves.

`tests/integration/catalogue-repository.test.ts` — 4 tests against real
PostgreSQL. Requires `TEST_DATABASE_URL`; skips with an explicit reason without
it and never falls back to `DATABASE_URL`.

## What M2 needs from this

- Choose a cache strategy (below) and wrap `getCatalogue` — the single load path
  — with tags `catalogue`, `product:<slug>`, `category:<slug>`, `brand:<slug>`.
- Use `snapshot.reason` to avoid caching a static-fallback snapshot as though it
  were authoritative. A `database_unavailable` or `configuration_check_failed`
  snapshot in particular must not be cached with a long lifetime, or one bad
  minute freezes the fallback catalogue in place.
- Point the 8 server routes and the 2 homepage resolvers at the selectors above.
- Decide rendering mode per route; `/sitemap.ts` included.

### Cache strategy decision — deferred to M2

No caching is implemented in M1.1: no `cacheComponents`, no `unstable_cache`, no
invalidation calls. M2 must choose between two strategies on the evidence of an
isolated experiment against current Next.js 16 behaviour, not in advance.

**Strategy A — Cache Components.** `use cache`, `cacheTag`, `cacheLife`,
`updateTag`, `revalidateTag(tag, "max")`. Requires `cacheComponents: true`,
which is a global switch: it changes how the whole app treats dynamic APIs and
prerendering, not just the catalogue. Adopting it demands verification of the
route map, per-route rendering modes, build output and browser behaviour before
it can be considered safe.

**Strategy B — the previous cache model.** The existing compatible data-cache
API, without enabling Cache Components globally. Select this if enabling Cache
Components changes unrelated application behaviour or expands M2 beyond its
intended scope.

The M0 baseline route map — 69 routes with their rendering modes, unchanged
through M1 and M1.1 — is the reference for judging whether Strategy A causes a
regression.
