# UI transformation plan

Companion to [`feedforge-reference-audit.md`](./feedforge-reference-audit.md).

Status: §1.1 (typography) and §1.2 (token system) **landed in Phase 1**. Section
3 onward remains plan only. See
[`implementation-progress.md`](./implementation-progress.md) for what shipped and
where the values differ from this plan.

---

## 1. Design system

### 1.1 Typography decision

The reference's font, **Plus Jakarta Sans**, is positively identified, OFL-licensed
and available from Google Fonts, so it is used directly through
`next/font/google`. No font binary is taken from the reference site.

| Role | Family | Weights | Replaces |
| --- | --- | --- | --- |
| Display | Plus Jakarta Sans | 700, 800 | Barlow Condensed |
| Body / UI | Plus Jakarta Sans | 400, 500, 600 | Manrope |
| Model numbers, SKUs, technical IDs | **Geist Mono** | 400, 500 | *(nothing today)* |

> **Landed in Phase 1.** Both families load through `next/font/google` in
> `src/app/layout.tsx`, exposing `--font-plus-jakarta` and `--font-geist-mono`.
> `globals.css` maps them to the `--font-sans` / `--font-mono` Tailwind theme
> keys and to the `--font-display` / `--font-body` / `--font-technical` roles, so
> a future display face can be swapped without touching components. A
> `.font-technical` utility exists for values read character by character;
> applying it across the storefront and admin happens in the phases that rebuild
> those surfaces.

Rationale for dropping Barlow Condensed: it is a *condensed* face, which is the
opposite of the reference's optical character (a wide-ish grotesk that reads
compact only because of its weight). Keeping it would make every headline read
as "sports poster" rather than "editorial commerce".

Geist Mono is new and is the single most valuable typographic addition for this
product: `CP-UNC-DA41L3C-D-Q` is currently set in the body face, where `1/l`,
`0/O` and `-` are ambiguous. A monospace face makes exact-model identity
legible and scannable, which is the site's core promise.

Two families, three roles. No third display face.

### 1.2 Token system

Today `globals.css` defines colour only. Radii (`rounded-[22px]`,
`rounded-[24px]`, `rounded-[20px]`, `rounded-[26px]`), shadows, durations and
z-indices are hard-coded per component. The plan introduces the missing scales
and migrates components onto them.

```
Colour        already present, retained
  --canvas #f8f5ed   --canvas-alt #f0ece3   --surface #fffefa
  --ink #171513      --ink-soft #3d3935     --muted #716c65
  --line, --line-strong
  --tangerine #ff8a00 (+ hover/text/soft/subtle/border/focus/shadow)
  --success #24633f  --danger #a92d22

Colour        to add
  --warning            (amber; currently hard-coded amber-50/200/800 in admin)
  --surface-raised     (elevated card on --canvas-alt)
  --ink-contrast       (dark section surface, ≈ --ink; formalise the role)

Radius        to add          Spacing       to add
  --r-xs   4px                  --space-1 .25rem … --space-16 6rem
  --r-sm   6px                  (mirrors the 4/8 grid already in use)
  --r-md   10px
  --r-lg   14px               Shadow        to add — deliberately only two
  --r-xl   20px                 --shadow-sm  (hairline lift)
  --r-2xl  24px                 --shadow-md  (drawer/menu only)
  --r-full 9999px

Motion        to add          Z-index       to add
  --dur-micro   180ms           --z-base 0      --z-sticky 30
  --dur-enter   450ms           --z-header 50   --z-overlay 70
  --dur-content 550ms           --z-panel 80    --z-toast 90
  --dur-hero    750ms
  --ease-out-quint  cubic-bezier(.23,1,.32,1)
  --ease-out-expo   cubic-bezier(.16,1,.30,1)
  --ease-panel      cubic-bezier(.32,.72,0,1)
  --stagger         70ms
```

Radii map to the reference's measured 4/6/9/14/16/24 scale, nudged to the
values already common in this codebase so the migration is mostly mechanical.

> **Landed in Phase 1**, with these differences from the sketch above:
> `--warning` ships with `--warning-surface` / `--warning-border` (the admin
> currently hard-codes `amber-50/200/800`, which those replace), and `--success`
> / `--danger` gained matching `-surface` tokens for the same reason. A fifth
> easing, `--ease-sharp` `cubic-bezier(0.4, 0.4, 0, 1)`, was added because
> `--ease-standard` had to keep its existing project value — see the note on
> unchanged timings in `implementation-progress.md`. Migrating components off
> hard-coded radii, shadows and amber literals is deliberately **not** Phase 1
> work; the tokens exist first, the migration follows in each surface's own phase.

