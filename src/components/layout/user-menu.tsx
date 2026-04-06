"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface UserMenuProps {
  email: string;
  isPro: boolean;
  onSignOut: () => void;
}

export function UserMenu({ email, isPro, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {initial}
        </div>
        {isPro && <Badge>Pro</Badge>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-muted-foreground">
              {isPro ? "Pro 会员" : "免费版"}
            </p>
          </div>

          {isPro && (
            <a
              href="/api/stripe/portal"
              className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              管理订阅
            </a>
          )}

          {!isPro && (
            <a
              href="/pricing"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted"
            >
              升级 Pro
            </a>
          )}

          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
