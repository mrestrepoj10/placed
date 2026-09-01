import {
  ArrowRight,
  Cookie,
  KeyRound,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import { PHOTO_CATEGORIES } from "@/lib/photos/types";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

// Official mark, traced from Google's own artwork. Monochrome so it reads as
// part of the page's icon set rather than competing with the CTAs above it.
function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
    </svg>
  );
}

// The "C" is lifted from Procore's own logo SVG (procore-logo.svg on their CDN);
// the inset hexagon is the counter of their app icon. currentColor, to match.
function ProcoreIcon({ className }: { className?: string }) {
  return (
    // Optically inset: a solid mark reads heavier than the open Drive
    // triangle beside it, so it renders ~87% of the box at the same size class.
    <svg
      viewBox="-20 -19.4 320.6 310.1"
      fill="currentColor"
      className={className}
    >
      <path d="M54.2,271.2c-31.8,0-54.2-22.5-54.2-54.2V54.3C0,22.5,22.5,0,54.2,0h172c31.8,0,54.3,22.5,54.3,54.3v53.9h-56.2l-33.7-58.5h-98.8l-50,86,50,86h98.8l33.7-58.5h56.2v53.9c0,31.8-22.5,54.2-54.3,54.2H54.2Z" />
      <path d="M101.66,66.9h79.04l39.84,68.8-39.84,68.8h-79.04l-40-68.8z" />
    </svg>
  );
}

const REPO_URL = "https://github.com/mrestrepoj10/placed";

const steps = [
  {
    title: "Connect",
    body: "Sign in with your Autodesk account and pick a Construction Cloud project. Read-only, per-user permissions. An ACC Account Admin also has to approve this app under Account Admin → Custom Integrations; until they do, sign-in still works but no projects appear.",
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

// Each claim below is load-bearing and must track the auth seam — verify
// against lib/auth/access-token.ts, lib/auth/visitor.ts and proxy.ts before
// editing. Don't soften them into marketing, and don't strengthen them past
// what the code does.
const security = [
  {
    Icon: KeyRound,
    title: "Refresh tokens we never hold",
    body: "Vercel Connect hosts the handshake and keeps Autodesk's rotating refresh tokens and the OAuth client secret. Placed only ever receives short-lived access tokens, held in memory for their lifetime — never written to disk or a database.",
  },
  {
    Icon: ShieldCheck,
    title: "Your permissions, not a service account",
    body: "Every call to Autodesk runs as you. You see exactly the hubs, projects and photos your own account already allows — no more, and nothing shared between visitors.",
  },
  {
    Icon: Cookie,
    title: "No tokens in your browser",
    body: "Your session is a 128-bit random id in an httpOnly, same-site cookie — no Autodesk token, no password, just the key to the grant Vercel Connect holds for you. That makes the cookie itself the thing to protect, and httpOnly plus same-site is the protection.",
  },
  {
    Icon: Trash2,
    title: "Nothing left to leak",
    body: "Photos stream from Autodesk just-in-time and are never copied. Disconnect revokes the grant, and Placed is left holding nothing to delete.",
  },
];

const comingSoon = [
  { name: "Google Drive", Icon: GoogleDriveIcon },
  { name: "Procore", Icon: ProcoreIcon },
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
        <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
          <div className="grid gap-8 sm:grid-cols-3">
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

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="font-heading text-xs tracking-wider text-muted-foreground uppercase">
              More sources coming soon
            </p>
            <ul className="flex flex-wrap items-center gap-2">
              {comingSoon.map(({ name, Icon }) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-2 border px-3 py-1.5 text-sm text-muted-foreground whitespace-nowrap"
                >
                  <Icon className="size-4" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
          <h2 className="font-heading text-xs tracking-wider text-muted-foreground uppercase">
            How sign-in works
          </h2>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
            Placed signs you in through Autodesk&rsquo;s own OAuth flow and asks
            for a single scope &mdash;{" "}
            <code className="font-mono">data:read</code>. It never sees your
            password, and it cannot write to your project.
          </p>

          <dl className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {security.map(({ Icon, title, body }) => (
              <div key={title}>
                <dt className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="border-t px-6 py-5 text-center text-xs text-muted-foreground sm:px-10">
        Autodesk Construction Cloud stays the system of record. Placed is the
        map on top of it.
      </footer>
    </main>
  );
}
