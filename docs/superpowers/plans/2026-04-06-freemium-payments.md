# Freemium + Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe-powered subscription payments, a pricing page, upgrade prompts throughout the app, and auth-aware navbar so free users can upgrade to Pro.

**Architecture:** Stripe Checkout Sessions for payment, Stripe webhooks to sync subscription status to Supabase `subscriptions` table. Server-side helper to check Pro status. Client-side paywall components that redirect to pricing. Navbar shows auth state and Pro badge.

**Tech Stack:** Stripe (stripe npm + @stripe/stripe-js), Next.js API routes for checkout/webhook/portal, Supabase subscriptions table (already exists), shadcn/ui components.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/stripe/server.ts` | Server-side Stripe client singleton |
| `src/lib/stripe/config.ts` | Stripe price IDs and plan config |
| `src/lib/subscription.ts` | `getSubscription()` server helper — single source of truth for isPro |
| `src/app/api/stripe/checkout/route.ts` | Create Checkout Session (POST) |
| `src/app/api/stripe/webhook/route.ts` | Handle Stripe webhook events |
| `src/app/api/stripe/portal/route.ts` | Create Billing Portal Session (POST) |
| `src/app/pricing/page.tsx` | Pricing page with Free vs Pro comparison |
| `src/components/pricing/pricing-card.tsx` | Reusable pricing tier card |
| `src/components/pricing/upgrade-banner.tsx` | Inline upgrade prompt for free users |
| `src/components/layout/navbar.tsx` | Modify: add auth state, user menu, Pro badge |
| `src/components/layout/user-menu.tsx` | Dropdown menu for authenticated users |
| `tests/components/pricing/pricing-card.test.tsx` | Tests for pricing card |
| `tests/components/pricing/upgrade-banner.test.tsx` | Tests for upgrade banner |
| `tests/components/layout/user-menu.test.tsx` | Tests for user menu |
| `tests/lib/stripe/config.test.ts` | Tests for plan config |

---

### Task 1: Install Stripe Dependencies + Config

**Files:**
- Create: `src/lib/stripe/server.ts`
- Create: `src/lib/stripe/config.ts`
- Test: `tests/lib/stripe/config.test.ts`

- [ ] **Step 1: Install Stripe packages**

```bash
pnpm add stripe @stripe/stripe-js
```

- [ ] **Step 2: Update .env.example with Stripe vars**

Add to `.env.example`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
```

- [ ] **Step 3: Write the config test**

Create `tests/lib/stripe/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PLANS, getPlanByPriceId, getFreeLimits, getProLimits } from "@/lib/stripe/config";

describe("stripe config", () => {
  it("exports free and pro plans", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.free.name).toBe("Free");
    expect(PLANS.pro.name).toBe("Pro");
  });

  it("free plan has correct limits", () => {
    const limits = getFreeLimits();
    expect(limits.planGenerations).toBe(1);
    expect(limits.aiRequests).toBe(5);
    expect(limits.toolSearches).toBe(10);
  });

  it("pro plan has unlimited marker", () => {
    const limits = getProLimits();
    expect(limits.planGenerations).toBe(-1);
    expect(limits.aiRequests).toBe(-1);
    expect(limits.toolSearches).toBe(-1);
  });

  it("getPlanByPriceId returns pro for matching price", () => {
    const result = getPlanByPriceId("price_placeholder");
    expect(result).toBe("pro");
  });

  it("getPlanByPriceId returns null for unknown price", () => {
    const result = getPlanByPriceId("price_unknown_xxx");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run tests/lib/stripe/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create Stripe config**

Create `src/lib/stripe/config.ts`:

```ts
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    description: "基础功能，适合体验",
    features: [
      "每日 1 次方案生成",
      "每日 5 次 AI 对话",
      "每日 10 次工具搜索",
      "基础教程访问",
      "Claude Sonnet 模型",
    ],
    limits: {
      planGenerations: 1,
      aiRequests: 5,
      toolSearches: 10,
    },
  },
  pro: {
    name: "Pro",
    price: 29,
    description: "解锁全部功能，无限使用",
    features: [
      "无限方案生成",
      "无限 AI 对话",
      "无限工具搜索",
      "全部教程访问",
      "Claude Opus 模型可选",
      "优先客服支持",
    ],
    limits: {
      planGenerations: -1,
      aiRequests: -1,
      toolSearches: -1,
    },
  },
} as const;

