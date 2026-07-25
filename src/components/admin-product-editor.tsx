"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { AdminProductDetail } from "@/data/admin-repository";
import { updateInventoryAction, updateProductAction, type ActionResult } from "@/app/admin/actions";

const field = "h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 text-sm";
const area = "w-full rounded-[10px] border border-[var(--line)] bg-white p-3 text-sm leading-6";

const initial: ActionResult = { ok: false, message: "" };

/**
 * Two-column product editor. The left column holds what the customer reads; the
 * right column holds how the product is published. Both submit through server
 * actions that re-validate every field — the browser is never trusted.
 */
export function AdminProductEditor({
  product,
  canEdit,
  canEditInventory,
}: {
  product: AdminProductDetail;
  canEdit: boolean;
  canEditInventory: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => updateProductAction(formData),
    initial,
  );
  const [stockState, stockAction, stockPending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => updateInventoryAction(formData),
    initial,
  );

  return (
    <div className="grid gap-6">
      {!canEdit && (
        <p className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm">
          Your role can view this product but not change it.
        </p>
      )}

      <form action={action} className="grid gap-6 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <input type="hidden" name="id" value={product.id} />

        <div className="grid gap-5">
          <Panel title="Product information">
            <Grid>
              <Label text="Title" className="sm:col-span-2">
                <input name="title" defaultValue={product.title} className={field} required />
              </Label>
              <Label text="Exact model number" hint="Never edit without manufacturer evidence">
                <input name="model" defaultValue={product.model} className={`${field} font-mono`} required />
              </Label>
              <Label text="Slug" hint="Changing this changes the public URL">
                <input name="slug" defaultValue={product.slug} className={field} required />
              </Label>
              <Label text="Brand">
                <input value={product.brandName} className={`${field} bg-[var(--canvas-alt)]`} readOnly />
              </Label>
              <Label text="Category">
                <input
                  value={product.categoryName}
                  className={`${field} bg-[var(--canvas-alt)]`}
                  readOnly
                />
              </Label>
              <Label text="Official source URL" className="sm:col-span-2">
                <input
                  name="officialSourceUrl"
                  type="url"
                  defaultValue={product.officialSourceUrl}
                  className={field}
                  required
                />
              </Label>
            </Grid>
          </Panel>

          <Panel title="Description">
            <Grid columns={1}>
              <Label text="Short description">
                <textarea
                  name="shortDescription"
                  defaultValue={product.shortDescription}
                  rows={3}
                  className={area}
                  required
                />
              </Label>
              <Label text="Full description">
                <textarea
                  name="longDescription"
                  defaultValue={product.longDescription ?? ""}
                  rows={7}
                  className={area}
                />
              </Label>
            </Grid>
          </Panel>

          <Panel title={`Media (${product.images.length})`}>
            {product.images.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No images attached.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {product.images.map((image) => (
                  <li key={image.id} className="rounded-[12px] border border-[var(--line)] p-2">
                    <span className="relative block aspect-square overflow-hidden rounded-lg bg-[var(--canvas-alt)]">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="180px"
                        className="object-contain p-[8%]"
                      />
                    </span>
                    <p className="mt-2 truncate text-[11px] text-[var(--muted)]" title={image.url}>
                      {image.url.split("/").pop()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Images are model-linked assets under <code>public/images/products</code>. Run{" "}
              <code>npm run images:process</code> to re-trim white margins onto the shared square
              canvas; originals are never overwritten.
            </p>
          </Panel>

          <Panel title={`Specifications (${product.specs.length})`}>
            {product.specs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No specifications recorded.</p>
            ) : (
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {product.specs.map((spec) => (
                  <div key={spec.id} className="flex justify-between gap-4 border-b border-[var(--line)] py-1.5">
                    <dt className="text-[var(--muted)]">{spec.label}</dt>
                    <dd className="text-right font-semibold">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title={`Documents (${product.documents.length})`}>
            {product.documents.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No datasheet or manual attached.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {product.documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>{document.title}</strong>{" "}
                      <span className="text-[var(--muted)]">({document.type})</span>
                      {!document.modelVerified && (
                        <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          Model not verified
                        </span>
                      )}
                    </span>
                    <a href={document.url} className="text-xs underline" target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-5 xl:sticky xl:top-6">
          <Panel title="Status">
            <Grid columns={1}>
              <Label text="Publication">
                <select name="status" defaultValue={product.status} className={field}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Label>
              <Label text="Availability">
                <select name="stockStatus" defaultValue={product.stockStatus} className={field}>
                  <option value="in_stock">In stock</option>
                  <option value="limited">Limited stock</option>
                  <option value="lead_time">Lead time</option>
                  <option value="quote_only">Quote only</option>
                </select>
              </Label>
              <Label text="Lead time note">
                <input name="leadTime" defaultValue={product.leadTime ?? ""} className={field} />
              </Label>
            </Grid>
          </Panel>

          <Panel title="Pricing">
            <Grid columns={1}>
              <Label text="Selling price (paise, GST inclusive)" hint="₹1,999.00 is 199900">
                <input
                  name="sellingPriceInclGstPaise"
                  inputMode="numeric"
                  defaultValue={product.sellingPriceInclGstPaise ?? ""}
                  className={field}
                />
              </Label>
              <Label text="MRP (paise)" hint="Leave blank unless evidenced">
                <input
                  name="mrpInclGstPaise"
                  inputMode="numeric"
                  defaultValue={product.mrpInclGstPaise ?? ""}
                  className={field}
                />
              </Label>
              <Label text="GST rate (basis points)" hint="1800 = 18%">
                <input
                  name="gstRateBasisPoints"
                  inputMode="numeric"
                  defaultValue={product.gstRateBasisPoints}
                  className={field}
                />
              </Label>
              <Label text="Price source status">
                <select
                  name="priceSourceStatus"
                  defaultValue={product.priceSourceStatus}
                  className={field}
                >
                  <option value="verified">Verified — purchasable</option>
                  <option value="needs-review">Needs review</option>
                  <option value="request-price">Request price</option>
                </select>
              </Label>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Verified prices older than the configured freshness window stop being purchasable
                automatically. Saving a new verified price re-stamps the verification date.
                {product.priceVerifiedAt &&
                  ` Last verified ${product.priceVerifiedAt.toLocaleDateString("en-IN")}.`}
              </p>
            </Grid>
          </Panel>

          <Panel title="Purchase conditions">
            <Grid columns={1}>
              <Label text="Warranty summary">
                <textarea
                  name="warrantySummary"
                  defaultValue={product.warrantySummary ?? ""}
                  rows={3}
                  className={area}
                />
              </Label>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Installation is never included in a product price. Say so in the description rather
                than implying otherwise here.
              </p>
            </Grid>
          </Panel>

          <Panel title="SEO">
            <Grid columns={1}>
              <Label text="Meta title">
                <input name="seoTitle" defaultValue={product.seoTitle ?? ""} className={field} />
              </Label>
              <Label text="Meta description">
                <textarea
                  name="seoDescription"
                  defaultValue={product.seoDescription ?? ""}
                  rows={3}
                  className={area}
                />
              </Label>
            </Grid>
          </Panel>

          {state.message && (
            <p
              role={state.ok ? "status" : "alert"}
              className={`rounded-[10px] p-3 text-sm ${state.ok ? "bg-green-50 text-[var(--success)]" : "bg-red-50 text-[var(--danger)]"}`}
            >
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={!canEdit || pending}
            className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>

      <form action={stockAction}>
        <input type="hidden" name="productId" value={product.id} />
        <Panel title="Inventory">
          <Grid>
            <Label text="Units available" hint="Blank means untracked">
              <input
                name="quantityAvailable"
                inputMode="numeric"
                defaultValue={product.inventory?.quantityAvailable ?? ""}
                className={field}
              />
            </Label>
            <Label text="Restock lead time">
              <input
                name="leadTime"
                defaultValue={product.inventory?.leadTime ?? ""}
                className={field}
              />
            </Label>
          </Grid>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canEditInventory || stockPending}
              className="button-secondary min-h-10 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stockPending ? "Saving…" : "Update inventory"}
            </button>
            {stockState.message && (
              <span
                role={stockState.ok ? "status" : "alert"}
                className={`text-sm ${stockState.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
              >
                {stockState.message}
              </span>
            )}
          </div>
        </Panel>
      </form>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-[var(--line)] bg-white p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 }) {
  return (
    <div className={`grid gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
  );
}

function Label({
  text,
  hint,
  className = "",
  children,
}: {
  text: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-xs font-bold">{text}</span>
      {children}
      {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}
