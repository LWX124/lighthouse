import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("tutorials")
    .select("id, title, slug, status, category_id, updated_at, categories(name)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorials: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, slug, content, category_id, is_free, status } = body as {
    title: string;
    slug: string;
    content: string;
    category_id?: string | null;
    is_free?: boolean;
    status?: "draft" | "published";
  };

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "title, slug, content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tutorials")
    .insert({
      title,
      slug,
      content,
      summary: null,
      category_id: category_id ?? null,
      is_free: is_free ?? true,
      status: status ?? "draft",
      order: 0,
      read_time_minutes: Math.ceil(content.split(/\s+/).length / 200),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorial: data }, { status: 201 });
}
