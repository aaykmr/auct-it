import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  let article: { title: string; bodyMarkdown: string } | null = null;
  try {
    const res = await fetch(`${API}/v1/help/articles/${category}/${slug}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      article = data.article;
    }
  } catch {
    /* */
  }
  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted-foreground text-sm">Article not found.</p>
        <Link href="/help" className="text-primary mt-4 inline-block text-sm">
          Back to Help
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <Link href="/help" className="text-muted-foreground text-sm hover:text-foreground">
        ← Help
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{article.title}</h1>
      <div className="mt-6 max-w-none whitespace-pre-wrap text-sm leading-relaxed">
        {article.bodyMarkdown}
      </div>
      <p className="text-muted-foreground mt-10 text-sm">Still need help? Open a dispute with photo/video evidence from your order.</p>
    </div>
  );
}
