"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Toaster, toast as sonnerToast } from "sonner";

const ToastCtx = createContext<(msg: string, variant?: "default" | "success") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = !mounted ? "light" : resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toaster
      theme={theme}
      position="top-right"
      offset={16}
      mobileOffset={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      richColors={false}
      closeButton={false}
      className="auct-toaster"
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group !items-start !gap-3 !rounded-lg !border !border-border !bg-popover !p-4 !text-popover-foreground !shadow-md !opacity-100",
          title: "!text-sm !font-medium !text-foreground",
          description: "!text-sm !text-muted-foreground",
          success:
            "!border-primary/50 !bg-popover !text-popover-foreground [&_[data-icon]]:!text-primary",
          icon: "!mt-0.5",
          content: "!gap-0.5",
        },
      }}
    />
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const show = useCallback((message: string, variant: "default" | "success" = "success") => {
    if (variant === "success") {
      sonnerToast.success(message);
    } else {
      sonnerToast(message);
    }
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <AppToaster />
    </ToastCtx.Provider>
  );
}
