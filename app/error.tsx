"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-lg font-semibold">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.digest
          ? `An unexpected error occurred (${error.digest}).`
          : "An unexpected error occurred."}{" "}
        Autodesk services may be briefly unavailable.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </main>
  );
}
