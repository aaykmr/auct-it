"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuctionImageCarousel } from "@/components/auction-image-carousel";
import { ListingLocationLine } from "@/components/listing-location";
import { AuctionBidFields, AuctionBidHeader } from "@/app/auctions/[id]/auction-bid-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BidConfirmOverlay } from "@/components/bid-confirm-overlay";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useToast } from "@/components/toast-provider";
import { api, getStoredToken } from "@/lib/api";
import { clearPendingBid, getPendingBid, setPendingBid } from "@/lib/pending-bid";
import { auctionWebSocketUrl } from "@/lib/ws";
import { cn } from "@/lib/utils";

type BidRow = { id: string; amount: string; createdAt: string; bidder: string };

const BIDDER_TABLE_MAX_LEN = 9;

/** First name only (first whitespace-delimited token), max 9 chars then ellipsis. */
function formatBidderForTable(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  if (!first) return "—";
  if (first.length <= BIDDER_TABLE_MAX_LEN) return first;
  return `${first.slice(0, BIDDER_TABLE_MAX_LEN)}…`;
}

export function AuctionDetailClient({
  auctionId,
  sellerId,
  initial,
}: {
  auctionId: string;
  sellerId: string;
  initial: {
    status: string;
    endAt: string;
    currentBid: string | null;
    listing: {
      id: string;
      title: string;
      basePrice: string;
      coverImageUrl?: string | null;
      imageUrls?: string[];
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
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [participation, setParticipation] = useState<{
    role: "buyer" | "seller" | "none";
    fulfillment: { id: string; status: string; mode: string } | null;
  } | null>(null);

  const auctionEnded = initial.status === "ended";
  const minNext = Number(current ?? initial.listing.basePrice) + 0.01;
  const currentDisplay = current ?? initial.listing.basePrice;

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

  useEffect(() => {
    if (!auctionEnded) {
      setParticipation(null);
      return;
    }
    const token = getStoredToken();
    if (!token) {
      setParticipation(null);
      return;
    }
    void api<{
      role: "buyer" | "seller" | "none";
      fulfillment: { id: string; status: string; mode: string } | null;
    }>(`/v1/auctions/${auctionId}/participation`, { token })
      .then(setParticipation)
      .catch(() => setParticipation(null));
  }, [auctionId, auctionEnded]);

  const loadBidMine = useCallback(async () => {
    const token = getStoredToken();
    if (!token || isSellerViewer || auctionEnded) {
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
  }, [auctionId, isSellerViewer, auctionEnded]);

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

  function openMobileBidEntry() {
    if (auctionEnded) return;
    if (isSellerViewer) return;
    if (!getStoredToken()) {
      openLogin({
        onSuccess: () => setBidSheetOpen(true),
      });
      return;
    }
    setBidSheetOpen(true);
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

  const showMobileBidBar = isSellerViewer === false && !auctionEnded;

  return (
    <>
      <div
        className={cn(
          "grid gap-8 lg:grid-cols-4",
          showMobileBidBar && "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0",
        )}
      >
        <div className="space-y-4 lg:col-span-3">
          <AuctionImageCarousel
            auctionId={auctionId}
            title={initial.listing.title}
            imageUrls={initial.listing.imageUrls ?? (initial.listing.coverImageUrl ? [initial.listing.coverImageUrl] : [])}
          />
          <div>
            <p className="text-muted-foreground text-sm md:text-base">{initial.listing.category.name}</p>
            <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">{initial.listing.title}</h1>
            <ListingLocationLine
              cities={initial.listing.cities}
              className="mt-2 text-sm md:text-base"
              iconClassName="size-5 shrink-0 text-muted-foreground md:size-6"
            />
          </div>
          {auctionEnded && (
            <Card className="lg:hidden">
              <AuctionBidHeader variant="ended" endAt={initial.endAt} />
              <CardContent className="space-y-3">
                {participation?.role === "buyer" && (
                  <Link
                    href={`/listings/${initial.listing.id}/schedule`}
                    className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full")}
                  >
                    Schedule visit
                  </Link>
                )}
                {participation?.role === "seller" && (
                  <Link
                    href="/seller/visits"
                    className={cn(buttonVariants({ variant: "secondary", size: "default" }), "w-full")}
                  >
                    Manage visit slots
                  </Link>
                )}
                {participation && participation.role === "none" && (
                  <p className="text-muted-foreground text-sm">This auction has ended.</p>
                )}
              </CardContent>
            </Card>
          )}
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
                      <TableCell className="max-w-[10ch] font-medium" title={b.bidder}>
                      {formatBidderForTable(b.bidder)}
                    </TableCell>
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
        <div className="hidden lg:col-span-1 lg:block">
          <Card className="sticky top-20">
            {auctionEnded ? (
              <>
                <AuctionBidHeader variant="ended" endAt={initial.endAt} />
                <CardContent className="space-y-3">
                  {participation?.role === "buyer" && (
                    <Link
                      href={`/listings/${initial.listing.id}/schedule`}
                      className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full")}
                    >
                      Schedule visit
                    </Link>
                  )}
                  {participation?.role === "seller" && (
                    <Link
                      href="/seller/visits"
                      className={cn(buttonVariants({ variant: "secondary", size: "default" }), "w-full")}
                    >
                      Manage visit slots
                    </Link>
                  )}
                  {participation && participation.role === "none" && (
                    <p className="text-muted-foreground text-sm">This auction has ended.</p>
                  )}
                </CardContent>
              </>
            ) : (
              <>
                <AuctionBidHeader endAt={initial.endAt} />
                <CardContent className="space-y-3">
                  <AuctionBidFields
                    isSellerViewer={isSellerViewer}
                    currentDisplay={currentDisplay}
                    minNext={minNext}
                    amount={amount}
                    onAmountChange={setAmount}
                    onRequestBid={requestBid}
                    bidMine={bidMine}
                    onCancelClick={() => setCancelConfirmOpen(true)}
                    msg={msg}
                  />
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>

      {showMobileBidBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 backdrop-blur-md lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <Button type="button" className="w-full" aria-label="Open bidding" onClick={openMobileBidEntry}>
            Bid
          </Button>
        </div>
      )}

      {!auctionEnded && (
        <Sheet open={bidSheetOpen} onOpenChange={setBidSheetOpen}>
          <SheetContent
            side="bottom"
            showCloseButton
            className="max-h-[min(90dvh,720px)] gap-0 rounded-t-xl p-0 sm:mx-auto sm:max-w-lg"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Place a bid</SheetTitle>
              <SheetDescription>Current auction price and bid form.</SheetDescription>
            </SheetHeader>
            <div className="flex max-h-[min(90dvh,720px)] flex-col">
              <AuctionBidHeader endAt={initial.endAt} className="shrink-0 border-b" />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                <AuctionBidFields
                  isSellerViewer={isSellerViewer}
                  currentDisplay={currentDisplay}
                  minNext={minNext}
                  amount={amount}
                  onAmountChange={setAmount}
                  onRequestBid={requestBid}
                  bidMine={bidMine}
                  onCancelClick={() => setCancelConfirmOpen(true)}
                  msg={msg}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

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
    </>
  );
}
