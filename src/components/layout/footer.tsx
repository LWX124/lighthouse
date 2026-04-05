import Link from "next/link";

const footerLinks = [
  {
    title: "产品",
    links: [
      { href: "/tutorials", label: "教程" },
      { href: "/tools", label: "AI工具榜" },
      { href: "/news", label: "AI新鲜事" },
      { href: "/demands", label: "需求Hub" },
      { href: "/practice", label: "AI实践" },
    ],
  },
  {
    title: "支持",
    links: [
      { href: "/pricing", label: "定价" },
      { href: "/about", label: "关于我们" },
      { href: "/contact", label: "联系我们" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold text-primary">Lighthouse</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              AI 驱动的一站式信息平台
            </p>
          </div>
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="font-semibold">{group.title}</h4>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Lighthouse. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
