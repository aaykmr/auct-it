"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Decline",
  variant = "default",
  onConfirm,
  onDecline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onDecline?: () => void;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="gap-0 rounded-t-xl sm:mx-auto sm:max-w-lg" aria-busy={pending}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="text-base">{description}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-6 flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              onDecline?.();
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending}
            onClick={async () => {
              setPending(true);
              try {
                await Promise.resolve(onConfirm());
                onOpenChange(false);
              } catch {
                /* keep sheet open; caller shows error */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <CircleNotch className="size-4 shrink-0 animate-spin" aria-hidden />
                {confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
