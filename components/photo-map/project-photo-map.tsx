"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo } from "react";

import { ConnectCard, SetupCard } from "@/components/connect-card";
import { Button } from "@/components/ui/button";
import type { PhotoPage } from "@/lib/photos/types";

import { PhotoMap } from "./photo-map";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function fetchPage(
  projectId: string,
  cursor: string | null,
): Promise<PhotoPage> {
  const url = new URL(
    `/api/projects/${projectId}/photos`,
    window.location.origin,
  );
  if (cursor) url.searchParams.set("cursor", cursor);

  const response = await fetch(url);
  if (!response.ok) {
    let code = "request-failed";
    try {
      code = (await response.json()).error ?? code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, code);
  }
  return response.json();
}

/**
 * Streams the project's photo gallery through the serial ACC cursor: each
 * resolved page immediately densifies the map, and the next page starts
 * fetching until the cursor runs dry. React Query supplies retry, cross-
 * project caching, and abort-on-unmount.
 */
export function ProjectPhotoMap({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const {
    data,
    error,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["photos", projectId],
    queryFn: ({ pageParam }) => fetchPage(projectId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: (failureCount, err) =>
      err instanceof ApiError && err.status === 401
        ? false
        : failureCount < 3,
  });

  // Auto-advance the serial cursor while pages remain
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const photos = useMemo(
    () => data?.pages.flatMap((page) => page.photos) ?? [],
    [data],
  );

  if (isError && error instanceof ApiError && error.status === 401) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <ConnectCard returnTo={`/p/${projectId}`} />
      </main>
    );
  }
  if (isError && error instanceof ApiError && error.status === 503) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <SetupCard />
      </main>
    );
  }

  const loading = hasNextPage !== false || photos.length === 0;

  return (
    <>
      <PhotoMap
        photos={photos}
        projectName={projectName}
        progress={
          loading && !isError ? { loaded: photos.length, total: null } : null
        }
      />
      {isError && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background px-4 py-2 text-sm shadow-lg">
          <span>
            Photo loading stopped
            {photos.length > 0 && ` after ${photos.length.toLocaleString("en-US")}`}
            .
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RotateCcw className="size-3.5" aria-hidden />
            Retry
          </Button>
        </div>
      )}
    </>
  );
}
