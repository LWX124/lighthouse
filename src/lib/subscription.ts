import { createClient } from "@/lib/supabase/server";

export interface SubscriptionInfo {
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due";
  isPro: boolean;
  currentPeriodEnd: string | null;
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "past_due"])
    .single();

  if (!data) {
    return {
      plan: "free",
      status: "active",
      isPro: false,
      currentPeriodEnd: null,
    };
  }

  return {
    plan: data.plan as "free" | "pro",
    status: data.status as "active" | "canceled" | "past_due",
    isPro: data.plan === "pro" && data.status === "active",
    currentPeriodEnd: data.current_period_end,
  };
}
