"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, apiUrl, getStoredToken } from "@/lib/api";

type City = { id: string; name: string };
type Category = { id: string; name: string };

export default function NewListingPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [duration, setDuration] = useState("60");
  const [msg, setMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  useEffect(() => {
    void (async () => {
      setMetaLoading(true);
      setMsg(null);
      try {
        const [c, cat] = await Promise.all([
          api<{ cities: City[] }>("/v1/cities"),
          api<{ categories: Category[] }>("/v1/categories"),
        ]);
        setCities(c.cities);
        setCategories(cat.categories);
        if (cat.categories[0]) setCategoryId(cat.categories[0].id);
        if (c.cities[0]) setCityId(c.cities[0].id);
        if (!cat.categories.length || !c.cities.length) {
          setMsg(
            "No categories or cities in the database. From the repo root run: pnpm --filter api exec prisma db seed",
          );
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to load categories/cities");
      } finally {
        setMetaLoading(false);
      }
    })();
  }, []);

  async function create() {
    setMsg(null);
    const token = getStoredToken();
    if (!token) {
      setMsg("Sign in to create listings");
      return;
    }
    if (!categoryId || !cityId) {
      setMsg("Select a category and city (wait for the lists to load, or run the DB seed).");
      return;
    }
    try {
      const { listing } = await api<{ listing: { id: string } }>("/v1/listings", {
        method: "POST",
        token,
        json: {
          title,
          description,
          basePrice: Number(basePrice),
          categoryId,
          cityIds: [cityId],
        },
      });
      await api(`/v1/listings/${listing.id}`, {
        method: "PATCH",
        token,
        json: { status: "active" },
      });
      if (photos.length > 0) {
        const fd = new FormData();
        for (const f of photos) fd.append("files", f);
        const up = await fetch(`${apiUrl}/v1/listings/${listing.id}/images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!up.ok) {
          const err = (await up.json().catch(() => ({}))) as { error?: string; hint?: string };
          throw new Error([err.error, err.hint].filter(Boolean).join(". ") || "Image upload failed");
        }
      }
      const { auction } = await api<{ auction: { id: string } }>(`/v1/listings/${listing.id}/auction`, {
        method: "POST",
        token,
        json: { durationMinutes: Number(duration) },
      });
      router.push(`/auctions/${auction.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>New listing + auction</CardTitle>
          <CardDescription>Sign in. Seller KYC is enforced only when the API has it enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1">
            <Label>Starting price (₹)</Label>
            <Input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <select
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>City</Label>
            <select
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Auction duration (minutes)</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Photos (optional, up to 10)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              className="cursor-pointer text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1"
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files).slice(0, 10) : [];
                setPhotos(list);
              }}
            />
            {photos.length > 0 && (
              <p className="text-muted-foreground text-xs">{photos.length} file(s) selected</p>
            )}
            {photoUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photoUrls.map((src) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                    <Image src={src} alt="" fill className="object-cover" sizes="120px" unoptimized />
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => void create()}
            disabled={metaLoading || !categories.length || !cities.length || !categoryId || !cityId}
          >
            {metaLoading ? "Loading…" : "Publish auction"}
          </Button>
          {msg && (
            <p className={`text-sm ${msg.includes("seed") ? "text-muted-foreground" : "text-destructive"}`}>
              {msg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