const PRO_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "price_placeholder";

export function getPlanByPriceId(priceId: string): "pro" | null {
  return priceId === PRO_PRICE_ID ? "pro" : null;
}

export function getFreeLimits() {
  return PLANS.free.limits;
}

export function getProLimits() {
  return PLANS.pro.limits;
}
```

- [ ] **Step 6: Create Stripe server client**

Create `src/lib/stripe/server.ts`:

```ts
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil",
      typescript: true,
    });
  }
  return stripeInstance;
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/lib/stripe/config.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stripe/ tests/lib/stripe/ .env.example package.json pnpm-lock.yaml
git commit -m "feat: add Stripe client and plan config with tests"
```

---

### Task 2: Subscription Helper

**Files:**
- Create: `src/lib/subscription.ts`

- [ ] **Step 1: Create server-side subscription helper**

Create `src/lib/subscription.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export interface SubscriptionInfo {
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due";
  isPro: boolean;
  currentPeriodEnd: string | null;
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!data) {
    return {
      plan: "free",
      status: "active",
      isPro: false,
      currentPeriodEnd: null,
    };
  }

  return {
    plan: data.plan as "free" | "pro",
    status: data.status as "active" | "canceled" | "past_due",
    isPro: data.plan === "pro",
    currentPeriodEnd: data.current_period_end,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/subscription.ts
git commit -m "feat: add server-side subscription helper"
```

---

### Task 3: Stripe Checkout API Route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Create checkout session endpoint**

Create `src/app/api/stripe/checkout/route.ts`:

```ts
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

    // Check if user already has a Stripe customer
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_sub_id")
      .eq("user_id", user.id)
      .single();

    const sessionParams: Record<string, unknown> = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { userId: user.id },
    };

    // If user already has a subscription, don't set email (Stripe will match customer)
    if (subscription?.stripe_sub_id) {
      return Response.json(
        { error: "已有活跃订阅" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return Response.json(
      { error: "创建支付会话失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe checkout session API route"
```

---

### Task 4: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Create webhook handler**

Create `src/app/api/stripe/webhook/route.ts`:

```ts
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

        // Get subscription details from Stripe
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
```

- [ ] **Step 2: Add SUPABASE_SERVICE_ROLE_KEY to .env.example**

Add to `.env.example`:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts .env.example
git commit -m "feat: add Stripe webhook handler for subscription sync"
```

---

### Task 5: Stripe Billing Portal Route

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

- [ ] **Step 1: Create billing portal endpoint**

Create `src/app/api/stripe/portal/route.ts`:

```ts
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

    // Get customer from subscription
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe billing portal API route"
```

---

### Task 6: Pricing Card Component + Tests

**Files:**
- Create: `src/components/pricing/pricing-card.tsx`
- Test: `tests/components/pricing/pricing-card.test.tsx`

- [ ] **Step 1: Write the pricing card test**

Create `tests/components/pricing/pricing-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PricingCard } from "@/components/pricing/pricing-card";

describe("PricingCard", () => {
  const freeProps = {
    name: "Free",
    price: 0,
    description: "基础功能",
    features: ["功能 A", "功能 B"],
    isCurrentPlan: true,
    isPro: false,
  };

  const proProps = {
    name: "Pro",
    price: 29,
    description: "全部功能",
    features: ["功能 A", "功能 B", "功能 C"],
    isCurrentPlan: false,
    isPro: false,
    highlighted: true,
  };

  it("renders plan name and price", () => {
    render(<PricingCard {...freeProps} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText(/免费/)).toBeInTheDocument();
  });

  it("renders pro price with currency", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/¥29/)).toBeInTheDocument();
    expect(screen.getByText(/\/月/)).toBeInTheDocument();
  });

  it("renders all features", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByText("功能 A")).toBeInTheDocument();
    expect(screen.getByText("功能 B")).toBeInTheDocument();
    expect(screen.getByText("功能 C")).toBeInTheDocument();
  });

  it("shows current plan badge when isCurrentPlan is true", () => {
    render(<PricingCard {...freeProps} />);
    expect(screen.getByText("当前方案")).toBeInTheDocument();
  });

  it("shows upgrade button for non-current pro plan", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByRole("button", { name: /升级/ })).toBeInTheDocument();
  });

  it("disables upgrade button when already pro", () => {
    render(<PricingCard {...proProps} isPro={true} isCurrentPlan={true} />);
    expect(screen.queryByRole("button", { name: /升级/ })).not.toBeInTheDocument();
    expect(screen.getByText("当前方案")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/pricing/pricing-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PricingCard component**

Create `src/components/pricing/pricing-card.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricingCardProps {
  name: string;
  price: number;
  description: string;
  features: string[];
  isCurrentPlan: boolean;
  isPro: boolean;
  highlighted?: boolean;
  onUpgrade?: () => void;
}

export function PricingCard({
  name,
  price,
  description,
  features,
  isCurrentPlan,
  isPro,
  highlighted = false,
  onUpgrade,
}: PricingCardProps) {
  return (
    <Card
      className={`relative flex flex-col ${
        highlighted ? "border-primary shadow-lg shadow-primary/10" : ""
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge>推荐</Badge>
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          {isCurrentPlan && (
            <Badge variant="secondary">当前方案</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="mb-6">
          {price === 0 ? (
            <span className="text-3xl font-bold">免费</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">¥{price}</span>
              <span className="text-muted-foreground">/月</span>
            </div>
          )}
        </div>

        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            当前方案
          </Button>
        ) : price > 0 ? (
          <Button className="w-full" onClick={onUpgrade}>
            升级到 {name}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/pricing/pricing-card.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pricing/pricing-card.tsx tests/components/pricing/pricing-card.test.tsx
git commit -m "feat: add PricingCard component with tests"
```

---

### Task 7: Upgrade Banner Component + Tests

**Files:**
- Create: `src/components/pricing/upgrade-banner.tsx`
- Test: `tests/components/pricing/upgrade-banner.test.tsx`

- [ ] **Step 1: Write the upgrade banner test**

Create `tests/components/pricing/upgrade-banner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UpgradeBanner } from "@/components/pricing/upgrade-banner";

describe("UpgradeBanner", () => {
  it("renders nothing when isPro is true", () => {
    const { container } = render(<UpgradeBanner isPro={true} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders upgrade message when isPro is false", () => {
    render(<UpgradeBanner isPro={false} />);
    expect(screen.getByText(/升级 Pro/)).toBeInTheDocument();
  });

  it("renders upgrade link to pricing page", () => {
    render(<UpgradeBanner isPro={false} />);
    const link = screen.getByRole("link", { name: /升级/ });
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("renders custom message when provided", () => {
    render(<UpgradeBanner isPro={false} message="今日免费额度已用完" />);
    expect(screen.getByText("今日免费额度已用完")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/pricing/upgrade-banner.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement UpgradeBanner component**

Create `src/components/pricing/upgrade-banner.tsx`:

```tsx
import { Card } from "@/components/ui/card";

interface UpgradeBannerProps {
  isPro: boolean;
  message?: string;
}

export function UpgradeBanner({ isPro, message }: UpgradeBannerProps) {
  if (isPro) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {message ?? "升级 Pro 解锁无限使用"}
          </p>
          <p className="text-xs text-muted-foreground">
            无限 AI 对话、方案生成、Claude Opus 模型
          </p>
        </div>
        <a
          href="/pricing"
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          升级 Pro
        </a>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/pricing/upgrade-banner.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/pricing/upgrade-banner.tsx tests/components/pricing/upgrade-banner.test.tsx
git commit -m "feat: add UpgradeBanner component with tests"
```

---

### Task 8: User Menu Component + Tests

**Files:**
- Create: `src/components/layout/user-menu.tsx`
- Test: `tests/components/layout/user-menu.test.tsx`

- [ ] **Step 1: Write the user menu test**

Create `tests/components/layout/user-menu.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserMenu } from "@/components/layout/user-menu";

describe("UserMenu", () => {
  const defaultProps = {
    email: "test@example.com",
    isPro: false,
    onSignOut: vi.fn(),
  };

  it("renders user email initial as avatar", () => {
    render(<UserMenu {...defaultProps} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("shows Pro badge when isPro is true", () => {
    render(<UserMenu {...defaultProps} isPro={true} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("does not show Pro badge when isPro is false", () => {
    render(<UserMenu {...defaultProps} isPro={false} />);
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });

  it("shows dropdown items on click", () => {
    render(<UserMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("退出登录")).toBeInTheDocument();
  });

  it("calls onSignOut when sign out is clicked", () => {
    const onSignOut = vi.fn();
    render(<UserMenu {...defaultProps} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("退出登录"));
    expect(onSignOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/layout/user-menu.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement UserMenu component**

Create `src/components/layout/user-menu.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface UserMenuProps {
  email: string;
  isPro: boolean;
  onSignOut: () => void;
}

export function UserMenu({ email, isPro, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {initial}
        </div>
        {isPro && <Badge>Pro</Badge>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-muted-foreground">
              {isPro ? "Pro 会员" : "免费版"}
            </p>
          </div>

          {isPro && (
            <a
              href="/api/stripe/portal"
              className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              管理订阅
            </a>
          )}

          {!isPro && (
            <a
              href="/pricing"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted"
            >
              升级 Pro
            </a>
          )}

          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/layout/user-menu.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/user-menu.tsx tests/components/layout/user-menu.test.tsx
git commit -m "feat: add UserMenu dropdown component with tests"
```

---

### Task 9: Auth-Aware Navbar

**Files:**
- Modify: `src/components/layout/navbar.tsx`
- Create: `src/components/layout/navbar-auth.tsx`

The current navbar is a server component with no auth state. We'll add a client-side auth wrapper that shows either login/signup or the user menu.

- [ ] **Step 1: Create NavbarAuth client component**

Create `src/components/layout/navbar-auth.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface NavbarAuthProps {
  initialUser: { email: string } | null;
  isPro: boolean;
}

export function NavbarAuth({ initialUser, isPro }: NavbarAuthProps) {
  const [user, setUser] = useState(initialUser);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">登录</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/signup">注册</Link>
        </Button>
      </div>
    );
  }

  return (
    <UserMenu
      email={user.email}
      isPro={isPro}
      onSignOut={handleSignOut}
    />
  );
}
```

- [ ] **Step 2: Update Navbar to be a server component with auth**

Read the current `src/components/layout/navbar.tsx` and modify it to fetch auth state and pass it to NavbarAuth. Replace the existing login/signup buttons section with the NavbarAuth component.

Modify `src/components/layout/navbar.tsx` — replace the right-side buttons section:

Find this block (the login/signup buttons):
```tsx
<div className="flex items-center gap-2">
  <Button variant="ghost" size="sm" asChild>
    <Link href="/login">登录</Link>
  </Button>
  <Button size="sm" asChild>
    <Link href="/signup">注册</Link>
  </Button>
</div>
```

Replace with:
```tsx
<NavbarAuth initialUser={user} isPro={isPro} />
```

Add these imports to the top:
```tsx
import { createClient } from "@/lib/supabase/server";
import { NavbarAuth } from "./navbar-auth";
```

Make the component async and add auth fetch at the top of the function body:
```tsx
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();

let isPro = false;
if (authUser) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", authUser.id)
    .eq("status", "active")
    .single();
  isPro = sub?.plan === "pro";
}

const user = authUser ? { email: authUser.email ?? "" } : null;
```

Remove the old `Button` and `Link` imports if no longer used by other parts of the component. Keep `Link` if still used for nav links.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/navbar.tsx src/components/layout/navbar-auth.tsx
git commit -m "feat: add auth-aware navbar with user menu and Pro badge"
```

---

### Task 10: Pricing Page

**Files:**
- Create: `src/app/pricing/page.tsx`

- [ ] **Step 1: Create the pricing page**

Create `src/app/pricing/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe/config";
import { PricingPageClient } from "./pricing-page-client";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: "free" | "pro" = "free";

  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (sub?.plan === "pro") {
      currentPlan = "pro";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">选择你的方案</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          免费开始，随时升级
        </p>
      </div>

      <PricingPageClient
        currentPlan={currentPlan}
        isLoggedIn={!!user}
        freePlan={PLANS.free}
        proPlan={PLANS.pro}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create PricingPageClient**

Create `src/app/pricing/pricing-page-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PricingCard } from "@/components/pricing/pricing-card";

interface PlanInfo {
  name: string;
  price: number;
  description: string;
  features: readonly string[];
}

interface PricingPageClientProps {
  currentPlan: "free" | "pro";
  isLoggedIn: boolean;
  freePlan: PlanInfo;
  proPlan: PlanInfo;
}

export function PricingPageClient({
  currentPlan,
  isLoggedIn,
  freePlan,
  proPlan,
}: PricingPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const handleUpgrade = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "创建支付会话失败");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("无法打开订阅管理");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {success && (
        <div className="mb-8 rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-400">
          升级成功！Pro 功能已解锁 🎉
        </div>
      )}

      {canceled && (
        <div className="mb-8 rounded-lg bg-yellow-500/10 p-4 text-center text-sm text-yellow-400">
          支付已取消，你仍在使用免费版
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <PricingCard
          name={freePlan.name}
          price={freePlan.price}
          description={freePlan.description}
          features={[...freePlan.features]}
          isCurrentPlan={currentPlan === "free"}
          isPro={currentPlan === "pro"}
        />

        <PricingCard
          name={proPlan.name}
          price={proPlan.price}
          description={proPlan.description}
          features={[...proPlan.features]}
          isCurrentPlan={currentPlan === "pro"}
          isPro={currentPlan === "pro"}
          highlighted={true}
          onUpgrade={currentPlan === "pro" ? handleManage : handleUpgrade}
        />
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-500">{error}</p>
      )}

      {loading && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          正在跳转...
        </p>
      )}

      {currentPlan === "pro" && (
        <div className="mt-8 text-center">
          <button
            onClick={handleManage}
            className="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
          >
            管理订阅
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pricing/
git commit -m "feat: add pricing page with Stripe checkout integration"
```

---

### Task 11: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

```bash
npx vitest run
```

Expected: All tests pass (previous 90 + 15 new = ~105).

- [ ] **Step 2: Run all backend tests**

```bash
cd services/backend && npx vitest run
```

Expected: 29 tests pass.

- [ ] **Step 3: Run Next.js build**

```bash
npx next build
```

Expected: Build succeeds. Route table includes:
- `/pricing` (static or dynamic)
- `/api/stripe/checkout` (dynamic)
- `/api/stripe/webhook` (dynamic)
- `/api/stripe/portal` (dynamic)

- [ ] **Step 4: Verify route table**

Check that all routes appear in the build output, particularly:
- `ƒ /api/stripe/checkout`
- `ƒ /api/stripe/webhook`
- `ƒ /api/stripe/portal`
- `/pricing`

- [ ] **Step 5: Commit any fixes if needed**

If any type errors or test failures occurred, fix them and commit.
