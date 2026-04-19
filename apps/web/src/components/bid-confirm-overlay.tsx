"use client";

import { useEffect, useId, useState } from "react";
import { BidConfirmPanel } from "@/components/bid-confirm-panel";
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
  const [pendingBlockEscape, setPendingBlockEscape] = useState(false);

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
      if (e.key === "Escape" && !pendingBlockEscape) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mounted, pendingBlockEscape, onOpenChange]);

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
          pendingBlockEscape && "cursor-wait",
        )}
        aria-label="Dismiss"
        disabled={pendingBlockEscape}
        onClick={() => {
          if (pendingBlockEscape) return;
          onOpenChange(false);
        }}
      />
      <div
        className={cn(
          "relative border-t border-border bg-card/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-card/95 dark:shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.55)]",
          animIn ? "translate-y-0" : "translate-y-full",
        )}
      >
        <BidConfirmPanel
          titleId={titleId}
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          variant={variant}
          onConfirm={onConfirm}
          onDismiss={() => onOpenChange(false)}
          onPendingChange={setPendingBlockEscape}
        />
      </div>
    </div>
  );
}
