"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoginSheet } from "@/components/login-sheet-provider";
import { useIsLoggedIn } from "@/lib/use-auth";
import { setStoredToken } from "@/lib/api";
import { Moon, Sun } from "lucide-react";

export function SiteHeader() {
  const { setTheme } = useTheme();
  const loggedIn = useIsLoggedIn();
  const { openLogin } = useLoginSheet();

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
          {loggedIn && (
            <>
              <Link href="/me/selling" className="text-muted-foreground hover:text-foreground">
                Selling
              </Link>
              <Link href="/me/bidding" className="text-muted-foreground hover:text-foreground">
                My bids
              </Link>
            </>
          )}
          {loggedIn ? (
            <Button size="sm" variant="secondary" type="button" onClick={() => setStoredToken(null)}>
              Log out
            </Button>
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
    </header>
  );
}
