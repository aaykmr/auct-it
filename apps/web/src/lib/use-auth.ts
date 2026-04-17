"use client";

import { useEffect, useState } from "react";
import { AUTH_CHANGE_EVENT, getStoredToken } from "@/lib/api";

export function useIsLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    const sync = () => setLoggedIn(!!getStoredToken());
    sync();
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, sync);
  }, []);
  return loggedIn;
}
