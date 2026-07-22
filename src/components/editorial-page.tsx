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
    <article className="container-standard section-space !pt-14">
      <header className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-section mt-4">{title}</h1>
        </div>
        <p className="max-w-2xl self-end text-lg leading-8 text-[var(--muted)]">{intro}</p>
      </header>
      <div className="container-reading mt-16 grid gap-12">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-3xl font-semibold">{section.title}</h2>
            <div className="mt-4 space-y-4 leading-7 text-[var(--muted)]">{section.body}</div>
          </section>
        ))}
        <div className="rounded-2xl bg-[var(--tangerine-soft)] p-6">
          <p className="font-bold text-[var(--ink)]">Need a specific answer?</p>
          <p className="mt-2">Contact us before ordering and quote the exact model number.</p>
          <Link href="/contact" className="button-secondary mt-5">
            Contact support
          </Link>
        </div>
      </div>
    </article>
  );
}
