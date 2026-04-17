"use client";

import { useMemo } from "react";

type VisitMapEmbedProps = {
  visitFeePaid: boolean;
  mapsUrl?: string | null;
  fullAddress?: string | null;
  addressSummary?: string;
  cityName: string;
};

/**
 * Google Maps iframe for buyers after visit fee. Prefers an official embed URL from the seller when safe;
 * otherwise uses address search (`output=embed`) — no Maps JavaScript API key required.
 */
export function VisitMapEmbed({
  visitFeePaid,
  mapsUrl,
  fullAddress,
  addressSummary,
  cityName,
}: VisitMapEmbedProps) {
  const src = useMemo(() => {
    if (!visitFeePaid) return null;

    const trimmed = mapsUrl?.trim();
    if (trimmed) {
      try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.replace(/^www\./, "");
        if (
          parsed.protocol === "https:" &&
          host === "google.com" &&
          parsed.pathname.startsWith("/maps/embed")
        ) {
          return trimmed;
        }
      } catch {
        /* ignore */
      }
    }

    const sum = addressSummary?.trim() ?? "";
    const q =
      fullAddress?.trim() ||
      [cityName, sum].filter((x) => x && String(x).trim()).join(", ").trim();
    if (!q) return null;

    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }, [visitFeePaid, mapsUrl, fullAddress, addressSummary, cityName]);

  if (!src) return null;

  return (
    <div className="mt-3 w-full overflow-hidden rounded-lg border bg-muted/30">
      <div className="aspect-[16/10] w-full min-h-[200px] sm:aspect-video">
        <iframe
          title="Pickup location map"
          src={src}
          className="size-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
