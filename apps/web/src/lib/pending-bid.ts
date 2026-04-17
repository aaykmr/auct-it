const KEY = "auctit_pending_bid";

export type PendingBid = { auctionId: string; amount: string };

export function getPendingBid(): PendingBid | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingBid;
    if (typeof p.auctionId === "string" && typeof p.amount === "string") return p;
    return null;
  } catch {
    return null;
  }
}

export function setPendingBid(p: PendingBid) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearPendingBid() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
