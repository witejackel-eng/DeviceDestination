# Implementation progress

Branch (recommended): `feat/feedforge-inspired-storefront-admin`

---

## Phase status

| Phase | Goal | Status |
| --- | --- | --- |
| 0 | Audit, test, document, plan | **complete — approved** |
| 1 | Repo hygiene + design tokens + typography | **complete** |
| 2 | Data layer: database canonical, static fallback | not started |
| 3 | Admin shell isolation (route groups) | not started |
| 4 | Motion primitives + library consolidation | not started |
| 5 | Header | not started |
| 6 | Homepage six acts | not started |
| 7 | Catalogue | not started |
| 8 | Product detail | not started |
| 9 | Product CMS — core, media, specs, docs, pricing | not started |
| 10 | Inventory, compatibility, publishing validator | not started |
| 11 | Dashboard | not started |
| 12 | Accessibility, performance, responsive, full test pass | not started |

Branches:

- `chore/checkpoint-existing-implementation` — baseline commit `fe7a21d`
- `feat/feedforge-inspired-storefront-admin` — transformation work, branched from
  the checkpoint

---

## Phase 1 — repository hygiene, typography, design tokens

### Decisions carried in from the Phase 0 review

| Question | Decision |
| --- | --- |
| Uncommitted working tree | Preserved. Committed as baseline `fe7a21d`; nothing reverted. |
| GSAP / Anime.js | Consolidate on Motion, but **remove only in the motion phase**, after reproducing every existing behaviour including the DD logo choreography and confirming reduced-motion parity. Both remain installed and in use. |
| Typography | Plus Jakarta Sans (headings, display, navigation, buttons, body) + Geist Mono (models, SKUs, technical identifiers, order references, admin data), loaded through `next/font`. |
| `DATABASE_URL` | Not assumed to hold the 30 products. Both populated and empty/unavailable states must be implemented and tested in Phase 2. |

### Changed files

| File | Change |
| --- | --- |
| `scripts/clean-generated.mjs` | **new** — removes duplicate Next route-type declarations, keeping the newest; `--all` resets `.next/dev` |
| `package.json` | added `clean:generated`; wired `pretypecheck` and `prebuild` so checks always start from a clean generated state |
| `next.config.ts` | pinned `turbopack.root` to the project directory |
| `src/app/layout.tsx` | Barlow Condensed + Manrope → Plus Jakarta Sans + Geist Mono |
| `src/app/globals.css` | typography roles; colour roles; radius, spacing, elevation, motion and z-index scales; retuned display type scale |
| `src/lib/motion/constants.ts` | duration/easing/stagger tokens matching the CSS custom properties |
| `scripts/validate-theme.mjs` | asserts the token contract, CSS↔Motion easing agreement, and no retired typeface declarations |
| `.gitignore` | excludes `.tmp/`, `docs/screenshots/review/`, `reports/` |

### Notes on specific decisions

**Stale artefact handling.** `tsconfig.json` includes `.next/dev/types/**/*.ts`.
`next dev` writes `routes.d-<HOSTNAME>.ts` and `next build` writes `routes.d.ts`;
when both survive, `PageProps`/`LayoutProps` are declared twice and the older
file's `AppRoutes` union is missing newer routes. OneDrive rehydration made this
recur. `scripts/clean-generated.mjs` keeps only the newest declaration, and
`pretypecheck`/`prebuild` run it automatically. The artefacts themselves stay
untracked. This is what turned the Phase 0 typecheck failure into a pass.

**Display scale retuned.** The previous scale (hero up to `9.25rem`, sections up
to `5.7rem`) was sized for Barlow Condensed. The same numbers in a normal-width
grotesk overflow their containers, so the scale now tracks the audited reference:
hero `clamp(2.5rem, 6.5vw, 5.125rem)` (40 → 82px), section
`clamp(2rem, 3.6vw, 2.625rem)` (32 → 42px).

**Line-height deliberately differs from the reference.** FeedForge uses 1.5 at
every size. That is a stylistic choice, not a requirement of the masked line
reveal — the mask needs `padding-bottom` plus a negative `margin-bottom` for
descenders, which is independent of leading. Tighter leading (1.06 hero, 1.14
section) keeps the primary call to action above the fold on small screens, which
this shop needs and an agency page does not.

