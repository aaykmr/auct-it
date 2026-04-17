/** Match `CASHFREE_SANDBOX` on the API: sandbox vs production Cashfree.js. */
export function cashfreeJsMode(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Cashfree checkout requires a browser"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(s);
  });
}

type CashfreeFactory = (opts: { mode: string }) => {
  checkout: (opts: { paymentSessionId: string; redirectTarget: string }) => Promise<unknown> | void;
};

export async function openCashfreeCheckout(paymentSessionId: string): Promise<void> {
  await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
  const Cashfree = (globalThis as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
  if (!Cashfree) throw new Error("Cashfree SDK not available");
  const cashfree = Cashfree({ mode: cashfreeJsMode() });
  await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
}
