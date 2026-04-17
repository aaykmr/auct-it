/** Public label for a bidder — never use phone numbers in API responses. */
export function publicBidderLabel(name: string | null | undefined): string {
  const t = name?.trim();
  if (t) return t;
  return "Anonymous bidder";
}
