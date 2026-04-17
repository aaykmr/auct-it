"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getStoredToken } from "@/lib/api";

export default function KycPage() {
  const [legalName, setLegalName] = useState("");
  const [idType, setIdType] = useState("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holderName, setHolderName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const token = getStoredToken();
    if (!token) {
      setMsg("Sign in first");
      return;
    }
    try {
      await api("/v1/kyc", {
        method: "POST",
        token,
        json: {
          legalName,
          idType,
          idNumber,
          bankAccount: { accountNumber, ifsc, holderName },
        },
      });
      setMsg("Submitted. Wait for admin verification.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Seller KYC (MVP)</CardTitle>
          <CardDescription>Manual verification by admin using x-admin-secret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Legal name</Label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>ID type</Label>
            <Input value={idType} onChange={(e) => setIdType(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>ID number</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Bank account number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>IFSC</Label>
            <Input value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Account holder</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <Button onClick={() => void submit()}>Submit</Button>
          {msg && <p className="text-muted-foreground text-sm">{msg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
