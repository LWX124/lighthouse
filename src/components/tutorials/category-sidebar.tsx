import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

interface CategorySidebarProps {
  categories: Category[];
  activeSlug?: string;
}

function buildTree(
  categories: Category[]
): (Category & { children: Category[] })[] {
  const map = new Map<string | null, Category[]>();
  for (const cat of categories) {
    const parentId = cat.parent_id;
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId)!.push(cat);
  }

  function getChildren(
    parentId: string | null
  ): (Category & { children: Category[] })[] {
    return (map.get(parentId) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((cat) => ({ ...cat, children: getChildren(cat.id) }));
  }

  return getChildren(null);
}

export function CategorySidebar({
  categories,
  activeSlug,
}: CategorySidebarProps) {
  const tree = buildTree(categories);

  return (
    <aside className="w-64 shrink-0 border-r border-border">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            教程分类
          </h2>
          <nav className="space-y-1">
            {tree.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                activeSlug={activeSlug}
                depth={0}
              />
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  );
}

function CategoryItem({
  category,
  activeSlug,
  depth,
}: {
  category: Category & {
    children: (Category & { children: Category[] })[];
  };
  activeSlug?: string;
  depth: number;
}) {
  const isActive = category.slug === activeSlug;

  return (
    <div>
      <Link
        href={`/tutorials/${category.slug}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
          isActive
            ? "bg-muted font-medium text-primary"
            : "text-muted-foreground"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {category.icon && <span>{category.icon}</span>}
        <span>{category.name}</span>
      </Link>
      {category.children.length > 0 && (
        <div>
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              activeSlug={activeSlug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
