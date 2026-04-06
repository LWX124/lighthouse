import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type TypedSupabase = SupabaseClient<Database>;

/**
 * Returns the user if they are an admin, or null if not authenticated / not admin.
 * Returns 401 status hint if no user, 403 if not admin.
 */
export async function requireAdmin(
  supabase: TypedSupabase
): Promise<{ user: { id: string }; status: null } | { user: null; status: 401 | 403 }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { user: null, status: 403 };

  return { user, status: null };
}
