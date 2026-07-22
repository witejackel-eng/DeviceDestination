#!/bin/bash
cd /home/z/my-project/DeviceDestination
git add -A
echo "---GIT STATUS---"
git status 2>&1 | head -60
echo "---GIT COMMIT---"
git commit -m "feat: complete premium redesign — Industrial Pop Commerce design system

Complete visual redesign inspired by Fonder Studio's design confidence,
adapted as an original DeviceDestination design system.

Changes:
- New colour system: warm ivory canvas, near-black ink, tangerine CTA,
  coral/lilac/powder-blue/butter/mint/peach accent fields with
  deliberate pairings
- Typography: Bricolage Grotesque (display) + Manrope (body)
- Premium floating header with 88px rounded shell, scroll compact state
- Art-directed mega-menu with 3 colour panels + quick links strip
- Full-screen mobile navigation with coloured category panels
- Compact product cards with category-based colour backgrounds
- Editorial hero with product composition on coral background
- Asymmetric category discovery grid
- Compact product grid: 4-5 columns on desktop, auto-fit
- Catalogue toolbar with filter pills replacing sidebar
- Filter drawer with all technical filters
- Redesigned product detail pages with tighter typography
- Premium cart drawer with refined spacing
- Compare page with design token consistency
- Expressive footer with large wordmark
- Updated collection pages, editorial pages, CTA banner
- All shared components updated with new design tokens

All ecommerce functionality preserved:
- Product search, filtering, sorting
- Cart, checkout, Razorpay integration
- Compare functionality
- Account, authentication
- SEO metadata, structured data
- Cookie consent, analytics
- Accessibility, reduced-motion support

Build, lint, typecheck all pass clean."
echo "---GIT RESULT---"
