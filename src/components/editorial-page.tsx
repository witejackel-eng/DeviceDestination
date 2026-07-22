import Link from "next/link";

export function EditorialPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: React.ReactNode }>;
}) {
  return (
    <article style={{ background: "var(--surface)" }}>
      <div className="container-standard section-space !pt-14">
        <header className="max-w-2xl mb-12">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-section mt-3">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-[var(--ink-soft)]">{intro}</p>
        </header>
        <div className="container-reading grid gap-12">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl font-bold">{section.title}</h2>
              <div className="mt-4 space-y-4 leading-7 text-[var(--ink-soft)]">{section.body}</div>
            </section>
          ))}
          <div className="rounded-2xl border border-[var(--line)] p-6" style={{ background: "var(--tangerine-soft)" }}>
            <p className="font-bold">Need a specific answer?</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Contact us before ordering and quote the exact model number.</p>
            <Link href="/contact" className="button-secondary mt-4">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
