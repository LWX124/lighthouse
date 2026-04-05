import { MDXRemote } from "next-mdx-remote/rsc";

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-8 mb-4 text-3xl font-bold" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-6 mb-3 text-2xl font-semibold" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-4 mb-2 text-xl font-semibold" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 leading-relaxed" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 ml-6 list-disc space-y-1" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-primary"
      {...props}
    />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm"
      {...props}
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-primary underline underline-offset-4 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
};

interface MdxRendererProps {
  content: string;
}

export function MdxRenderer({ content }: MdxRendererProps) {
  return (
    <article className="max-w-none">
      <MDXRemote source={content} components={mdxComponents} />
    </article>
  );
}
