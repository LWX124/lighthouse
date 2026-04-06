"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface NavbarAuthProps {
  initialUser: { email: string } | null;
  isPro: boolean;
}

export function NavbarAuth({ initialUser, isPro }: NavbarAuthProps) {
  const [user, setUser] = useState(initialUser);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
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
    );
  }

  return (
    <UserMenu
      email={user.email}
      isPro={isPro}
      onSignOut={handleSignOut}
    />
  );
}
