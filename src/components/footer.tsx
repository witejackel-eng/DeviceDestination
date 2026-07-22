import Link from "next/link";

const groups = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["System builder", "/system-builder"],
      ["Compare", "/compare"],
      ["Downloads", "/downloads"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Support", "/support"],
      ["Contact", "/contact"],
      ["Shipping", "/shipping-policy"],
      ["Returns", "/refund-policy"],
      ["Warranty", "/warranty-policy"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Installation", "/installation-policy"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--canvas-alt)]">
      <div className="container-standard grid gap-14 py-16 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-display text-4xl font-semibold tracking-[-0.055em]">
            DeviceDestination
          </p>
          <p className="mt-5 max-w-md text-[var(--muted)]">
            Genuine security hardware, selected by exact model and explained in plain language.
          </p>
          <address className="mt-7 not-italic text-sm leading-7 text-[var(--muted)]">
            Plot No. 94, 3rd Floor, Block B, Sector 13, Dwarka, New Delhi 110075
            <br />
            <a href="tel:+918368561919" className="hover:text-[var(--ink)]">
              +91 83685 61919
            </a>{" "}
            ·{" "}
            <a href="mailto:manish@insight-solutions.in" className="hover:text-[var(--ink)]">
              manish@insight-solutions.in
            </a>
          </address>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow mb-5">{group.title}</p>
              <ul className="grid gap-3 text-sm">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-[var(--muted)] hover:text-[var(--ink)]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="container-standard flex flex-col gap-2 border-t border-[var(--line)] py-5 text-xs text-[var(--muted)] sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} DeviceDestination. All rights reserved.</p>
        <p>Product installation is provided through qualified third-party installers.</p>
      </div>
    </footer>
  );
}
