"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useIsLoggedIn } from "@/lib/use-auth";
import { api, getStoredToken, PROFILE_UPDATE_EVENT, setStoredToken } from "@/lib/api";
import { Moon, Sun, UserRound } from "lucide-react";

export function SiteHeader() {
  const { setTheme } = useTheme();
  const router = useRouter();
  const loggedIn = useIsLoggedIn();
  const { openLogin } = useLoginSheet();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) {
      setProfileName(null);
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    const load = () => {
      void api<{ user: { name: string | null } }>("/v1/me", { token })
        .then((r) => setProfileName(r.user.name?.trim() || null))
        .catch(() => setProfileName(null));
    };
    load();
    window.addEventListener(PROFILE_UPDATE_EVENT, load);
    return () => window.removeEventListener(PROFILE_UPDATE_EVENT, load);
  }, [loggedIn]);

  function confirmLogout() {
    setStoredToken(null);
    setLogoutOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-tight text-primary md:text-xl"
        >
          AuctIt
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm md:gap-4 md:text-base">
          <Link href="/browse" className="text-muted-foreground hover:text-foreground">
            Browse
          </Link>
          <Link href="/help" className="text-muted-foreground hover:text-foreground">
            Help
          </Link>
          <Link href="/seller" className="text-muted-foreground hover:text-foreground">
            Sell
          </Link>
          {loggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-2")}
                aria-label="Account menu"
              >
                <UserRound className="size-4 shrink-0" />
                <span className="max-w-[8rem] truncate">{profileName ?? "Account"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                {profileName && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="font-normal">{profileName}</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    router.push("/me/bidding");
                  }}
                >
                  My bids
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    router.push("/me/selling");
                  }}
                >
                  My items
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setLogoutOpen(true)}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" variant="secondary" type="button" onClick={() => openLogin()}>
              Sign in
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>You will need to sign in again to bid or manage listings.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={confirmLogout}>
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
