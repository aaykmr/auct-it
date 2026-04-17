"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { api, getStoredToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type NotifItem = { kind: string; id: string; title: string; href: string; createdAt: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api<{ items: NotifItem[] }>("/v1/me/notifications", { token });
      setItems(list.items);
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4")}>
        ← Home
      </Link>
      <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
      <p className="text-muted-foreground mt-1 text-sm">Open an item to take action.</p>
      {msg && <p className="text-destructive mt-4 text-sm">{msg}</p>}
      {loading && <p className="text-muted-foreground mt-6 text-sm">Loading…</p>}
      {!loading && items.length === 0 && !msg && (
        <p className="text-muted-foreground mt-6 text-sm">Nothing here right now.</p>
      )}
      <ul className="mt-6 space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className={cn(buttonVariants({ variant: "secondary" }), "h-auto w-full justify-start py-3 text-left")}
            >
              {it.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
