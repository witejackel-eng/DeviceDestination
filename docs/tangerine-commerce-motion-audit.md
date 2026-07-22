# DeviceDestination commerce, motion, and tangerine audit

Audit date: 2026-07-22

## Canonical theme

| Role | Value |
| --- | --- |
| Primary tangerine | `#FF8A00` |
| Hover tangerine | `#FFA62B` |
| Lighter accent | `#FFB347` |
| RGB channels | `255 138 0` |
| Accessible small brand text | `#BD4D00` |

All alpha variants are derived from `--tangerine-rgb`. The automated theme guard scanned 99 source and theme files and rejects legacy orange literals, direct brand `rgba()` values, Tailwind orange utilities, and the removed legacy token.

## Commerce work

- Reordered the home page around exact-model shopping: hero search, categories, best sellers, use cases, collections, compare, brands, trust, recently viewed, and shopping CTA.
- Replaced the corporate navigation with Shop, CCTV, NVRs & Storage, Biometrics, Networking, and Brands; added a desktop mega menu and a mobile storefront drawer.
- Added exact-model search ranking, a brands index, persistent recently viewed products, and a mobile sticky purchase bar.
- Strengthened product-card price, model, specification, availability, details, cart, and compare hierarchy.
- Preserved all 30 catalogue records and prices. Only search-result ordering changed in `src/data/catalog.ts`.

## Motion ownership

- Motion: route transitions, product-card state/layout, search, cart, compare, gallery, quantity, and purchase feedback.
- GSAP + ScrollTrigger: hero choreography, reveal batches, and hero product parallax.
- Anime.js: the DD mark and hero SVG line draw.
- Shared duration, easing, and spring constants live in `src/lib/motion/constants.ts`.
- Reduced motion disables the decorative Anime.js and GSAP timelines and removes Motion entrance transforms where appropriate.

## Verification

- Theme validator: passed, 99 files.
- ESLint and TypeScript: passed.
- Unit tests: 26 passed across 4 files.
- Catalogue validator: 30 products; no duplicate IDs, slugs, or models; no missing assets, model mismatches, or broken references.
- Production build and smoke routes: passed.
- Browser E2E: passed at 320, 375, 430, 768, 1024, 1280, and 1440 px.
- Responsive route matrix: 13 routes, including home, catalogue, product, category, brand, compare, builder, cart, checkout, contact, support, account, and downloads.
- Desktop and mobile flows: search, filters, persistent cart, checkout, compare, product documentation, contact, internal links, and console/hydration checks passed.
- Axe WCAG A/AA serious and critical scan: passed on home, catalogue, and contact after entrance animations settled.
- Reduced-motion browser mode: passed with content visible and no browser errors.

