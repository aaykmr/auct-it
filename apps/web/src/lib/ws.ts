import { apiUrl } from "./api";

export function auctionWebSocketUrl(auctionId: string): string {
  const base = apiUrl.trim();
  if (base) {
    const http = base.replace("http://", "ws://").replace("https://", "wss://");
    return `${http}/v1/ws/auctions/${auctionId}`;
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:4000/v1/ws/auctions/${auctionId}`;
  }
  return `ws://127.0.0.1:4000/v1/ws/auctions/${auctionId}`;
}
