import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const revalidate = 3600; // ISR: 1 hour

export default async function TutorialsPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("order");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">教程</h1>
        <p className="mt-2 text-muted-foreground">
          系统化学习 AI 工具和实践方法
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories?.map((cat) => (
          <Link key={cat.id} href={`/tutorials/${cat.slug}`}>
            <Card className="border-border bg-card p-6 transition-colors hover:border-primary/50">
              <div className="mb-3 text-3xl">{cat.icon}</div>
              <h2 className="text-lg font-semibold">{cat.name}</h2>
              {cat.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {cat.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
