"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BidConfirmPanel({
  title,
  description,
  confirmLabel,
  cancelLabel = "Decline",
  variant = "default",
  onConfirm,
  onDismiss,
  className,
  titleId: titleIdProp,
  onPendingChange,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
  className?: string;
  titleId?: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const autoTitleId = useId();
  const titleId = titleIdProp ?? autoTitleId;
  const [pending, setPending] = useState(false);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    return () => {
      setPending(false);
      onPendingChange?.(false);
    };
  }, [onPendingChange]);

  return (
    <section role="region" aria-labelledby={titleId} aria-busy={pending} className={cn(className)}>
      <h3 id={titleId} className="font-heading text-lg font-semibold md:text-xl">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed md:text-base">{description}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto md:text-base"
          disabled={pending}
          onClick={onDismiss}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "destructive" ? "destructive" : "default"}
          className="w-full sm:w-auto md:text-base"
          disabled={pending}
          aria-busy={pending}
          onClick={async () => {
            setPending(true);
            try {
              await Promise.resolve(onConfirm());
              onDismiss();
            } catch {
              /* caller surfaces error */
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
      </div>
    </section>
  );
}
