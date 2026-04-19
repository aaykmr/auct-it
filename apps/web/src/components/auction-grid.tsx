import Image from "next/image";
import Link from "next/link";
import { ListingLocationLine } from "@/components/listing-location";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/countdown";

type AuctionRow = {
  id: string;
  endAt: string;
  currentBid: string | null;
  listing: {
    title: string;
    basePrice: string;
    coverImageUrl?: string | null;
    category: { name: string };
    cities: { city: { name: string } }[];
  };
};

export function AuctionGrid({
  auctions,
  variant = "live",
}: {
  auctions: AuctionRow[];
  variant?: "live" | "recent";
}) {
  if (auctions.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {variant === "recent"
          ? "No recently ended auctions in the last 2 days for these filters."
          : "No live auctions match your filters. Try adjusting cities or category."}
      </p>
    );
  }
  const isRecent = variant === "recent";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {auctions.map((a) => (
        <Link key={a.id} href={`/auctions/${a.id}`} className="group block">
          <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
            <CardHeader className="p-0">
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src={
                    a.listing.coverImageUrl ??
                    `https://picsum.photos/seed/${a.id}/400/300`
                  }
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                />
                <Badge className="absolute left-2 top-2 bg-secondary text-secondary-foreground">
                  {a.listing.category.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{a.listing.title}</p>
              <ListingLocationLine cities={a.listing.cities} separator=", " variant="block" className="text-xs" />
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-1 border-t bg-muted/30 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{isRecent ? "Final bid" : "Current bid"}</span>
                <span className="font-semibold text-primary">
                  ₹{a.currentBid ?? a.listing.basePrice}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{isRecent ? "Ended" : "Ends in"}</span>
                {isRecent ? (
                  <span className="text-right font-medium tabular-nums">
                    {new Date(a.endAt).toLocaleString()}
                  </span>
                ) : (
                  <Countdown endAt={a.endAt} />
                )}
              </div>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
