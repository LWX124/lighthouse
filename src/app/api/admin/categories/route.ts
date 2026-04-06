import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function GET() {
  const supabase = await createClient();
  const { user, status } = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status: status! });

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, tutorials(id)")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    tutorial_count: Array.isArray(c.tutorials) ? c.tutorials.length : 0,
  }));

  return NextResponse.json({ categories: mapped });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status: status! });

  const body = await request.json();
  const { name, slug } = body as { name: string; slug: string };

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug, order: 0, description: null, icon: null, parent_id: null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
