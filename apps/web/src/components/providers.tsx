"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { LoginSheetProvider } from "@/components/login-sheet-provider";
import { ToastProvider } from "@/components/toast-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider>
        <LoginSheetProvider>{children}</LoginSheetProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
