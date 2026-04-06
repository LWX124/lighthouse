import { describe, it, expect } from "vitest";

// We test the admin guard logic in isolation by extracting it
// The guard function takes: pathname, getUser result, getProfile result
// Returns: "allow" | "redirect:/login?next=/admin" | "redirect:/"

type GuardResult =
  | { action: "allow" }
  | { action: "redirect"; to: string };

async function adminGuard(
  pathname: string,
  user: { id: string } | null,
  role: "admin" | "user" | null
): Promise<GuardResult> {
  if (!pathname.startsWith("/admin")) return { action: "allow" };
  if (!user) return { action: "redirect", to: `/login?next=${pathname}` };
  if (role !== "admin") return { action: "redirect", to: "/" };
  return { action: "allow" };
}

describe("adminGuard", () => {
  it("allows non-admin paths without auth", async () => {
    const result = await adminGuard("/news", null, null);
    expect(result).toEqual({ action: "allow" });
  });

  it("redirects to login when unauthenticated on /admin path", async () => {
    const result = await adminGuard("/admin/news", null, null);
    expect(result).toEqual({ action: "redirect", to: "/login?next=/admin/news" });
  });

  it("redirects to home when authenticated but not admin", async () => {
    const result = await adminGuard("/admin/news", { id: "user-1" }, "user");
    expect(result).toEqual({ action: "redirect", to: "/" });
  });

  it("allows admin user through", async () => {
    const result = await adminGuard("/admin/news", { id: "admin-1" }, "admin");
    expect(result).toEqual({ action: "allow" });
  });
});
