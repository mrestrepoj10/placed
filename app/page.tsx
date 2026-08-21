import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

import { Button } from "@/components/ui/button";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import { PHOTO_CATEGORIES } from "@/lib/photos/types";

const REPO_URL = "https://github.com/mrestrepoj10/placed";

const steps = [
  {
    title: "Connect",
    body: "Sign in with your Autodesk account and pick a Construction Cloud project. Read-only, per-user permissions.",
  },
  {
    title: "See",
    body: "Every geolocated field photo lands on an interactive map — clustered, streamed in progressively, colored by origin.",
  },
  {
    title: "Inspect",
    body: "Click a pin for the photo and its metadata, then deep-link back to Autodesk Build. ACC stays the system of record.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <span className="font-heading text-sm font-semibold tracking-tight">
          placed
        </span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <GithubIcon className="size-4" aria-hidden />
          GitHub
        </a>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          Open-source spatial viewer for field photos
        </p>
        <h1 className="font-heading text-5xl font-semibold tracking-tight sm:text-7xl">
          Photos, placed.
        </h1>
        <p className="mt-5 max-w-md text-balance text-muted-foreground">
          Connect a construction project and see where every field photo
          happened.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/demo">
              Try the demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/projects">Connect Autodesk</Link>
          </Button>
        </div>

        <ul
          aria-label="Photo origin categories"
          className="mt-14 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          {PHOTO_CATEGORIES.filter((c) => c !== "other").map((category) => (
            <li
              key={category}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: categoryCssColor(category) }}
              />
              {CATEGORY_META[category].label}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t">
        <div className="mx-auto grid max-w-4xl gap-8 px-6 py-12 sm:grid-cols-3 sm:px-10">
          {steps.map((step, i) => (
            <div key={step.title}>
              <p className="font-heading text-sm font-semibold">
                <span className="mr-2 text-muted-foreground/60">
                  0{i + 1}
                </span>
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t px-6 py-5 text-center text-xs text-muted-foreground sm:px-10">
        Autodesk Construction Cloud stays the system of record — Placed reads
        photo metadata, duplicates nothing, and stores nothing.
      </footer>
    </main>
  );
}
