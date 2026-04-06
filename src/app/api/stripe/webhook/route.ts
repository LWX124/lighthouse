import { getStripe } from "@/lib/stripe/server";
import { getPlanByPriceId } from "@/lib/stripe/config";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// Use service role client for webhook — no user session available
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) break;

        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = sub.items.data[0]?.price.id;
          const plan = priceId ? getPlanByPriceId(priceId) : null;

          if (plan) {
            await supabase
              .from("subscriptions")
              .update({
                plan,
                status: "active",
                stripe_sub_id: sub.id,
                current_period_start: new Date(
                  sub.current_period_start * 1000
                ).toISOString(),
                current_period_end: new Date(
                  sub.current_period_end * 1000
                ).toISOString(),
              })
              .eq("user_id", userId);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const priceId = sub.items.data[0]?.price.id;
        const plan = priceId ? getPlanByPriceId(priceId) : "free";

        await supabase
          .from("subscriptions")
          .update({
            plan: plan ?? "free",
            status: sub.status === "active" ? "active" : "canceled",
            current_period_start: new Date(
              sub.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              sub.current_period_end * 1000
            ).toISOString(),
          })
          .eq("user_id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({
            plan: "free",
            status: "canceled",
            stripe_sub_id: null,
            current_period_start: null,
            current_period_end: null,
          })
          .eq("user_id", userId);
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return Response.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return Response.json({ received: true });
}