Shadow policy follows the audit: the reference uses **none**. The two tokens
exist for the cart drawer and mobile menu only. `--tangerine-shadow` glows on
`ProductCard` hover and the `.headline-pill` triple inset shadow are the two
places currently fighting that policy and will be reduced.

### 1.3 Header direction

Keep: logo, sticky behaviour, cart count, search entry, compare, account.

Change: the header capsule is currently sage green (`--header-surface: #dce5d8`),
which reads as a third brand colour with no system role. Move to the brief's
specified treatment — warm-white/transparent at rest, blurred + bordered after
scroll — and retire `--header-surface` / `--header-surface-hover`.

The reference's absolute, scroll-away header is explicitly **not** adopted.

---

## 2. Motion architecture

### 2.1 The library problem (decision required — see Phase 0 report Q1)

Three animation libraries ship today:

| Library | Used by | Approx. cost |
| --- | --- | --- |
| `motion` v12 | header, cards, drawers, tray | — (keep) |
| `gsap` + ScrollTrigger | `home-motion.tsx` scroll reveals | ~70 KB gz |
| `animejs` v4 | DD logo mark, hero badge | ~17 KB gz |

`src/lib/motion/constants.ts` even documents the three-way split as an
ownership rule. The brief says to use the existing motion package and not add
GSAP; GSAP is already here, so this is a removal decision, not an addition one.

**Recommendation: consolidate on `motion`, drop `gsap` and `animejs`.**
Everything currently done with them — masked line reveals, once-only scroll
reveals, staggered entrances, a scroll-linked horizontal rail — is directly
expressible with `useScroll` / `useTransform` / `whileInView` / motion values,
which drive the compositor without React re-renders. This removes ~87 KB gzip
from first load and leaves one mental model.

### 2.2 Primitives to build (`src/components/motion/`)

| Primitive | Built on | Notes |
| --- | --- | --- |
| `PageEntrance` | `motion` | gated on `document.fonts.ready` + 200ms, per the audit |
| `Reveal` | `whileInView`, `once: true` | `margin: "0px 0px -30px 0px"` |
| `StaggerGroup` / `StaggerItem` | variants | 70ms interval |
| `SplitLineReveal` | CSS mask + variants | reproduces the descender-safe mask; resets `will-change` |
| `ScrollProductRail` | `useScroll` + `useTransform` | motion value → `x`, no React state per frame |
| `StickyStory` | CSS `position: sticky` + scroll progress | desktop only |
| `HoverLift` | `whileHover` | disabled under reduced motion |
| `AnimatedArrow` | CSS transition | micro, 180ms |
| `ReducedMotionBoundary` | `useReducedMotion` | renders children statically; the escape hatch every other primitive defers to |

Every primitive must: respect `prefers-reduced-motion` by **skipping** (not
shortening), reserve its own space so nothing reflows, keep text selectable and
readable mid-animation, and never trap focus.

### 2.3 Two defects to fix while rebuilding motion

1. **`home-motion.tsx` animates from `opacity: 0` via `gsap.from` after
   hydration.** The server HTML paints the content visible, then JS hides and
   re-reveals it — a visible flash, and content is unanimated-but-visible for
   any user whose JS is slow. The replacement must set the initial state in the
   same commit as the markup.
2. **`ProductCard` uses `motion.article layout` on every grid item.** Layout
   animation measures every card on every render; on a 30-card catalogue grid
   this is measurable jank for no visual benefit. `layout` should be dropped.

---

## 3. Homepage — six acts

Current homepage has **seven** sections (hero, categories, popular products,
collections, compare, find-your-model, brands+trust). Target is six acts.

| Act | Content | Source of current material |
| --- | --- | --- |
| 1 | Cinematic hero + exact-model search + real product rail | hero + find-your-model merged |
| 2 | Four primary categories with live counts | categories section, reduced 7 → 4 |
| 3 | Featured exact models (6–8) | popular products |
| 4 | System story: camera → recorder → network → system | new, from real compatibility data |
| 5 | Assistance and trust | brands + trust strip + compare CTA merged |
| 6 | Conversational CTA + footer | new CTA, existing footer |

