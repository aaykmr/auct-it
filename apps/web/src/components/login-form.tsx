"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, dispatchProfileUpdate, getStoredToken, setStoredToken } from "@/lib/api";

export function LoginForm({
  onSuccess,
  className,
}: {
  onSuccess: () => void;
  className?: string;
}) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<"mobile" | "otp" | "name">("mobile");
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ devOtp?: string }>("/v1/auth/otp/request", {
        method: "POST",
        json: { mobileNumber: mobile },
      });
      if (r.devOtp) setDevOtp(r.devOtp);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api<{
        token: string;
        needsProfile?: boolean;
        user: { id: string; name: string | null };
      }>("/v1/auth/otp/verify", {
        method: "POST",
        json: { mobileNumber: mobile, otp },
      });
      setStoredToken(r.token);
      if (r.needsProfile ?? !r.user.name?.trim()) {
        setStep("name");
      } else {
        onSuccess();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (busy) return;
    setError(null);
    const t = displayName.trim();
    if (t.length < 1) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    try {
      const token = getStoredToken();
      if (!token) throw new Error("Not signed in");
      await api("/v1/me", { method: "PATCH", json: { name: t }, token });
      dispatchProfileUpdate();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {step === "mobile" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void requestOtp();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="login-mobile">Mobile number</Label>
            <Input
              id="login-mobile"
              name="mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter mobile  number"
              autoComplete="tel"
              disabled={busy}
            />
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send OTP"}
          </Button>
        </form>
      ) : step === "otp" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="login-otp">OTP</Label>
            <Input
              id="login-otp"
              name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6 digits"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={busy}
            />
          </div>
          {devOtp && <p className="text-muted-foreground text-xs">Dev hint: use {devOtp}</p>}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="login-name">What should we call you?</Label>
            <Input
              id="login-name"
              name="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">This is how you appear on bids and listings.</p>
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
