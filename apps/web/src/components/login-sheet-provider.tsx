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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>Phone number and one-time code.</DialogDescription>
          </DialogHeader>
          <LoginForm onSuccess={handleSuccess} className="px-6 pb-6" />
        </DialogContent>
      </Dialog>
    </LoginSheetCtx.Provider>
  );
}
