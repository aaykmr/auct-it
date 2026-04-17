"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  api,
  AUTH_CHANGE_EVENT,
  getStoredToken,
  NOTIFICATIONS_REFRESH_EVENT,
} from "@/lib/api";
import { useIsLoggedIn } from "@/lib/use-auth";

type Summary = { unreadCount: number };
type NotifItem = { kind: string; id: string; title: string; href: string; createdAt: string };

export function NotificationBell() {
  const router = useRouter();
  const loggedIn = useIsLoggedIn();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUnread(0);
      setItems([]);
      return;
    }
    try {
      const [s, list] = await Promise.all([
        api<Summary>("/v1/me/notifications/summary", { token }),
        api<{ items: NotifItem[] }>("/v1/me/notifications", { token }),
      ]);
      setUnread(s.unreadCount);
      setItems(list.items);
    } catch {
      setUnread(0);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, loggedIn]);

  useEffect(() => {
    const onAuth = () => void load();
    const onRefresh = () => void load();
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  if (!loggedIn) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
        aria-label="Notifications"
      >
        <BellIcon className="size-5" weight="regular" />
        {unread > 0 ? (
          <span className="bg-destructive absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-card" />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="text-muted-foreground px-2 py-3 text-sm">You&apos;re all caught up.</div>
        ) : (
          items.map((it) => (
            <DropdownMenuItem
              key={it.id}
              onClick={() => {
                setOpen(false);
                router.push(it.href);
              }}
            >
              <span className="line-clamp-2 text-left text-sm">{it.title}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            router.push("/me/notifications");
          }}
        >
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
