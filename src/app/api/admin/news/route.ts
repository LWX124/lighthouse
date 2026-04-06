import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = (request.nextUrl.searchParams.get("status") ?? "pending") as
    | "pending"
    | "approved"
    | "rejected";

  const { data: items, error } = await supabase
    .from("news_items")
    .select("id, title, status, published_at, source_id, sources(name)")
    .eq("status", status)
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (items ?? []).map((item: any) => ({
    ...item,
    source_name: item.sources?.name ?? null,
  }));

  return NextResponse.json({ items: mapped });
}
