"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useToast } from "@/components/toast-provider";
import { useIsLoggedIn } from "@/lib/use-auth";
import { api, getStoredToken } from "@/lib/api";

type AuctionRow = {
  id: string;
  endAt: string;
  status: string;
  currentBid: string | null;
  myLatestBidAmount: string | null;
  amIWinning: boolean;
  canCancel: boolean;
  listing: {
    title: string;
    basePrice: string;
    category: { name: string };
    cities: { city: { name: string } }[];
  };
};

export default function BiddingPage() {
  const loggedIn = useIsLoggedIn();
  const { openLogin } = useLoginSheet();
  const showToast = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [total, setTotal] = useState(0);
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AuctionRow | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setAuctions([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api<{
        auctions: AuctionRow[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/v1/me/auctions/bidding?page=${page}&pageSize=${pageSize}`, { token });
      setAuctions(r.auctions);
      setTotal(r.total);
    } catch {
      setAuctions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function executeCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    const token = getStoredToken();
    if (!token) throw new Error("Not signed in");
    try {
      await api(`/v1/auctions/${id}/bids/mine`, { method: "DELETE", token });
    } catch {
      throw new Error("Could not cancel bid");
    }
    showToast("Bid cancelled");
    void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!loggedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">My bids</CardTitle>
            <CardDescription className="text-base">Sign in to see auctions you have bid on.</CardDescription>
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
      <ConfirmSheet
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) setCancelTarget(null);
        }}
        title="Cancel bid"
        description={
          cancelTarget?.myLatestBidAmount
            ? `Withdraw your bid of ₹${cancelTarget.myLatestBidAmount}? The next highest bid will become current.`
            : "Withdraw your bid?"
        }
        confirmLabel="Cancel bid"
        cancelLabel="Keep bid"
        variant="destructive"
        onConfirm={executeCancel}
      />

      <div className="mb-8 flex flex-col gap-2 md:mb-10">
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">My bids</h1>
        <p className="text-muted-foreground text-base md:text-lg">Auctions where you have a winning bid history.</p>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-base">Loading…</p>
      ) : auctions.length === 0 ? (
        <p className="text-muted-foreground text-base">No bids yet.</p>
      ) : (
        <ul className="space-y-4">
          {auctions.map((a) => (
            <li key={a.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg md:text-xl">{a.listing.title}</CardTitle>
                  <CardDescription className="text-base">
                    {a.listing.category.name} · {a.listing.cities.map((c) => c.city.name).join(" · ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm md:text-base">
                    Current: ₹{a.currentBid ?? a.listing.basePrice} · Your latest: ₹
                    {a.myLatestBidAmount ?? "—"}
                    {a.amIWinning ? (
                      <span className="text-primary font-medium"> · You are winning</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/auctions/${a.id}`}
                      className={cn(buttonVariants({ size: "sm" }), "md:text-base")}
                    >
                      View auction
                    </Link>
                    {a.canCancel && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="md:text-base"
                        onClick={() => {
                          setCancelTarget(a);
                          setCancelOpen(true);
                        }}
                      >
                        Cancel bid
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
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
