"use client";

import { MapPinIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ListingCityRef = { city: { name: string } };

type ListingLocationLineProps = {
  cities: ListingCityRef[];
  /** Join multiple cities; default middle dot. */
  separator?: string;
  className?: string;
  /** Icon size / color classes */
  iconClassName?: string;
  /** `inline` keeps icon + text on one line (e.g. inside a description). `block` uses a row layout for its own line. */
  variant?: "inline" | "block";
};

export function ListingLocationLine({
  cities,
  separator = " · ",
  className,
  iconClassName = "size-5 shrink-0 text-muted-foreground",
  variant = "block",
}: ListingLocationLineProps) {
  const text = cities.map((c) => c.city.name).join(separator).trim();
  if (!text) return null;

  const inner = (
    <>
      <MapPinIcon className={iconClassName} weight="regular" aria-hidden />
      <span className="min-w-0 leading-snug">{text}</span>
    </>
  );

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex max-w-full items-center gap-1 align-middle", className)}>{inner}</span>
    );
  }

  return (
    <p
      className={cn("text-muted-foreground flex items-center gap-1", className)}
      role="group"
      aria-label="Location"
    >
      {inner}
    </p>
  );
}
