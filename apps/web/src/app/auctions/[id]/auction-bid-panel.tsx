"use client";

import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuctionBidHeader({ endAt, className }: { endAt: string; className?: string }) {
  return (
    <CardHeader className={className}>
      <CardTitle className="text-base md:text-lg">Place a bid</CardTitle>
      <p className="text-muted-foreground text-xs md:text-sm">
        Ends in <Countdown endAt={endAt} />
      </p>
    </CardHeader>
  );
}

export function AuctionBidFields({
  isSellerViewer,
  currentDisplay,
  minNext,
  amount,
  onAmountChange,
  onRequestBid,
  bidMine,
  onCancelClick,
  msg,
}: {
  isSellerViewer: boolean | null;
  currentDisplay: string;
  minNext: number;
  amount: string;
  onAmountChange: (value: string) => void;
  onRequestBid: () => void;
  bidMine: { canCancel: boolean; myLatestBidAmount: string | null } | null;
  onCancelClick: () => void;
  msg: string | null;
}) {
  return (
    <>
      <div>
        <p className="text-muted-foreground text-xs md:text-sm">Current bid</p>
        <p className="text-2xl font-bold text-primary md:text-3xl">₹{currentDisplay}</p>
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
            onChange={(e) => onAmountChange(e.target.value)}
            className="md:text-base"
          />
          <Button className="w-full md:text-base" onClick={() => void onRequestBid()}>
            Bid
          </Button>
          {bidMine?.canCancel && (
            <Button type="button" variant="outline" className="w-full md:text-base" onClick={onCancelClick}>
              Cancel my bid
            </Button>
          )}
          {msg && <p className="text-destructive text-xs md:text-sm">{msg}</p>}
        </>
      )}
    </>
  );
}
