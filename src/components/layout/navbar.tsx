import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavbarAuth } from "./navbar-auth";

const navLinks = [
  { href: "/tutorials", label: "教程" },
  { href: "/tools", label: "AI工具榜" },
  { href: "/news", label: "AI新鲜事" },
  { href: "/demands", label: "需求Hub" },
  { href: "/practice", label: "AI实践" },
];

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let isPro = false;
  if (authUser) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", authUser.id)
      .eq("status", "active")
      .single();
    isPro = sub?.plan === "pro";
  }

  const user = authUser ? { email: authUser.email ?? "" } : null;

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
        <NavbarAuth initialUser={user} isPro={isPro} />
      </nav>
    </header>
  );
}
