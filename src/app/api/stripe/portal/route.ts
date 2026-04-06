import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_sub_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_sub_id) {
    return Response.json(
      { error: "没有活跃的订阅" },
      { status: 400 }
    );
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  try {
    const stripe = getStripe();

    const sub = await stripe.subscriptions.retrieve(
      subscription.stripe_sub_id
    );
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/pricing`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return Response.json(
      { error: "创建管理会话失败" },
      { status: 500 }
    );
  }
}
