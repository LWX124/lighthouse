"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/news", label: "内容审核 · 新闻" },
  { href: "/admin/demands", label: "内容审核 · 需求信号" },
  { href: "/admin/tutorials", label: "教程管理" },
  { href: "/admin/categories", label: "系列管理" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-muted/30 px-3 py-6">
      <div className="mb-6 px-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          管理后台
        </h2>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
