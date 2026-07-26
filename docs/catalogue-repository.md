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

Filled from the static catalogue by slug (legacy slugs included) because the
schema has no representation at all:

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

Codes: `database_not_configured` (debug), `database_unavailable`, `query_failed`
(error), `database_empty`, `no_published_products`, `product_mapping_failed`,
`product_excluded`, `relation_discarded`, `all_products_invalid` (warn).

## Schema limitations

None require a migration; each is handled in mapping.

| Limitation | Handling |
| --- | --- |
| No storage for `useCases`, `relatedProductIds`, `builderExclusions` | static enrichment |
| `product_documents` has no `position` | ordered by type, then title, then id |
| `product_images` has no `is_primary` | primary = lowest position |
| `price_source_status` is snake_case, the public contract is kebab-case | normalised in mapping |
| `Product.specs` is a flat record | groups preserved additively on `CatalogueProduct` |
| No subcategory or form-factor column | not present in the public contract either |

## Tests

`tests/unit/catalogue-repository.test.ts` — 41 deterministic tests covering
fallback paths, database preference, partial validity, ordering, grouping, field
authority, enrichment, relation repair, integrity, price handling, logging
safety, bounded access, failure memoisation and selector consistency.

`tests/unit/catalogue-server-boundary.test.ts` — 5 tests enforcing the client
boundary, including a non-vacuity control proving the import walk resolves.

`tests/integration/catalogue-repository.test.ts` — 4 tests against real
PostgreSQL. Requires `TEST_DATABASE_URL`; skips with an explicit reason without
it and never falls back to `DATABASE_URL`.

## What M2 needs from this

- Wrap `getCatalogue` in `unstable_cache` with tags `catalogue`,
  `product:<slug>`, `category:<slug>`, `brand:<slug>`.
- Use `snapshot.reason` to avoid caching a static-fallback snapshot as though it
  were authoritative.
- Point the 8 server routes and the 2 homepage resolvers at the selectors above.
- Decide rendering mode per route; `/sitemap.ts` included.
