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

  const priceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  if (!priceId) {
    return Response.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  try {
    const stripe = getStripe();

    // Check if user already has an active Stripe subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_sub_id, status")
      .eq("user_id", user.id)
      .single();

    if (subscription?.stripe_sub_id && subscription.status === "active") {
      return Response.json(
        { error: "已有活跃订阅" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return Response.json(
      { error: "创建支付会话失败" },
      { status: 500 }
    );
  }
}
