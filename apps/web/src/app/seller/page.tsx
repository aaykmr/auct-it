import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SellerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-bold">Seller hub</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Create listings and start auctions. Seller KYC is disabled for local development by default; see
        README → Seller KYC.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/seller/kyc" className={cn(buttonVariants())}>
          KYC (optional)
        </Link>
        <Link href="/seller/listings/new" className={cn(buttonVariants({ variant: "secondary" }))}>
          New listing
        </Link>
        <Link href="/seller/visits" className={cn(buttonVariants({ variant: "outline" }))}>
          Visit slots
        </Link>
      </div>
    </div>
  );
}
