"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useIsLoggedIn } from "@/lib/use-auth";
import { api, getStoredToken } from "@/lib/api";

type ListingRow = {
  id: string;
  title: string;
  status: string;
  basePrice: unknown;
  category: { name: string };
  auctions: { id: string; status: string; endAt: string }[];
};

export default function SellingPage() {
  const loggedIn = useIsLoggedIn();
  const { openLogin } = useLoginSheet();
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [total, setTotal] = useState(0);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setListings([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api<{
        listings: ListingRow[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/v1/listings/mine?page=${page}&pageSize=${pageSize}`, { token });
      setListings(r.listings);
      setTotal(r.total);
    } catch {
      setListings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!loggedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Selling</CardTitle>
            <CardDescription className="text-base">Sign in to see listings you sell.</CardDescription>
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <div className="mb-8 flex flex-col gap-2 md:mb-10">
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">Your listings</h1>
        <p className="text-muted-foreground text-base md:text-lg">Items you are selling on AuctIt.</p>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-base">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-muted-foreground text-base">No listings yet.</p>
      ) : (
        <ul className="space-y-4">
          {listings.map((l) => {
            const auction = l.auctions?.[0];
            const base = String(l.basePrice);
            return (
              <li key={l.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg md:text-xl">{l.title}</CardTitle>
                    <CardDescription className="text-base">
                      {l.category.name} · Base ₹{base} · {l.status}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {auction && (
                      <Link
                        href={`/auctions/${auction.id}`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "md:text-base")}
                      >
                        View auction
                      </Link>
                    )}
                    <Link
                      href="/seller/listings/new"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "md:text-base")}
                    >
                      Seller hub
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {total > pageSize && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm md:text-base">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
