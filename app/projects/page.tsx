import { ChevronRight, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ConnectCard, SetupCard } from "@/components/connect-card";
import { CopyField } from "@/components/copy-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { APS_CLIENT_ID } from "@/lib/acc/app-id";
import { listProjects, type AccProject } from "@/lib/acc/client";
import {
  AuthorizationRequiredError,
  ConnectNotConfiguredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

import { disconnectAction } from "./actions";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-heading text-lg font-semibold">
          <Link href="/" className="text-muted-foreground hover:underline">
            placed
          </Link>
          <span className="mx-2 text-muted-foreground/60">/</span>
          projects
        </h1>
      </header>
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectList />
      </Suspense>
    </main>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

async function ProjectList() {
  // Request-time only: the token layer's cache reads Date.now(), which the
  // Cache Components prerenderer rejects during shell generation.
  await connection();
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return <ConnectCard returnTo="/projects" />;
  }

  let projects: AccProject[];
  try {
    const token = await getAccessToken(visitorId);
    projects = await listProjects(token);
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return <ConnectCard returnTo="/projects" />;
    }
    if (error instanceof ConnectNotConfiguredError) {
      return <SetupCard />;
    }
    throw error;
  }

  if (projects.length === 0) {
    return <NoProjectsCard />;
  }

  const hubs = new Map<string, AccProject[]>();
  for (const project of projects) {
    const group = hubs.get(project.hubName) ?? [];
    group.push(project);
    hubs.set(project.hubName, group);
  }

  return (
    <div className="grid gap-8">
      {[...hubs.entries()].map(([hubName, hubProjects]) => (
        <section key={hubName}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {hubName}
          </h2>
          <ul className="grid gap-2">
            {hubProjects.map((project) => (
              <li key={project.id}>
                <Link
                  prefetch={true}
                  href={`/p/${project.id}`}
                  className="group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <FolderOpen
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-sm font-medium">
                    {project.name}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <form action={disconnectAction} className="justify-self-start">
        <Button variant="ghost" size="sm" type="submit">
          Disconnect Autodesk account
        </Button>
      </form>
    </div>
  );
}

// Signed in, but Autodesk returned no hubs. Almost always this means an ACC
// Account Admin hasn't provisioned the app yet — the API reports that as an
// empty list, not an error, so this is where the instructions have to live.
function NoProjectsCard() {
  return (
    <div className="grid gap-6 rounded-lg border border-dashed p-8">
      <div>
        <h2 className="font-heading text-sm font-semibold">
          No projects visible yet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You&rsquo;re signed in, but Autodesk isn&rsquo;t showing placed any
          Construction Cloud hubs. Usually that means an ACC Account Admin
          hasn&rsquo;t added placed under{" "}
          <span className="text-foreground">
            Account Admin &rarr; Custom Integrations
          </span>{" "}
          yet. Send them this client ID &mdash; it&rsquo;s a one-time step per
          account. Once it&rsquo;s in, reload this page.
        </p>
      </div>
      <CopyField label="client ID" value={APS_CLIENT_ID} />
      <p className="text-xs text-muted-foreground">
        Already provisioned? Then your account has no ACC projects, or your
        role can&rsquo;t see them &mdash; the same permissions apply as in
        Autodesk Build.
      </p>
      <form action={disconnectAction} className="justify-self-start">
        <Button variant="ghost" size="sm" type="submit">
          Disconnect Autodesk account
        </Button>
      </form>
    </div>
  );
}
