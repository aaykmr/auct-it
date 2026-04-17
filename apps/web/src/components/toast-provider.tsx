"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastState = { message: string; variant?: "default" | "success" } | null;

const ToastCtx = createContext<(msg: string, variant?: "default" | "success") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, variant: "default" | "success" = "success") => {
    setToast({ message, variant });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-[100] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-lg md:text-base",
            toast.variant === "success"
              ? "border-primary/30 bg-primary/15 text-foreground"
              : "bg-card text-card-foreground",
          )}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
