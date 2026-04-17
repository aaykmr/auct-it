import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuctionGrid } from "@/components/auction-grid";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

async function getAuctions() {
  try {
    const res = await fetch(`${API}/v1/auctions`, { next: { revalidate: 15 } });
    if (!res.ok) return { auctions: [] };
    const data = await res.json();
    return data as {
      auctions: {
        id: string;
        endAt: string;
        currentBid: string | null;
        listing: {
          title: string;
          basePrice: unknown;
          category: { name: string };
          cities: { city: { name: string } }[];
        };
      }[];
    };
  } catch {
    return { auctions: [] };
  }
}

export default async function HomePage() {
  const { auctions } = await getAuctions();
  const normalized = auctions.map((a) => ({
    ...a,
    listing: {
      ...a.listing,
      basePrice: String(a.listing.basePrice),
    },
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <section className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Live auctions</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
            Filter by city and category, bid in real time, and complete pickup with escrow protection.
          </p>
        </div>
        <Link href="/browse" className={cn(buttonVariants({ variant: "default" }), "w-fit")}>
          Browse all
        </Link>
      </section>
      <AuctionGrid auctions={normalized} />
    </div>
  );
}
