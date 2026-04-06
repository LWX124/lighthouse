import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { user, status } = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status: status! });

  const { id } = await params;
  const { data, error } = await supabase
    .from("tutorials").select("*").eq("id", id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ tutorial: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { user, status } = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status: status! });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.content !== undefined) {
    updates.content = body.content;
    updates.read_time_minutes = Math.ceil(body.content.split(/\s+/).length / 200);
  }
  if (body.status !== undefined) updates.status = body.status;
  if (body.category_id !== undefined) updates.category_id = body.category_id;
  if (body.is_free !== undefined) updates.is_free = body.is_free;

  const { data, error } = await supabase
    .from("tutorials").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorial: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { user, status } = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status: status! });

  const { id } = await params;
  const { error } = await supabase.from("tutorials").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
