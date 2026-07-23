# Task: Update Product Detail Page (Section 15)

## Agent: Main Agent

## Changes Made

### 1. Product Gallery Component (`src/components/product-gallery.tsx`)

- **Single-image aspect ratio**: Changed from forced `aspect-square` to dynamic `aspect-[4/3]` for single images and `aspect-square` for multi-image galleries, avoiding massive empty squares when only one image exists
- **Stronger image scale**: Increased main image padding from `p-7 sm:p-12` to `p-10 sm:p-16` for stronger visual scale
- **Stronger motion scale**: Changed initial/exit animation from `scale: 0.985/1.01` to `0.97/1.02` for more noticeable transitions
- **Better thumbnail treatment**: 
  - Increased thumbnail border from `border` to `border-2` for visual emphasis
  - Selected thumbnail now has `shadow-[0_0_0_3px_var(--accent-border)]` with `scale-[1.04]` instead of just `shadow-[0_0_0_2px_var(--accent-border)]`
  - Unselected thumbnails have `hover:border-[var(--border-strong)] hover:shadow-sm` for clear hover state
  - Added `transition-all duration-150` for smoother state changes
  - Thumbnail inner padding increased from `p-2` to `p-2.5`
  - Thumbnail gap margin changed from `mt-3` to `mt-4`

### 2. Product Detail Page (`src/app/products/[slug]/page.tsx`)

- **Imported `getSpecChips` from "@/lib/spec-chips"**: Added specification chips to the product hero section
- **Imported new icons**: `BookOpen` (for manual documents) and `FileText` (for datasheet documents)
- **Removed `aspect-square` from gallery wrapper**: Let ProductGallery component handle its own aspect ratio
- **Added specification chips**: After the model number, before the description, with accent-soft styling for important chips and surface-subtle for others, using pill-shaped chips with rounded-[var(--radius-pill)]
- **Added Availability indicator**: New `stockLabel` map showing stock status (In stock/Limited/Lead time/Quote only) with green for in_stock and warning color for others
- **Price label**: Changed "Inclusive of all taxes · GST invoice provided" to "Incl. GST · GST invoice provided" for brevity
- **Specifications table improvements**:
  - Explicit alternating row colors: even rows get `bg-[var(--surface)]`, odd rows get `bg-[var(--surface-subtle)]`
  - Added `break-words hyphens-auto` to `<dd>` values for mobile readability of long spec values
- **Document rows improved**:
  - Added `documentIcon` map: `FileText` for datasheets, `BookOpen` for manuals, `Wrench` for installation guides
  - Restructured layout: icon → title+model stacked → Download action aligned right with `ml-auto`
  - Document title now `truncate`-safed and `font-semibold`
  - Model shown as `font-mono text-xs` below title
  - Better hover state: `hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]`
  - Larger padding: `px-5 py-4` instead of `px-4 py-3`
  - Changed from `rounded-[var(--radius-btn)]` to `rounded-[var(--radius-container)]` for visual consistency
- **Related products grid**: Changed from `grid-cols-[repeat(auto-fill,minmax(220px,1fr))]` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — four-column maximum grid, prevents narrow auto-fill cards

### Preserved Functionality

All existing functionality preserved:
- Breadcrumbs navigation
- JSON-LD product schema and breadcrumb schema
- Canonical URL via alternates metadata
- Product gallery with swipe/drag interaction
- Product actions (add to cart, buy now, quantity)
- Compare toggle
- Delivery checker
- Product information accordion section
- Specifications table (two-column, 38/62 split)
- Documents section
- Related products section
- RecentlyViewed component
- MobileProductBar component
- generateStaticParams and generateMetadata
- Redirect for non-canonical slugs
