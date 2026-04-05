import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight">
          AI 驱动的
          <br />
          <span className="text-primary">一站式信息平台</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          发现最新 AI 工具，捕捉市场需求，从想法到落地方案，Lighthouse 帮你照亮前路。
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/tutorials">
            <Button size="lg">开始学习</Button>
          </Link>
          <Link href="/tools">
            <Button size="lg" variant="outline">
              探索工具
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: "📚", title: "教程", desc: "系统化 AI 实践教程" },
          { icon: "🏆", title: "AI工具榜", desc: "发现最佳 AI 工具" },
          { icon: "📰", title: "AI新鲜事", desc: "多源 AI 资讯聚合" },
          { icon: "💡", title: "需求Hub", desc: "捕捉高价值需求信号" },
          { icon: "🚀", title: "AI实践", desc: "从想法到落地方案" },
        ].map((item) => (
          <Card
            key={item.title}
            className="border-border bg-card p-6"
          >
            <div className="mb-3 text-3xl">{item.icon}</div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
