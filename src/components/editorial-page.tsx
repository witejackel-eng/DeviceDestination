import Link from "next/link";

type EditorialSection = {
  title: string;
  body: React.ReactNode;
};

type EditorialPageProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  sections: EditorialSection[];
};

export function EditorialPage({ eyebrow, title, intro, sections }: EditorialPageProps) {
  return (
    <div className="container-standard section-space">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {intro && <p className="mt-4 max-w-2xl text-[var(--text-secondary)]">{intro}</p>}
      <div className="mt-10 max-w-2xl space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="section-title text-[1.3rem]">{section.title}</h2>
            <div className="mt-3 text-[var(--text-secondary)] leading-7">{section.body}</div>
          </section>
        ))}
      </div>
      <div className="mt-12 pt-8 border-t border-[var(--border)]">
        <Link href="/" className="button-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
