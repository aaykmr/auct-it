"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">Sign in</CardTitle>
          <CardDescription className="text-base">
            Phone number + OTP (dummy code in development).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm
            onSuccess={() => {
              router.push("/");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
