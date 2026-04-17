"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingLocationLine, type ListingCityRef } from "@/components/listing-location";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useIsLoggedIn } from "@/lib/use-auth";
import { api, getStoredToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type FulfillmentRow = {
  id: string;
  status: string;
  mode: string;
  buyerId: string;
  auction?: {
    id: string;
    listing?: {
      id?: string;
      title?: string;
      basePrice?: unknown;
      category?: { name?: string | null } | null;
      cities?: { city?: { name?: string | null } | null }[] | null;
      images?: { url?: string | null }[] | null;
    } | null;
  } | null;
};

export default function WonBidsPage() {
  const loggedIn = useIsLoggedIn();
  const { openLogin } = useLoginSheet();
  const [rows, setRows] = useState<FulfillmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [me, r] = await Promise.all([
        api<{ user: { id: string } }>("/v1/me", { token }),
        api<{ fulfillments: FulfillmentRow[] }>("/v1/fulfillments/mine", { token }),
      ]);
      setRows(r.fulfillments.filter((f) => f.buyerId === me.user.id));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loggedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Won bids</CardTitle>
            <CardDescription>Sign in to see auctions you won.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => openLogin()}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-bold">Won bids</h1>
      <p className="text-muted-foreground mt-2 text-sm">Purchases from auctions where you were the highest bidder.</p>
      <div className="mt-8 space-y-4">
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No won auctions yet. When you win, they will appear here.</p>
        )}
        {rows.map((f) => {
          const listing = f.auction?.listing;
          const auctionId = f.auction?.id;
          const listingId = listing?.id;
          const img = listing?.images?.[0]?.url ?? undefined;
          const title = listing?.title?.trim() || "Listing";
          const categoryName = listing?.category?.name?.trim();
          const cities: ListingCityRef[] = (listing?.cities ?? [])
            .map((lc) => {
              const name = lc?.city?.name;
              if (typeof name !== "string" || !name.trim()) return null;
              return { city: { name: name.trim() } };
            })
            .filter((x): x is ListingCityRef => x !== null);
          const baseRaw = listing?.basePrice;
          const base = baseRaw !== undefined && baseRaw !== null ? String(baseRaw) : "—";
          return (
            <Card key={f.id}>
              <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start">
                <div className="bg-muted relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg sm:w-40">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center text-xs">No image</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="font-semibold leading-tight">{title}</h2>
                  {categoryName ? (
                    <p className="text-muted-foreground text-xs">{categoryName}</p>
                  ) : null}
                  <ListingLocationLine
                    cities={cities}
                    className="text-muted-foreground text-sm"
                    iconClassName="size-4 shrink-0"
                  />
                  <p className="text-sm">
                    Listing from <span className="font-medium">₹{base}</span> · Fulfillment:{" "}
                    <span className="capitalize">{(f.status ?? "unknown").replace("_", " ")}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {auctionId ? (
                      <Link
                        href={`/auctions/${auctionId}`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                      >
                        View auction
                      </Link>
                    ) : null}
                    {f.status === "pending" && listingId ? (
                      <Link
                        href={`/listings/${listingId}/schedule`}
                        className={cn(buttonVariants({ size: "sm" }))}
                      >
                        Schedule visit
                      </Link>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
