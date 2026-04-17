"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { api, dispatchNotificationsRefresh, getStoredToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type CancellationDetail = {
  cancellation: {
    id: string;
    resolution: string;
    slot: {
      id: string;
      startAt: string;
      endAt: string;
      addressSummary: string;
      city: { name: string };
    };
    targetSlotId: string | null;
  };
  alternativeSlots: Array<{
    id: string;
    city: { name: string };
    startAt: string;
    endAt: string;
    addressSummary: string;
  }>;
};

export default function ResolveVisitCancellationPage() {
  const params = useParams<{ cancellationId: string }>();
  const router = useRouter();
  const showToast = useToast();
  const [data, setData] = useState<CancellationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickSlotId, setPickSlotId] = useState("");

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api<CancellationDetail>(`/v1/me/visit-cancellations/${params.cancellationId}`, { token });
      setData(r);
      setPickSlotId(r.alternativeSlots[0]?.id ?? "");
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params.cancellationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function chooseRefund() {
    const token = getStoredToken();
    if (!token) return;
    setMsg(null);
    try {
      await api(`/v1/me/visit-cancellations/${params.cancellationId}/choose-refund`, {
        method: "POST",
        token,
        json: {},
      });
      showToast("Refund requested");
      dispatchNotificationsRefresh();
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not process refund");
    }
  }

  async function chooseSlot() {
    const token = getStoredToken();
    if (!token || !pickSlotId) return;
    setMsg(null);
    try {
      await api(`/v1/me/visit-cancellations/${params.cancellationId}/choose-slot`, {
        method: "POST",
        token,
        json: { newSlotId: pickSlotId },
      });
      showToast("You’re booked on the new slot");
      dispatchNotificationsRefresh();
      router.push("/me/won");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not move to slot");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-destructive text-sm">{msg ?? "Not found"}</p>
        <Link href="/me/won" className={cn(buttonVariants({ variant: "link" }), "mt-4 px-0")}>
          Back to won bids
        </Link>
      </div>
    );
  }

  const pending = data.cancellation.resolution === "pending";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <Link href="/me/won" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4")}>
        ← Won bids
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Visit cancelled</CardTitle>
          <CardDescription>
            {data.cancellation.slot.city.name} · {new Date(data.cancellation.slot.startAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{data.cancellation.slot.addressSummary}</p>
          {msg && <p className="text-destructive text-sm">{msg}</p>}
          {!pending ? (
            <p className="text-muted-foreground text-sm">
              Status: <span className="capitalize">{data.cancellation.resolution.replace(/_/g, " ")}</span>
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => void chooseRefund()}>
                  Refund visit fee
                </Button>
              </div>
              {data.alternativeSlots.length > 0 ? (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="slot">Pick another open slot</Label>
                  <select
                    id="slot"
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    value={pickSlotId}
                    onChange={(e) => setPickSlotId(e.target.value)}
                  >
                    {data.alternativeSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.city.name} · {new Date(s.startAt).toLocaleString()} — {s.addressSummary}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={() => void chooseSlot()} disabled={!pickSlotId}>
                    Join this slot instead
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No other open slots from this seller yet.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
