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
            {message ?? "解锁 Pro 无限使用"}
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
