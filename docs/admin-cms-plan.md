# Admin CMS plan

Status: **plan only — no implementation has started.**

---

## 1. The architectural problem this plan must solve first

### 1.1 `repository.ts` is dead code

`src/data/repository.ts` implements the database-backed `listProducts()` /
`getProduct()` that `docs/architecture.md` describes as the storefront's data
source. **No storefront route imports it.** Verified by exhaustive grep:

| Importer of `@/data/catalog` (static) | Kind |
| --- | --- |
| `app/page.tsx`, `app/products/page.tsx`, `app/products/[slug]/page.tsx` | server |
| `app/categories/[slug]/page.tsx`, `app/brands/page.tsx`, `app/brands/[slug]/page.tsx` | server |
| `app/downloads/page.tsx`, `app/sitemap.ts`, `app/api/orders/route.ts` | server |
| `app/cart/page.tsx` | **client** |
| `lib/cart-store.ts`, `lib/compare-store.ts` | **client** |
| `components/header.tsx`, `product-search.tsx`, `product-card.tsx`* | **client** |
| `cart-drawer.tsx`, `compare-tray.tsx`, `compare-toggle.tsx`, `comparison-page.tsx` | **client** |
| `add-to-cart.tsx`, `product-actions.tsx`, `mobile-product-bar.tsx` | **client** |
| `checkout-form.tsx`, `auth-order-summary.tsx`, `recently-viewed.tsx` | **client** |
| `system-builder.tsx` | **client** |

\* `product-card.tsx` imports types only, but is a client component.

Importers of `@/data/repository`: **none.**

Consequences, all currently true in production:

1. An admin can edit a product and **nothing changes on the storefront.** The
   existing `revalidatePath("/products/…")` calls in `admin/actions.ts` revalidate
   routes that read a compile-time constant, so they are no-ops.
2. The full catalogue — every spec, highlight and document path — is serialised
   into the **client** bundle by 16 client modules.
3. `docs/architecture.md` §Data flow item 4 is factually wrong, and
   `docs/admin-guide.md` still describes the admin as "deliberately read-only",
   which it no longer is.

### 1.2 The database path is not yet a safe swap

`repository.ts` cannot simply be wired in as-is:

| Issue | Detail |
| --- | --- |
| Silent empty store | `listProducts()` returns `[]` when `DATABASE_URL` is set but no rows are published — the storefront would render an empty catalogue rather than falling back |
| Feature loss | `relatedProductIds`, `builderCompatibleIds`, `builderExclusions`, `useCases` are hard-coded `[]` in the DB path, so related products and the system builder silently lose data |
| Spec groups discarded | specs are flattened to `Record<string,string>`, dropping `productSpecs.groupName`, which the product page needs for grouped tables |
| No caching | every call issues 5 queries with no `unstable_cache` / `cacheTag`, and `getProduct()` calls `listProducts()` up to twice |
| Client boundary | client stores cannot call it at all — they need a serialisable snapshot passed down or a lookup endpoint |

### 1.3 What is already correct and must not regress

`/api/orders` re-reads prices from the **database** (`trustedProducts`) and
recomputes totals server-side, ignoring both the client payload and the static
catalogue. Money is already canonical against Postgres. **This is the one place
the static/DB split is already right, and it must be preserved exactly.**

Note the coupling it relies on: the cart stores the static `product.id`, and the
API looks that value up as `products.slug`. Static `id` === DB `slug` is a load-
bearing invariant for checkout.

### 1.4 Target architecture

```
                 ┌─ DATABASE_URL set ──► Neon (canonical)
listProducts() ──┤                        + unstable_cache, tags: catalogue, product:<slug>
                 └─ unset OR zero rows ─► src/data/catalog.ts (deterministic fallback)
```

- One `Product` shape, one repository, used by storefront **and** admin reads.
- Server Components call the repository; client stores receive a **minimal
  serialisable projection** (id, slug, model, title, price, stock, one image) —
  not the full catalogue — which also fixes §1.1 consequence 2.
- Zero published rows falls back to static rather than rendering an empty shop,
  and logs loudly.
- Admin mutations call `revalidateTag("catalogue")` + `revalidateTag(`product:${slug}`)`
  plus `revalidatePath` for `/`, `/products`, `/products/[slug]`, `/categories/[slug]`,
  `/brands/[slug]`, and the relevant `/admin` routes.

---

## 2. Current admin capability matrix

| Capability | Server action | UI | Audit | Status |
| --- | --- | --- | --- | --- |
| Update product core fields | `updateProductAction` | `admin-product-editor` | yes | **exists** |
| Update inventory qty / lead time | `updateInventoryAction` | same | yes | **exists** |
| Update order fulfilment status | `updateOrderStatusAction` | `admin-order-status-form` | yes | **exists** |
| Update staff role | `updateStaffRoleAction` | `admin-role-form` | yes | **exists** |
| Create product | — | — | — | missing |
| Duplicate product | — | — | — | missing |
| Archive (as a distinct guarded action) | via status select | — | partial | weak |
| Publishing validator | — | — | — | missing |
| Protected draft preview | — | — | — | missing |
| Image upload / reorder / alt / primary / delete | — | read-only list | — | missing |
| Specification CRUD / group / reorder | — | read-only list | — | missing |
| Highlight CRUD / reorder | — | not shown | — | missing |
| Document upload / verify / delete | — | read-only list | — | missing |
| Compatibility management | — | — | — | missing |
| Price history | — | — | — | missing |
| Inventory adjustment history | — | — | — | missing |
| Unsaved-changes warning / toast | — | inline message only | — | missing |

