"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoginForm } from "@/components/login-form";

type OpenOpts = { onSuccess?: () => void };

type Ctx = { openLogin: (opts?: OpenOpts) => void };

const LoginSheetCtx = createContext<Ctx | null>(null);

export function useLoginSheet() {
  const v = useContext(LoginSheetCtx);
  if (!v) throw new Error("useLoginSheet must be used within LoginSheetProvider");
  return v;
}

export function LoginSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const successCallbackRef = useRef<(() => void) | undefined>(undefined);

  const openLogin = useCallback((opts?: OpenOpts) => {
    successCallbackRef.current = opts?.onSuccess;
    setOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    const fn = successCallbackRef.current;
    successCallbackRef.current = undefined;
    fn?.();
  }, []);

  const value = useMemo(() => ({ openLogin }), [openLogin]);

  return (
    <LoginSheetCtx.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Sign in</SheetTitle>
            <SheetDescription>Phone number + OTP (dummy code in development).</SheetDescription>
          </SheetHeader>
          <LoginForm onSuccess={handleSuccess} className="mt-4 px-1" />
        </SheetContent>
      </Sheet>
    </LoginSheetCtx.Provider>
  );
}
