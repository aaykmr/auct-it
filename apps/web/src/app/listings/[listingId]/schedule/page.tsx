"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast-provider";
import { api, getStoredToken } from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { VisitMapEmbed } from "@/components/visit-map-embed";
import { cn } from "@/lib/utils";

type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  addressSummary?: string;
  status: string;
  city: { name: string };
  visitFeePaid?: boolean;
  joined?: boolean;
  fullAddress?: string | null;
  mapsUrl?: string | null;
};

export default function ScheduleVisitPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;
  const showToast = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setMsg(null);
    }
    try {
      const token = getStoredToken();
      const r = await api<{ slots: Slot[] }>(`/v1/listings/${listingId}/inspection-slots`, {
        ...(token ? { token } : {}),
      });
      setSlots(r.slots);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load slots");
      setSlots([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(slotId: string) {
    const token = getStoredToken();
    if (!token) {
      setMsg("Sign in to schedule a visit.");
      return;
    }
    setMsg(null);
    try {
      await api(`/v1/inspection-slots/${slotId}/join`, { method: "POST", token });
      await load({ silent: true });
      showToast("You’re on the list for this slot.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join");
    }
  }

  async function payFee(slotId: string) {
    const token = getStoredToken();
    if (!token) {
      setMsg("Sign in to pay.");
      return;
    }
    setMsg(null);
    try {
      const r = await api<{
        alreadyPaid?: boolean;
        cashfree?: { paymentSessionId: string } | null;
        error?: string;
      }>(`/v1/inspection-slots/${slotId}/visit-fee`, { method: "POST", token });
      if (r.alreadyPaid) {
        await load({ silent: true });
        showToast("Visit fee already paid for this slot.");
        return;
      }
      if (r.error || !r.cashfree?.paymentSessionId) {
        setMsg(r.error ?? "Cashfree is not configured or payment could not start.");
        return;
      }
      await openCashfreeCheckout(r.cashfree.paymentSessionId);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment start failed");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <Link href="/me/won" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4")}>
        ← Won bids
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Schedule a visit</CardTitle>
          <CardDescription>
            Before paying, you only see the city and time window. Pay the visit fee once per slot to unlock the exact
            address, map, and any Google Maps link the seller added. You must have won the auction for this listing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-muted-foreground text-sm">Loading slots…</p>}
          {msg && <p className="text-destructive text-sm">{msg}</p>}
          {!loading && slots.length === 0 && (
            <p className="text-muted-foreground text-sm">No open visit slots yet. Ask the seller to add availability.</p>
          )}
          <ul className="space-y-3">
            {slots.map((s) => (
              <li key={s.id} className="bg-muted/40 rounded-lg border p-4">
                <p className="font-medium">
                  {s.city.name} · {new Date(s.startAt).toLocaleString()} – {new Date(s.endAt).toLocaleTimeString()}
                </p>
                {!s.visitFeePaid ? (
                  <p className="text-muted-foreground mt-1 text-sm">Exact address shown after visit fee is paid.</p>
                ) : null}
                {s.visitFeePaid && s.addressSummary ? (
                  <p className="text-muted-foreground mt-1 text-sm">{s.addressSummary}</p>
                ) : null}
                {s.visitFeePaid && s.fullAddress ? (
                  <p className="mt-2 text-sm font-medium">{s.fullAddress}</p>
                ) : null}
                {s.visitFeePaid ? (
                  <VisitMapEmbed
                    visitFeePaid
                    mapsUrl={s.mapsUrl}
                    fullAddress={s.fullAddress}
                    addressSummary={s.addressSummary}
                    cityName={s.city.name}
                  />
                ) : null}
                {s.visitFeePaid && s.mapsUrl ? (
                  <p className="mt-2">
                    <a
                      href={s.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm font-medium underline underline-offset-4"
                    >
                      Open in Google Maps
                    </a>
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.joined ? (
                    <span className="text-muted-foreground text-sm">Joined</span>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" onClick={() => void join(s.id)}>
                      Join slot
                    </Button>
                  )}
                  {s.visitFeePaid ? (
                    <span className="text-muted-foreground text-sm">Visit fee paid — full address unlocked</span>
                  ) : (
                    <Button type="button" size="sm" onClick={() => void payFee(s.id)}>
                      Pay visit fee
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
