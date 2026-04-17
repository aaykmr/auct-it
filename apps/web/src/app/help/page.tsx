import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export default async function HelpPage() {
  let categories: {
    id: string;
    title: string;
    slug: string;
    articles: { id: string; slug: string; title: string }[];
  }[] = [];
  try {
    const res = await fetch(`${API}/v1/help/categories`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      categories = data.categories;
    }
  } catch {
    /* offline */
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-3xl font-bold">Help</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Browse topics like on Zomato Help — pick a category, then an article.
      </p>
      <div className="mt-8 space-y-8">
        {categories.map((c) => (
          <section key={c.id}>
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.articles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/help/${c.slug}/${a.slug}`}
                    className="text-primary text-sm hover:underline"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {categories.length === 0 && (
          <p className="text-muted-foreground text-sm">Help content loads when the API is running.</p>
        )}
      </div>
    </div>
  );
}
