import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// Create a new plan
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = body.title || "新方案";

  const { data: plan, error } = await supabase
    .from("practice_plans")
    .insert({
      user_id: user.id,
      title,
      status: "pending",
      model_used: "sonnet",
    })
    .select("id, title, status, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(plan);
}

// List user's plans
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: plans } = await supabase
    .from("practice_plans")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json(plans ?? []);
}
