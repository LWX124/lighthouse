import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/config";
import { PricingPageClient } from "./pricing-page-client";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: "free" | "pro" = "free";

  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (sub?.plan === "pro") {
      currentPlan = "pro";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">选择你的方案</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          免费开始，随时升级
        </p>
      </div>

      <PricingPageClient
        currentPlan={currentPlan}
        isLoggedIn={!!user}
        freePlan={PLANS.free}
        proPlan={PLANS.pro}
      />
    </div>
  );
}
