"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Countdown } from "@/components/countdown";
import { BidConfirmOverlay } from "@/components/bid-confirm-overlay";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useToast } from "@/components/toast-provider";
import { api, getStoredToken } from "@/lib/api";
import { clearPendingBid, getPendingBid, setPendingBid } from "@/lib/pending-bid";
import { auctionWebSocketUrl } from "@/lib/ws";

type BidRow = { id: string; amount: string; createdAt: string; bidder: string };

export function AuctionDetailClient({
  auctionId,
  sellerId,
  initial,
}: {
  auctionId: string;
  sellerId: string;
  initial: {
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
}) {
  const { openLogin } = useLoginSheet();
  const showToast = useToast();
  const [current, setCurrent] = useState(initial.currentBid);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isSellerViewer, setIsSellerViewer] = useState<boolean | null>(null);
  const [placeConfirmOpen, setPlaceConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [bidMine, setBidMine] = useState<{
    canCancel: boolean;
    myLatestBidAmount: string | null;
  } | null>(null);

  const minNext = Number(current ?? initial.listing.basePrice) + 0.01;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsSellerViewer(false);
      return;
    }
    void api<{ user: { id: string } }>("/v1/me", { token })
      .then((r) => setIsSellerViewer(r.user.id === sellerId))
      .catch(() => setIsSellerViewer(false));
  }, [sellerId]);

  const loadBidMine = useCallback(async () => {
    const token = getStoredToken();
    if (!token || isSellerViewer) {
      setBidMine(null);
      return;
    }
    try {
      const r = await api<{ canCancel: boolean; myLatestBidAmount: string | null }>(
        `/v1/auctions/${auctionId}/bids/mine`,
        { token },
      );
      setBidMine(r);
    } catch {
      setBidMine(null);
    }
  }, [auctionId, isSellerViewer]);

  useEffect(() => {
    void loadBidMine();
  }, [loadBidMine]);

  const loadBids = useCallback(async () => {
    try {
      const r = await api<{ bids: BidRow[] }>(`/v1/auctions/${auctionId}/bids/recent`);
      setBids(r.bids);
    } catch {
      setBids([]);
    }
  }, [auctionId]);

  useEffect(() => {
    void loadBids();
  }, [loadBids]);

  useEffect(() => {
    const url = auctionWebSocketUrl(auctionId);
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as { highest?: { amount: string } };
        if (data.highest?.amount) setCurrent(data.highest.amount);
        void loadBids();
        void loadBidMine();
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [auctionId, loadBids, loadBidMine]);

  function validateAmountForBid(): number | null {
    setMsg(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n < minNext) {
      setMsg(`Enter at least ₹${minNext.toFixed(2)}`);
      return null;
    }
    return n;
  }

  function requestBid() {
    const n = validateAmountForBid();
    if (n === null) return;
    const token = getStoredToken();
    if (!token) {
      setPendingBid({ auctionId, amount: String(amount) });
      openLogin({
        onSuccess: () => {
          const p = getPendingBid();
          if (p?.auctionId === auctionId) {
            setAmount(p.amount);
            setPlaceConfirmOpen(true);
          }
        },
      });
      return;
    }
    setPlaceConfirmOpen(true);
  }

  async function executePlaceBid() {
    const n = validateAmountForBid();
    if (n === null) throw new Error("Invalid amount");
    const token = getStoredToken();
    if (!token) throw new Error("Not signed in");
    try {
      await api(`/v1/auctions/${auctionId}/bids`, {
        method: "POST",
        json: { amount: n },
        token,
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bid failed");
      throw e;
    }
    clearPendingBid();
    setAmount("");
    showToast(`Bid placed for ₹${n.toFixed(2)}`);
    void loadBids();
    void loadBidMine();
  }

  async function executeCancelBid() {
    const token = getStoredToken();
    if (!token) throw new Error("Not signed in");
    await api(`/v1/auctions/${auctionId}/bids/mine`, { method: "DELETE", token });
    showToast("Bid cancelled");
    void loadBids();
    void loadBidMine();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      <div className="space-y-4 lg:col-span-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted">
          <Image
            src={
              initial.listing.coverImageUrl ??
              `https://picsum.photos/seed/${auctionId}/1600/1000`
            }
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div>
          <p className="text-muted-foreground text-sm md:text-base">{initial.listing.category.name}</p>
          <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">{initial.listing.title}</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            {initial.listing.cities.map((c) => c.city.name).join(" · ")}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Recent bids</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bidder</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bidder}</TableCell>
                    <TableCell className="text-right">₹{b.amount}</TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs md:text-sm">
                      {new Date(b.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {bids.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm md:text-base">No bids yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card className="relative sticky top-20">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Place a bid</CardTitle>
            <p className="text-muted-foreground text-xs md:text-sm">
              Ends in <Countdown endAt={initial.endAt} />
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-muted-foreground text-xs md:text-sm">Current bid</p>
              <p className="text-2xl font-bold text-primary md:text-3xl">₹{current ?? initial.listing.basePrice}</p>
              <p className="text-muted-foreground text-xs md:text-sm">Min next: ₹{minNext.toFixed(2)}</p>
            </div>
            {isSellerViewer === null ? (
              <p className="text-muted-foreground text-xs md:text-sm">Checking account…</p>
            ) : isSellerViewer ? (
              <p className="text-muted-foreground text-sm md:text-base">
                You listed this item—bidding is disabled; other bids appear below.
              </p>
            ) : (
              <>
                <Input
                  type="number"
                  placeholder="Your bid"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="md:text-base"
                />
                <Button className="w-full md:text-base" onClick={() => void requestBid()}>
                  Bid
                </Button>
                {bidMine?.canCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full md:text-base"
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    Cancel my bid
                  </Button>
                )}
                {msg && <p className="text-destructive text-xs md:text-sm">{msg}</p>}
              </>
            )}
          </CardContent>
          <BidConfirmOverlay
            open={placeConfirmOpen}
            onOpenChange={(o) => {
              setPlaceConfirmOpen(o);
              if (!o) clearPendingBid();
            }}
            title="Confirm bid"
            description={`Place bid of ₹${Number(amount).toFixed(2)}?`}
            confirmLabel="Confirm bid"
            cancelLabel="Decline"
            onConfirm={executePlaceBid}
          />
          <BidConfirmOverlay
            open={cancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            title="Cancel bid"
            description={
              bidMine?.myLatestBidAmount
                ? `Withdraw your bid of ₹${bidMine.myLatestBidAmount}? The next highest bid will become current.`
                : "Withdraw your bid?"
            }
            confirmLabel="Cancel bid"
            cancelLabel="Keep bid"
            variant="destructive"
            onConfirm={executeCancelBid}
          />
        </Card>
      </div>
    </div>
  );
}
