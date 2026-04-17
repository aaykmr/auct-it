"use client";

import Image from "next/image";
import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuctionImageCarousel({
  imageUrls,
  title,
  auctionId,
}: {
  imageUrls: string[];
  title: string;
  auctionId: string;
}) {
  const fallback = `https://picsum.photos/seed/${auctionId}/1600/1000`;
  const images = imageUrls.length > 0 ? imageUrls : [fallback];
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -48) go(1);
    else if (dx > 48) go(-1);
  };

  const track = (
    <div
      className="flex h-full w-full transition-transform duration-300 ease-out"
      style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
    >
      {images.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className={cn(
            "relative h-full min-w-full shrink-0",
            isMobile && "cursor-zoom-in",
            !isMobile && "cursor-default",
          )}
          onClick={() => isMobile && setFullscreen(true)}
          onKeyDown={(e) => {
            if (!isMobile) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFullscreen(true);
            }
          }}
          role={isMobile ? "button" : undefined}
          tabIndex={isMobile ? 0 : undefined}
          aria-label={isMobile ? "Open photos fullscreen" : undefined}
        >
          <Image
            src={src}
            alt={title ? `${title} — photo ${i + 1} of ${count}` : `Listing photo ${i + 1}`}
            fill
            className="pointer-events-none object-cover select-none"
            sizes="(max-width: 1024px) 100vw, 75vw"
            priority={i === 0}
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted">
        <div className="relative h-full w-full overflow-hidden">{track}</div>
        {count > 1 && (
          <>
            <div className="absolute top-1/2 left-2 z-10 -translate-y-1/2 md:left-3">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="bg-background/90 shadow-sm transition-transform active:!translate-y-0 active:scale-[0.97]"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
              >
                <CaretLeftIcon className="size-4" weight="regular" />
              </Button>
            </div>
            <div className="absolute top-1/2 right-2 z-10 -translate-y-1/2 md:right-3">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="bg-background/90 shadow-sm transition-transform active:!translate-y-0 active:scale-[0.97]"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
              >
                <CaretRightIcon className="size-4" weight="regular" />
              </Button>
            </div>
            <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    i === index ? "bg-primary" : "bg-foreground/25 hover:bg-foreground/40",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Photos fullscreen"
        >
          <div className="flex shrink-0 items-center justify-end p-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              aria-label="Close"
              onClick={() => setFullscreen(false)}
            >
              <XIcon className="size-6" weight="regular" />
            </Button>
          </div>
          <div
            className="relative min-h-0 flex-1 overflow-hidden px-0 pb-8"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex h-full w-full transition-transform duration-300 ease-out"
              style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
            >
              {images.map((src, i) => (
                <div key={`fs-${src}-${i}`} className="relative h-full min-w-full shrink-0">
                  <Image
                    src={src}
                    alt={title ? `${title} — photo ${i + 1}` : `Photo ${i + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                  />
                </div>
              ))}
            </div>
            {count > 1 && (
              <>
                <div className="absolute top-1/2 left-2 z-10 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="bg-white/90 text-foreground shadow-md transition-transform active:!translate-y-0 active:scale-[0.97]"
                    aria-label="Previous image"
                    onClick={() => go(-1)}
                  >
                    <CaretLeftIcon className="size-5" weight="regular" />
                  </Button>
                </div>
                <div className="absolute top-1/2 right-2 z-10 -translate-y-1/2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="bg-white/90 text-foreground shadow-md transition-transform active:!translate-y-0 active:scale-[0.97]"
                    aria-label="Next image"
                    onClick={() => go(1)}
                  >
                    <CaretRightIcon className="size-5" weight="regular" />
                  </Button>
                </div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {images.map((_, i) => (
                    <button
                      key={`fs-dot-${i}`}
                      type="button"
                      aria-label={`Photo ${i + 1}`}
                      aria-current={i === index}
                      className={cn(
                        "size-2.5 rounded-full transition-colors",
                        i === index ? "bg-white" : "bg-white/35",
                      )}
                      onClick={() => setIndex(i)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
