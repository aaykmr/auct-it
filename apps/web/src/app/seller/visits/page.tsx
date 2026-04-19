"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { api, dispatchNotificationsRefresh, getStoredToken } from "@/lib/api";
import { pickDefaultCityWithList } from "@/lib/geo-default-city";
import { cn } from "@/lib/utils";

type City = { id: string; name: string };
type Slot = {
  id: string;
  listingId: string | null;
  startAt: string;
  endAt: string;
  addressSummary: string;
  addressFull?: string | null;
  mapsUrl?: string | null;
  status: string;
  city: { name: string };
};

function SlotMapsRow({
  slot,
  onSave,
  onCancel,
}: {
  slot: Slot;
  onSave: (url: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(slot.mapsUrl ?? "");
  useEffect(() => {
    setDraft(slot.mapsUrl ?? "");
  }, [slot.id, slot.mapsUrl]);

  return (
    <li className="bg-muted/40 space-y-2 rounded-md border p-3 text-sm">
      <p className="font-medium">
        {slot.city.name} · {new Date(slot.startAt).toLocaleString()}
      </p>
      {slot.listingId ? (
        <p className="text-muted-foreground text-xs">Listing-specific slot (legacy)</p>
      ) : (
        <p className="text-muted-foreground text-xs">Seller-wide slot</p>
      )}
      <p className="text-muted-foreground">{slot.addressSummary}</p>
      {slot.addressFull ? <p className="mt-1">{slot.addressFull}</p> : null}
      <p className="text-muted-foreground text-xs capitalize">{slot.status}</p>
      {slot.status === "open" ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void onCancel()}>
          Cancel slot
        </Button>
      ) : null}
      <div className="space-y-1 pt-1">
        <Label htmlFor={`maps-${slot.id}`}>Google Maps link (buyers see this after visit fee)</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={`maps-${slot.id}`}
            type="url"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => onSave(draft)}>
            Save link
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function SellerVisitsPage() {
  const showToast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityId, setCityId] = useState("");
  const [addressSummary, setAddressSummary] = useState("");
  const [addressFull, setAddressFull] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [mapsUrl, setMapsUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{
    needsNewSlot: boolean;
    triggerSlotId: string | null;
    dismissed: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api<{ cities: City[] }>("/v1/cities"),
        api<{ slots: Slot[] }>("/v1/me/seller/inspection-slots", { token }),
      ]);
      const r = await api<{ needsNewSlot: boolean; triggerSlotId: string | null; dismissed: boolean }>(
        "/v1/me/seller/visit-reminder",
        { token },
      ).catch(() => null);
      const { defaultId, cities: cityList } = await pickDefaultCityWithList(c.cities);
      setCities(cityList);
      setCityId((prev) => (prev.trim() ? prev : defaultId));
      setSlots(s.slots);
      setReminder(r);
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSlot() {
    const token = getStoredToken();
    if (!token) {
      setMsg("Sign in as the seller.");
      return;
    }
    if (!cityId || !addressSummary.trim() || !addressFull.trim() || !startAt || !endAt) {
      setMsg("Fill city, address, and start/end times.");
      return;
    }
    setMsg(null);
    try {
      await api(`/v1/me/seller/inspection-slots`, {
        method: "POST",
        token,
        json: {
          cityId,
          addressSummary: addressSummary.trim(),
          addressFull: addressFull.trim(),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          maxBuyerCapacity: Number(capacity) || 20,
          ...(mapsUrl.trim() ? { mapsUrl: mapsUrl.trim() } : {}),
        },
      });
      showToast("Slot created");
      setAddressSummary("");
      setAddressFull("");
      setMapsUrl("");
      dispatchNotificationsRefresh();
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create slot");
    }
  }

  async function saveMapsUrl(slotId: string, url: string) {
    const token = getStoredToken();
    if (!token) return;
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setMsg("Maps link must start with http:// or https://");
      return;
    }
    setMsg(null);
    try {
      await api(`/v1/inspection-slots/${slotId}`, {
        method: "PATCH",
        token,
        json: { mapsUrl: trimmed === "" ? "" : trimmed },
      });
      showToast("Maps link saved");
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save link");
    }
  }

  async function cancelSlot(slotId: string) {
    if (!window.confirm("Cancel this visit slot? Buyers will be asked to refund or pick another time.")) return;
    const token = getStoredToken();
    if (!token) return;
    try {
      await api(`/v1/inspection-slots/${slotId}/cancel`, { method: "POST", token, json: {} });
      showToast("Slot cancelled");
      dispatchNotificationsRefresh();
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not cancel");
    }
  }

  async function dismissReminder() {
    const token = getStoredToken();
    if (!token || !reminder?.triggerSlotId) return;
    try {
      await api(`/v1/me/seller/visit-reminder/dismiss`, {
        method: "POST",
        token,
        json: { sourceSlotId: reminder.triggerSlotId },
      });
      dispatchNotificationsRefresh();
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not dismiss");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <Link href="/seller" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4")}>
        ← Seller hub
      </Link>
      {reminder?.needsNewSlot && !reminder.dismissed && reminder.triggerSlotId ? (
        <Card className="mb-6 border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Visit window ended</CardTitle>
            <CardDescription>Add a new slot so buyers can schedule pickups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" size="sm" variant="secondary" onClick={() => void dismissReminder()}>
              Dismiss reminder
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Visit slots</CardTitle>
          <CardDescription>
            Create seller-wide pickup windows for any of your winning buyers. Add a Google Maps link (optional on create;
            you can edit per slot below). Buyers only see the link after they pay the visit fee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {msg && <p className="text-destructive text-sm">{msg}</p>}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <select
                id="city"
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
            <div className="space-y-2">
              <Label htmlFor="sum">Address summary (public)</Label>
              <Input
                id="sum"
                value={addressSummary}
                onChange={(e) => setAddressSummary(e.target.value)}
                placeholder="e.g. Near MG Road"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full">Full address (buyers after fee)</Label>
              <Input id="full" value={addressFull} onChange={(e) => setAddressFull(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cap">Max buyers</Label>
              <Input id="cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maps">Google Maps link (optional)</Label>
              <Input
                id="maps"
                type="url"
                inputMode="url"
                placeholder="https://www.google.com/maps/embed?pb=..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full" onClick={() => void createSlot()}>
              Add slot
            </Button>
          </div>

          <div>
            <h3 className="mb-2 font-medium">Your slots</h3>
            {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {!loading && slots.length === 0 && <p className="text-muted-foreground text-sm">No slots yet.</p>}
            <ul className="space-y-4">
              {slots.map((s) => (
                <SlotMapsRow
                  key={s.id}
                  slot={s}
                  onSave={(url) => void saveMapsUrl(s.id, url)}
                  onCancel={() => void cancelSlot(s.id)}
                />
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
