"use client";

import { useEffect, useState } from "react";

export function Countdown({ endAt }: { endAt: string }) {
  const [left, setLeft] = useState("");

  useEffect(() => {
    const end = new Date(endAt).getTime();
    const tick = () => {
      const now = Date.now();
      const s = Math.max(0, Math.floor((end - now) / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setLeft(`${h}h ${m}m ${sec}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return <span className="font-mono text-sm tabular-nums text-secondary">{left}</span>;
}
