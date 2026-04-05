import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/tutorials", label: "教程" },
  { href: "/tools", label: "AI工具榜" },
  { href: "/news", label: "AI新鲜事" },
  { href: "/demands", label: "需求Hub" },
  { href: "/practice", label: "AI实践" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-primary">
          Lighthouse
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              登录
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">注册</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
