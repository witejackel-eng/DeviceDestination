import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-reading section-space text-center">
      <p className="eyebrow">404</p>
      <h1 className="display-section mt-4">That exact page is not here.</h1>
      <p className="mt-5 text-lg text-[var(--text-muted)]">
        Search the model number or return to the catalogue.
      </p>
      <Link href="/products" className="button-primary mt-7">
        Browse products
      </Link>
    </div>
  );
}
