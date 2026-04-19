"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuctionGrid } from "@/components/auction-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { GEO_STORAGE_KEY } from "@/lib/geo-default-city";

type City = { id: string; name: string };
type Category = { id: string; name: string; slug: string };

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

export function BrowseClient() {
  const sp = useSearchParams();
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [recentAuctions, setRecentAuctions] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaReady, setMetaReady] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const geoAppliedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      setMetaError(null);
      try {
        const [c, cat] = await Promise.all([
          api<{ cities: City[] }>("/v1/cities"),
          api<{ categories: Category[] }>("/v1/categories"),
        ]);
        setCities(c.cities);
        setCategories(cat.categories);
      } catch (e) {
        setMetaError(
          e instanceof Error
            ? e.message
            : "Could not load cities or categories. Is the API running (pnpm dev from repo root)?",
        );
      } finally {
        setMetaReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!metaReady) return;
    const initialCat = sp.get("categoryId");
    if (initialCat && categories.some((x) => x.id === initialCat)) setCategoryId(initialCat);
    else setCategoryId(undefined);
  }, [sp, metaReady, categories]);

  useEffect(() => {
    if (!metaReady) return;
    const urlCityIds = sp.get("cityIds")?.split(",").filter(Boolean) ?? [];
    if (urlCityIds.length > 0) {
      const valid = urlCityIds.filter((id) => cities.some((x) => x.id === id));
      setCityIds(valid);
      geoAppliedRef.current = true;
    }
  }, [sp, metaReady, cities]);

  useEffect(() => {
    if (!metaReady || cities.length === 0 || geoAppliedRef.current) return;
    const urlCityIds = sp.get("cityIds")?.split(",").filter(Boolean) ?? [];
    if (urlCityIds.length > 0) return;

    const stored = typeof window !== "undefined" ? localStorage.getItem(GEO_STORAGE_KEY) : null;
    if (stored && cities.some((c) => c.id === stored)) {
      setCityIds([stored]);
      geoAppliedRef.current = true;
      return;
    }

    let cancelled = false;
    void api<{ cityId: string | null }>("/v1/geo/city-hint")
      .then((r) => {
        if (cancelled || !r.cityId || !cities.some((c) => c.id === r.cityId)) {
          geoAppliedRef.current = true;
          return;
        }
        localStorage.setItem(GEO_STORAGE_KEY, r.cityId);
        setCityIds([r.cityId]);
        geoAppliedRef.current = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [metaReady, cities, sp]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (categoryId) p.set("categoryId", categoryId);
    if (cityIds.length) p.set("cityIds", cityIds.join(","));
    return p.toString();
  }, [categoryId, cityIds]);

  const ALL = "all" as const;
  const safeCategoryValue =
    metaReady && categoryId && categories.some((c) => c.id === categoryId) ? categoryId : ALL;
  const safeCityValue =
    metaReady && cityIds[0] && cities.some((c) => c.id === cityIds[0]) ? cityIds[0] : ALL;
  const categoryLabel = !metaReady
    ? "Loading…"
    : safeCategoryValue !== ALL
      ? (categories.find((c) => c.id === safeCategoryValue)?.name ?? "All categories")
      : "All categories";
  const cityLabel = !metaReady
    ? "Loading…"
    : safeCityValue !== ALL
      ? (cities.find((c) => c.id === safeCityValue)?.name ?? "All cities")
      : "All cities";

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const q = query ? `?${query}` : "";
        const [live, recent] = await Promise.all([
          api<{ auctions: AuctionRow[] }>(`/v1/auctions${q}`),
          api<{ auctions: AuctionRow[] }>(`/v1/auctions/recently-ended${q}`),
        ]);
        const norm = (rows: AuctionRow[]) =>
          rows.map((a) => ({
            ...a,
            listing: {
              ...a.listing,
              basePrice: String(a.listing.basePrice),
            },
          }));
        setAuctions(norm(live.auctions));
        setRecentAuctions(norm(recent.auctions));
      } catch {
        setAuctions([]);
        setRecentAuctions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  return (
    <div className="space-y-10">
      {metaError ? (
        <p className="text-destructive text-sm" role="alert">
          {metaError}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-end">
        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cities (multi)</Label>
            <Select
              key={`city-${cities.length}`}
              value={safeCityValue}
              onValueChange={(v) => {
                if (v === ALL || v == null) setCityIds([]);
                else {
                  setCityIds([v]);
                  if (typeof window !== "undefined") localStorage.setItem(GEO_STORAGE_KEY, v);
                }
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="All cities">{cityLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All cities</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              key={`cat-${categories.length}`}
              value={safeCategoryValue}
              onValueChange={(v) => setCategoryId(v == null || v === ALL ? undefined : v)}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="All categories">{categoryLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCityIds([]);
            setCategoryId(undefined);
          }}
        >
          Clear
        </Button>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight md:text-2xl">Live auctions</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading auctions…</p>
        ) : (
          <AuctionGrid auctions={auctions} variant="live" />
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Recently ended</h2>
          <p className="text-muted-foreground mt-1 text-sm">Last 2 days, with the same filters.</p>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <AuctionGrid auctions={recentAuctions} variant="recent" />
        )}
      </section>
    </div>
  );
}
