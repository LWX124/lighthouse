import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";
import { TutorialCard } from "@/components/tutorials/tutorial-card";

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;
  const supabase = await createClient();

  const [{ data: categories }, { data: currentCategory }] = await Promise.all([
    supabase.from("categories").select("*").order("order"),
    supabase
      .from("categories")
      .select("*")
      .eq("slug", categorySlug)
      .single(),
  ]);

  if (!currentCategory) notFound();

  const { data: tutorials } = await supabase
    .from("tutorials")
    .select("*")
    .eq("category_id", currentCategory.id)
    .eq("status", "published")
    .order("order");

  return (
    <div className="flex">
      <CategorySidebar
        categories={categories ?? []}
        activeSlug={categorySlug}
      />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {currentCategory.icon} {currentCategory.name}
          </h1>
          {currentCategory.description && (
            <p className="mt-2 text-muted-foreground">
              {currentCategory.description}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {tutorials?.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              categorySlug={categorySlug}
            />
          ))}
          {(!tutorials || tutorials.length === 0) && (
            <p className="text-muted-foreground">该分类暂无教程</p>
          )}
        </div>
      </div>
    </div>
  );
}
