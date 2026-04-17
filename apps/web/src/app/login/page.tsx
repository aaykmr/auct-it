"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginSheet } from "@/components/login-sheet-provider";

export default function LoginPage() {
  const router = useRouter();
  const { openLogin } = useLoginSheet();

  useEffect(() => {
    openLogin({
      onSuccess: () => {
        router.refresh();
      },
    });
    router.replace("/");
  }, [openLogin, router]);

  return null;
}
