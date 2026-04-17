"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, setStoredToken } from "@/lib/api";

export function LoginForm({
  onSuccess,
  className,
}: {
  onSuccess: () => void;
  className?: string;
}) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    try {
      const r = await api<{ devOtp?: string }>("/v1/auth/otp/request", {
        method: "POST",
        json: { mobileNumber: mobile },
      });
      if (r.devOtp) setDevOtp(r.devOtp);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function verify() {
    setError(null);
    try {
      const r = await api<{ token: string }>("/v1/auth/otp/verify", {
        method: "POST",
        json: { mobileNumber: mobile, otp },
      });
      setStoredToken(r.token);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
    }
  }

  return (
    <div className={className}>
      {step === "mobile" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="login-mobile">Mobile number</Label>
            <Input
              id="login-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+9198..."
            />
          </div>
          <Button className="mt-4 w-full" onClick={() => void requestOtp()}>
            Send OTP
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="login-otp">OTP</Label>
            <Input
              id="login-otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6 digits"
            />
          </div>
          {devOtp && <p className="text-muted-foreground mt-2 text-xs">Dev hint: use {devOtp}</p>}
          <Button className="mt-4 w-full" onClick={() => void verify()}>
            Verify & continue
          </Button>
        </>
      )}
      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
    </div>
  );
}
