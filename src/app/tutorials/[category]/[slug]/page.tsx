import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";
import { MdxRenderer } from "@/components/tutorials/mdx-renderer";
import { Badge } from "@/components/ui/badge";

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export default async function TutorialPage({ params }: Props) {
  const { category: categorySlug, slug } = await params;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("order");

  const { data: tutorial } = await supabase
    .from("tutorials")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!tutorial) notFound();

  // Get prev/next tutorials in same category
  const { data: siblings } = await supabase
    .from("tutorials")
    .select("title, slug, order")
    .eq("category_id", tutorial.category_id!)
    .eq("status", "published")
    .order("order");

  const currentIndex = siblings?.findIndex((t) => t.slug === slug) ?? -1;
  const prev = currentIndex > 0 ? siblings![currentIndex - 1] : null;
  const next =
    siblings && currentIndex < siblings.length - 1
      ? siblings[currentIndex + 1]
      : null;

  return (
    <div className="flex">
      <CategorySidebar
        categories={categories ?? []}
        activeSlug={categorySlug}
      />
      <div className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <div className="mb-4 text-sm text-muted-foreground">
            <Link
              href="/tutorials"
              className="hover:text-foreground"
            >
              教程
            </Link>
            {" / "}
            <Link
              href={`/tutorials/${categorySlug}`}
              className="hover:text-foreground"
            >
              {categories?.find((c) => c.slug === categorySlug)?.name}
            </Link>
          </div>

          {/* Header */}
          <h1 className="text-3xl font-bold">{tutorial.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span>🕐 {tutorial.read_time_minutes} 分钟</span>
            <span>👁 {tutorial.view_count.toLocaleString()} 浏览</span>
            {tutorial.is_free && <Badge variant="secondary">免费</Badge>}
          </div>

          {/* Content */}
          <div className="mt-8">
            <MdxRenderer content={tutorial.content} />
          </div>

          {/* Prev/Next navigation */}
          <div className="mt-12 flex justify-between border-t border-border pt-6">
            {prev ? (
              <Link
                href={`/tutorials/${categorySlug}/${prev.slug}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/tutorials/${categorySlug}/${next.slug}`}
                className="text-sm text-primary hover:underline"
              >
                {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
