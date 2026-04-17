"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DURATION_MS = 320;

export function BidConfirmOverlay({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Decline",
  variant = "default",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimIn(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setAnimIn(false);
    const t = window.setTimeout(() => setMounted(false), DURATION_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mounted, onOpenChange]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden bg-transparent",
        !animIn && "pointer-events-none",
      )}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-background/75 backdrop-blur-[3px] transition-[opacity] duration-300 ease-out",
          animIn ? "opacity-100" : "opacity-0",
        )}
        aria-label="Dismiss"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative border-t border-border bg-card/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-card/95 dark:shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.55)]",
          animIn ? "translate-y-0" : "translate-y-full",
        )}
      >
        <h3 id={titleId} className="font-heading text-lg font-semibold md:text-xl">
          {title}
        </h3>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed md:text-base">{description}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto md:text-base"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            className="w-full sm:w-auto md:text-base"
            onClick={async () => {
              try {
                await Promise.resolve(onConfirm());
                onOpenChange(false);
              } catch {
                /* caller surfaces error */
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
