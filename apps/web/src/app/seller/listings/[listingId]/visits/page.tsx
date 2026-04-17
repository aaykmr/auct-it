import { redirect } from "next/navigation";

/** @deprecated Use `/seller/visits` for seller-wide visit management. */
export default function LegacyListingVisitsRedirect() {
  redirect("/seller/visits");
}