The "Popular collections" section is absorbed into Act 2/3 — its three cards are
query links, not a distinct user need.

**Constraint carried into implementation:** `tests/e2e/storefront.spec.ts`
asserts `main > section` has count 6, three `[data-home-collection]` elements
and one `[data-home-brands-trust]`. Those assertions encode the *current*
seven-section layout (six direct `<section>` children plus wrappers) and will
need updating in the same commit as the homepage rebuild — flagged in the test
plan rather than discovered late.

Act 1's rail must use the five real catalogue anchors named in the brief (dome,
bullet, NVR, biometric, PoE switch), each linking to its real product page. The
existing `page.tsx` already picks hero products **by id, not by index**, with a
comment explaining why; that discipline is preserved.

---

## 4. Catalogue and product detail

### Catalogue (`/products`)

Current page is server-rendered with a `<form>`-based filter set and stable URL
params — a good foundation that is kept. Additions: editorial intro, sticky
filter rail, mobile filter drawer (replacing `<details>`), active filter chips
with individual removal, result count (present), accessible empty state
(present), and a real sort control.

Deliberately **not** adding per-card scroll choreography — the brief requires
the catalogue to stay fast and scannable.

### Product detail (`/products/[slug]`)

Preserve every existing behaviour: legacy-slug redirect, structured data,
eligibility gating, documents, related models, mobile purchase bar.

Improve: gallery stage with thumbnails and zoom/lightbox; sticky purchase panel;
model set in Geist Mono; clearer price/stock hierarchy; key-spec strip above the
fold; specification **grouping** (the DB already has `productSpecs.groupName`,
which the storefront currently ignores because `repository.ts` flattens specs to
a `Record<string,string>`); compatibility section; downloads; installation
requirements.

Semantics to keep/introduce: `<nav aria-label="Breadcrumb">` (present), `<dl>`
for specs (present), `<details>` accordions (present), Product + BreadcrumbList
JSON-LD (present).

---

## 5. Responsive and accessibility targets

Widths to verify: 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800,
1440×900, 1920×1080.

No horizontal overflow except the intentional product-thumbnail rail,
comparison table, and media rail — each with accessible controls.

Mobile rules: search and buy above the fold; no desktop sticky-scroll
simulation; simpler motion; 44px minimum touch targets; model numbers stay
legible; hero type must not push commerce below the fold.

Accessibility: WCAG 2.2 AA. Skip link exists and is kept. Focus-visible outline
exists (`3px var(--tangerine-focus)`) and is kept. Required work is
concentrated in the new drawer/menu/lightbox components: focus trap, restore on
close, Escape, route-change close, scroll lock without page jump.

---

## 6. Performance guardrails

Targets: LCP < 2.5s mobile, CLS < 0.1, INP < 200ms.

Specific commitments:

- Remove `gsap` + `animejs` (~87 KB gz) if §2.1 is approved.
- Continuous animation runs on motion values, never per-frame React state.
- The existing `PointerField` component attaches a pointer-move listener; it
  must write to a motion value / CSS custom property, not component state.
- No autoplay background video.
- `next/image` for all catalogue imagery (already the case).
- Below-fold media lazy-loaded.
- Keep Server Components default; `"use client"` only at the smallest boundary.

The largest single performance item is not motion at all — it is §7.

---

## 7. Dependency: the static-catalogue import (blocks real gains)

16 **client** components import the entire static catalogue
(`cart-store`, `compare-store`, `cart-drawer`, `product-search`, `header`,
`system-builder`, `add-to-cart`, `checkout-form`, `comparison-page`,
`compare-tray`, `compare-toggle`, `product-actions`, `mobile-product-bar`,
`recently-viewed`, `auth-order-summary`, plus `cart/page.tsx`).

`src/data/catalog.ts` composes `seed-products-source.ts` (33 KB) and
`catalogue-expansion.ts` (23 KB) — every product, every spec, every highlight,
every document path — and all of it is serialised into the client bundle.

This is simultaneously the biggest performance problem, the reason admin edits
cannot reach the storefront, and the reason the database is not canonical. It is
addressed in the data-layer phase, ahead of most UI work, because the homepage
and catalogue cannot be rebuilt correctly against a data source that is about to
change shape.

See [`admin-cms-plan.md`](./admin-cms-plan.md) §1.
