"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CATEGORY_META } from "@/lib/photos/categories";
import { hasLocation, type PlacedPhoto } from "@/lib/photos/types";

export interface LoadProgress {
  loaded: number;
  /** Estimated total when known, null while the source is still counting */
  total: number | null;
}

interface StatsBarProps {
  projectName: string;
  photos: PlacedPhoto[];
  locatedCount: number;
  progress: LoadProgress | null;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * The honesty bar: names the project, says how many photos actually have
 * location, and makes the no-location bucket inspectable instead of silently
 * dropping it.
 */
export function StatsBar({
  projectName,
  photos,
  locatedCount,
  progress,
}: StatsBarProps) {
  const unlocated = photos.filter((photo) => !hasLocation(photo));

  return (
    <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-6rem)] rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm">
      <div className="px-3.5 py-2.5">
        <p className="font-heading text-sm font-semibold leading-tight">
          <Link href="/" className="hover:underline">
            placed
          </Link>
          <span className="mx-1.5 text-muted-foreground/60">/</span>
          {projectName}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {progress && (
            <span className="mr-2 inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              loading {progress.loaded.toLocaleString("en-US")}
              {progress.total !== null &&
                ` of ${progress.total.toLocaleString("en-US")}`}
              …
            </span>
          )}
          <span className="font-medium text-foreground">
            {locatedCount.toLocaleString("en-US")}
          </span>{" "}
          of {photos.length.toLocaleString("en-US")} photos have location
          {unlocated.length > 0 && (
            <>
              {" · "}
              <Sheet>
                <SheetTrigger className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                  {unlocated.length.toLocaleString("en-US")} without
                </SheetTrigger>
                <SheetContent side="right" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Photos without location</SheetTitle>
                    <SheetDescription>
                      These photos carry no coordinates — usually desktop
                      uploads or images with stripped EXIF data — so they
                      can&apos;t appear on the map.
                    </SheetDescription>
                  </SheetHeader>
                  <ul className="grid gap-3 px-4 pb-6">
                    {unlocated.map((photo) => (
                      <li key={photo.id} className="flex items-center gap-3">
                        {/* Thumbnails resolve through source-owned URLs (proxy
                            or static) — plain img, no optimizer */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-12 w-16 shrink-0 rounded border object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {photo.title ?? "Untitled"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_META[photo.category].label}
                            {photo.takenAt &&
                              ` · ${dateFormat.format(new Date(photo.takenAt))}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SheetContent>
              </Sheet>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
