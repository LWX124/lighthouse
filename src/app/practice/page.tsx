import { createClient } from "@/lib/supabase/server";
import { PracticePageClient } from "./practice-page-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plans } = await supabase
    .from("practice_plans")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Check subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 实践</h1>
        <p className="mt-2 text-muted-foreground">
          描述你的想法，AI 帮你生成完整的落地方案
        </p>
      </div>

      <PracticePageClient
        plans={plans ?? []}
        isPro={subscription?.plan === "pro"}
      />
    </div>
  );
}