**No visible timing changed.** `easings.standard` is live in
`product-gallery.tsx`. Rather than repoint it at the audited
`cubic-bezier(0.4, 0.4, 0, 1)`, that curve was added as a new `sharp` token and
`standard` kept at its existing `cubic-bezier(0.22, 1, 0.36, 1)`. Superseded
duration and easing keys (`fast`, `normal`, `slow`, `cinematic`, `enter`) remain
as deprecated aliases so no call site changed in this phase.

**Font weights normalised.** `font-weight: 750` and `720` were in use.
`next/font` loads discrete instances (400–800), so those synthesised. Both are
now `700`.

### Phase 1 check results

| Command | Result |
| --- | --- |
| `npm run lint` | **pass** |
| `npm run typecheck` | **pass** — exit 0 from a clean generated state, no manual cleanup |
| `npm run theme:validate` | **pass** — 134 files, 41 design tokens, 5 paired easings |
| `npm run products:validate` | **pass** — 30 products, 0 defects |
| `npm test` | **pass** — 6 files, 41 tests |
| `npm run build` | see change log below |

One issue was introduced and fixed during the phase: the first version of the
retired-typeface check matched any mention of the old font names, so it flagged
the code comment explaining why they were replaced. The patterns now match
declarations only — a `next/font` import identifier, a quoted font-stack entry,
or a Tailwind arbitrary value.

---

## Phase 0 baseline — check results (2026-07-25)

Run against the working tree as found, after `npm install` (exit 0).

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | **pass** | eslint clean |
| `npm run typecheck` | **pass\*** | \*exit 0 after clearing stale `.next/dev` artifacts — see below |
| `npm test` | **pass** | 6 files, 41 tests |
| `npm run products:validate` | **pass** | 30 products; 0 duplicate ids/slugs/models, 0 missing assets, 0 model mismatches, 0 broken references |
| `npm run theme:validate` | **pass** | 134 files, no off-palette orange |
| `npm run build` | **pass\*** | \*same artifact caveat; 72 static pages generated, exit 0 |
| `npm run test:e2e` | **not runnable here** | see "e2e harness is Linux-only" below |
| `npm run test:e2e:playwright` | **not runnable here** | same |

### Build route map (confirms the data-flow problem)

```
○ /                     Static      ← homepage baked at build time
● /products/[slug]      SSG         ← 30 paths from generateStaticParams()
● /categories/[slug]    SSG         ← 7 paths
● /brands/[slug]        SSG         ← 4 paths
○ /brands /downloads /system-builder /cart /about + policy pages   Static
ƒ /products /compare /checkout /login /quote                       Dynamic
ƒ /account/**  /admin/**  /api/**                                  Dynamic
```

The homepage and every product, category and brand detail page are **prerendered
from `src/data/catalog.ts` at build time**. No database read occurs on any of
them. This is the mechanical proof that admin edits cannot reach the storefront
today, independent of the import analysis in `admin-cms-plan.md` §1.1.

### e2e harness is Linux-only

Both `playwright.config.ts` and `scripts/e2e.mjs` import `@sparticuz/chromium`
and unpack `fonts.tar.br` / `swiftshader.tar.br`, expecting `libGLESv2.so` and a
Linux ELF Chromium. On this Windows workstation neither suite can launch a
browser. `playwright.config.ts` does honour `PLAYWRIGHT_EXECUTABLE_PATH`, so a
local Chrome can be pointed at it; `scripts/e2e.mjs` has the same env hook.

Because the suites could not be executed, no claim is made here about whether
they pass. Two assertions in `tests/e2e/storefront.spec.ts` do appear
**inconsistent with the current uncommitted working tree** by inspection:

- `expect(page.locator("main > section")).toHaveCount(6)` — the current
  `src/app/page.tsx` renders **7** top-level `<section>` elements.
- `expect(page.getByRole("heading", { level: 1 })).toContainText("Security")` —
  the current `<h1>` reads "Original security hardware delivered fast", with a
  lower-case "security"; `toContainText` is case-sensitive.

Both are consistent with the test file being the last-committed version while
`page.tsx` carries uncommitted edits. This needs confirming on a machine that
can run the suite before any homepage work begins, since the homepage rebuild
will rewrite these assertions anyway.

### Pre-existing failure #1 — stale Next.js route types (environment, not source)

`npm run typecheck` and `npm run build` both failed initially with:

