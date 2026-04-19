"use client";

import { useEffect, useState } from "react";

/** Tailwind `lg` (1024px); false until mounted to avoid SSR/hydration mismatch. */
export function useIsLg(): boolean {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLg;
}