Authorisation is **already solid** and should not be rewritten. Note the brief
names `src/lib/admin-auth.ts` / `resolveAdmin()`; the real implementation is
`src/lib/authz.ts` with `getSessionUser()` / `requireCapability()` / `authorize()`
and a 5-role × 7-capability matrix. The existing design is stronger than a
single `resolveAdmin()` — roles are re-read from the database on every call, so
a revoked role takes effect immediately, and `ADMIN_EMAILS` is a bootstrap
allowlist rather than the primary gate. **Keep it; do not introduce a second
auth path.**

`withCapability()` in `admin/actions.ts` already forces authorise → DB-check →
audit on every mutation. All new actions go through it unchanged.

---

## 3. Blockers for the image/document work

Three concrete prerequisites, none of which exist today:

1. **`@vercel/blob` is not a dependency.** It must be added.
2. **CSP blocks Blob images.** `next.config.ts` sets
   `img-src 'self' data: blob:`. Vercel Blob serves from
   `https://*.public.blob.vercel-storage.com`, which is not permitted. The CSP
   must gain that host (`blob:` is the JS Blob scheme, not Vercel Blob — an easy
   and dangerous thing to conflate).
3. **`next/image` has no `remotePatterns`.** `next.config.ts` defines no
   `images` config, so remote Blob URLs will be rejected by the image optimiser.

Upload actions must additionally: authorise before reading the body, validate
MIME **and** extension, enforce a size cap, generate the storage path
server-side (never trust the client filename), and record an audit event.

---

## 4. Schema gaps

The existing normalised schema is reused. These additions are required by the
brief and do not exist:

| Need | Gap |
| --- | --- |
| Price history + change reason | no table |
| Inventory adjustment history + type/reason | no table |
| Image primary flag, dimensions | `productImages` has `url/alt/position` only |
| Compatibility integrity | `productCompatibility` has no unique constraint and no self-reference guard |
| Price source state / verification date | `priceSourceStatus` + `priceVerifiedAt` exist — **reuse, do not duplicate** |
| Warning colour role | admin hard-codes `amber-50/200/800` outside the token system |

`compareAtPriceInclGstPaise` / `compareAtLabel` / `seoTitle` / `seoDescription` /
`legacySlugs` all already exist and are simply unused by the editor UI.

---

## 5. Pricing input conversion

The brief requires the admin to enter **rupees** and the server to convert to
paise. Today the editor asks for raw paise
(`"Selling price (paise, GST inclusive)"`, hint `"₹1,999.00 is 199900"`) and the
Zod schema accepts an integer directly.

The integer-paise storage safeguard is correct and stays. The change is at the
boundary only: parse a rupee string → validate 2-decimal precision → multiply by
100 → integer. Existing guards to preserve verbatim:

- verified status requires a non-null selling price
- selling price may not exceed recorded MRP
- `priceVerifiedAt` is re-stamped when a verified price actually changes

---

## 6. Publishing validator

Blocking checks before `status → published`:

unique exact model · valid slug · brand · category · short and long description ·
official source URL · **at least one image** · meaningful specifications ·
warranty · coherent price state · coherent stock state · public documents are
model-verified · SEO title/description fall back to title/short description.

Related invariants: a published product may not lose its final image; archived
products remain readable for historical order references; only
`modelVerified` documents are ever exposed publicly (already enforced in
`repository.ts`).

---

## 7. Dashboard

`getOverviewMetrics()` already returns only real values and returns `null`
(rendering an explicit "not connected" state) rather than sample figures when
the database is absent. That principle is kept.

Present: orders today, revenue today, paid orders, awaiting dispatch, failed
payments, low stock, recent orders, recent customers.

To add, all from real data: orders awaiting payment, paid awaiting processing,
expiring reservations, stale prices (`priceVerifiedAt` beyond the freshness
window), failed notifications (`orders.emailStatus` / `whatsappStatus`), new
enquiries, recent audit events.

One caveat to fix while there: the low-stock query uses
`lte(inventory.quantityAvailable, 5)` where the column is nullable, so
untracked-stock rows are excluded by SQL `NULL` semantics. That is arguably
correct but is currently accidental rather than stated.

---

## 8. Security invariants to carry unchanged

- Never hardcode an administrator password; `ADMIN_EMAILS` stays server-only.
- No mutation without `withCapability()`; no client-asserted role.
- Zod-validate every input; read fields explicitly from `FormData` (the existing
  actions already avoid pass-through objects, so an extra browser field cannot
  set a column) — keep that discipline.
- `recordAudit()` on every meaningful change.
- Payment state remains owned by the verified Razorpay webhook; fulfilment staff
  can never mark an order paid (already enforced).
- Never expose supplier cost, private price evidence, tokens, credentials, the
  admin allowlist, audit internals or customer data to the client.
- Admin routes stay `noindex` (already set in `admin/layout.tsx`).

---

## 9. Admin shell

`admin/layout.tsx` already renders its own sidebar, mobile nav, identity, role
label, sign-out and storefront link, and gates on `requireCapability("admin.view")`.

**However**, `app/layout.tsx` is the root layout and wraps *every* route —
including `/admin` — in the public `<Header>`, `<Footer>`, `<CartDrawer>`,
`<CompareTray>`, `<CookieConsentBanner>` and `<CookiePreferencesModal>`. So the
storefront chrome **does** currently render around the admin UI, contrary to the
brief.

Fix: route groups — `src/app/(storefront)/` carrying the public chrome and
`src/app/(admin)/` carrying only the admin shell. This moves many files but
changes **no URLs**, which is why it belongs in its own commit, separate from
any visual work.
