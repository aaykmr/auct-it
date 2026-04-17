import { Suspense } from "react";
import { BrowseClient } from "./browse-client";

export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Browse</h1>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <BrowseClient />
      </Suspense>
    </div>
  );
}