```
.next/dev/types/routes.d-DESKTOP-HS1OAEP.ts(87,13): error TS2428:
  All declarations of 'PageProps' must have identical type parameters.
.next/dev/types/routes.d-DESKTOP-HS1OAEP.ts(101,8): error TS2300:
  Duplicate identifier 'LayoutProps'.
.next/dev/types/validator.ts(70,52): error TS2344:
  Type '"/account/orders/[orderId]"' does not satisfy the constraint 'AppRoutes'.
  … 6 more routes
```

Diagnosis:

- `tsconfig.json` includes `.next/dev/types/**/*.ts`.
- `next dev` writes `routes.d-<HOSTNAME>.ts`; `next build` writes `routes.d.ts`.
  Both were present, declaring `PageProps`/`LayoutProps` twice.
- The two files were generated at different times, so the older one's
  `AppRoutes` union lacked the seven newest routes that `validator.ts` referenced.
- The project lives inside a **OneDrive-synced** folder and the files carry the
  `ReparsePoint` attribute, so deleting `.next` wholesale did not reliably clear
  them — OneDrive rehydrated them.

Resolution: removing `.next/dev` makes `npm run typecheck` exit **0** with no
errors. **The source code is type-clean.** This is a build-artifact collision,
not a code defect, and it is not counted as a source regression.

Follow-up worth doing (not Phase 0 work): add `turbopack.root` to
`next.config.ts` — the build also warns that it inferred the workspace root as
`C:\Users\Aditya` because a stray `package-lock.json` sits there, alongside the
project's own.

### Pre-existing failure #2 — dated purchase-eligibility time bomb

Not a test failure today, but it will become a total storefront outage.

`src/data/catalog.ts` stamps every static product with
`verifiedAt = "2026-07-22T00:00:00.000Z"`, and `getPurchaseEligibility()`
(`src/lib/products.ts`) rejects any price older than
`getPriceMaxAgeDays()` — default **30 days** (`src/config/site.ts`).

So on **2026-08-21**, every product served from the static fallback flips to
"Request latest price", `AddToCart` refuses silently (`cart-store.ts` returns
state unchanged), and the shop stops selling. Today (2026-07-25) the data is
3 days old, so all checks pass and nothing looks wrong.

This is one of the strongest arguments for doing the data-layer phase early:
database rows carry a real per-product `priceVerifiedAt` that an admin can
refresh, whereas the static constant cannot be refreshed without a code deploy.

---

## Uncommitted work found in the working tree

`git status` reports the repository is **not clean**. This predates Phase 0.

- 33 modified tracked files (incl. `package.json`, `db/schema.ts`, `lib/auth.ts`,
  `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/header.tsx`)
- 2 deleted tracked files (`components/hero-illustration.tsx`,
  `components/hero-products.tsx`)
- ~30 untracked paths, including most of the admin application:
  `app/admin/actions.ts`, `app/admin/{customers,inventory,settings}/`,
  `app/admin/orders/[orderNumber]/`, `app/admin/products/[id]/`,
  `components/admin-*.tsx`, `data/admin-repository.ts`, `data/orders-repository.ts`,
  `lib/authz.ts`, `lib/safe-redirect.ts`, `tests/unit/authz.test.ts`

The last commit is `03b520e feat: compact light header, single search entry
point, ink footer`. **The entire admin CMS as it exists today is uncommitted.**

This must be resolved before Phase 1 — see the blocking question in the Phase 0
report. Starting new work on top of an unreviewed, uncommitted delta risks
mixing someone else's in-flight changes into the transformation commits, and
makes "the final diff contains no unrelated changes" impossible to satisfy.

---

## Stale documentation found

| File | Problem |
| --- | --- |
| `docs/architecture.md` | Data-flow item 4 claims `repository.ts` serves the storefront from Neon. It does not — no storefront route imports it. Also says "19 existing products"; there are 30. |
| `docs/admin-guide.md` | Says "The current admin UI is deliberately read-only". It is not — four mutating server actions exist. Also describes `ADMIN_EMAILS` as the admin gate; the real gate is the role/capability matrix in `lib/authz.ts`. |

Both should be corrected in the phase that changes the behaviour they describe,
not in a separate docs-only commit.

---

## Change log

| Date | Phase | Change |
| --- | --- | --- |
| 2026-07-25 | 0 | Audit performed; four planning documents created; no source modified. |
| 2026-07-25 | — | Baseline checkpoint commit `fe7a21d`; `feat/feedforge-inspired-storefront-admin` branched from it. |
| 2026-07-25 | 1 | Repository/config hygiene, Plus Jakarta Sans + Geist Mono, design-token foundations, motion duration/easing tokens, theme-validation contract. |
