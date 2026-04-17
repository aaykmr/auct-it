"use client";

import { useEffect, useMemo, useState } from "react";
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

type City = { id: string; name: string };
type Category = { id: string; name: string; slug: string };

export function BrowseClient() {
  const sp = useSearchParams();
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [auctions, setAuctions] = useState<
    {
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
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [metaReady, setMetaReady] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

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
    const initialCities = sp.get("cityIds")?.split(",").filter(Boolean) ?? [];
    if (initialCat && categories.some((x) => x.id === initialCat)) setCategoryId(initialCat);
    else setCategoryId(undefined);
    const validCityIds = initialCities.filter((id) => cities.some((x) => x.id === id));
    setCityIds(validCityIds);
  }, [sp, metaReady, categories, cities]);

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
        const data = await api<{ auctions: typeof auctions }>(`/v1/auctions${q}`);
        setAuctions(
          data.auctions.map((a) => ({
            ...a,
            listing: {
              ...a.listing,
              basePrice: String(a.listing.basePrice),
            },
          })),
        );
      } catch {
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  return (
    <div className="space-y-6">
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
                else setCityIds([v]);
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
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading auctions…</p>
      ) : (
        <AuctionGrid auctions={auctions} />
      )}
    </div>
  );
}
