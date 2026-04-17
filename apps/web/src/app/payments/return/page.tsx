"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getStoredToken } from "@/lib/api";
import { cn } from "@/lib/utils";

function PaymentReturnInner() {
  const sp = useSearchParams();
  const orderId = sp.get("order_id");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setErr("Missing order reference.");
      return;
    }
    const token = getStoredToken();
    if (!token) {
      setErr("Sign in to see payment status.");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const r = await api<{ order: { status: string } }>(
          `/v1/payments/orders/${orderId}?reconcile=1`,
          { token },
        );
        if (cancelled) return;
        setStatus(r.order.status);
        if (r.order.status === "pending") {
          timer = setTimeout(() => void poll(), 2500);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load order");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Payment status</CardTitle>
          <CardDescription>After Cashfree redirects here, we confirm your payment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && <p className="text-destructive text-sm">{err}</p>}
          {!err && status === "paid" && (
            <p className="text-sm">Payment successful. You can continue browsing.</p>
          )}
          {!err && status === "failed" && <p className="text-sm">Payment did not complete. You can try again from the item page.</p>}
          {!err && status === "pending" && <p className="text-muted-foreground text-sm">Confirming payment with your bank…</p>}
          {!err && status === null && <p className="text-muted-foreground text-sm">Loading…</p>}
          <Link href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
            Home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <PaymentReturnInner />
    </Suspense>
  );
}
