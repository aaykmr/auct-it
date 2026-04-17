import { AuctionDetailClient } from "./auction-detail-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let res: Response;
  try {
    res = await fetch(`${API}/v1/auctions/${id}`, { next: { revalidate: 5 } });
  } catch {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-foreground text-base font-medium">Could not reach the API</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Start the backend (e.g. <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm dev</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">apps/api</code>) or set{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_API_URL</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">apps/web/.env.local</code>.
        </p>
      </div>
    );
  }
  if (!res.ok) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Auction not found.</p>;
  }
  const data = await res.json();
  const auction = data.auction as {
    id: string;
    endAt: string;
    currentBid: string | null;
    listing: {
      title: string;
      basePrice: unknown;
      coverImageUrl?: string | null;
      seller: { id: string; name: string | null };
      category: { name: string };
      cities: { city: { name: string } }[];
    };
  };
  const initial = {
    endAt: auction.endAt,
    currentBid: auction.currentBid,
    listing: {
      ...auction.listing,
      basePrice: String(auction.listing.basePrice),
    },
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <AuctionDetailClient auctionId={id} sellerId={auction.listing.seller.id} initial={initial} />
    </div>
  );
}
