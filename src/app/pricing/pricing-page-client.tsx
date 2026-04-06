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
