import { ChevronRight, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ConnectCard, SetupCard } from "@/components/connect-card";
import { CopyField } from "@/components/copy-field";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ConnectionCard } from "@/components/ui/connection-card";
import { Skeleton } from "@/components/ui/skeleton";
import { APS_CLIENT_ID } from "@/lib/acc/app-id";
import { listProjects, type AccProjectCatalog } from "@/lib/acc/client";
import { apsProvider } from "@/lib/aps-oauth-preset";
import type { OAuthConnection } from "@/lib/oauth-types";
import { groupProjectsByHub } from "@/lib/project-types";
import {
  AuthorizationRequiredError,
  ConnectNotConfiguredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

import { disconnectAction } from "./actions";

export const metadata: Metadata = { title: "Projects" };

/**
 * What placed knows about the grant: one data:read grant per visitor and
 * never a profile (that would need a second scope), so the card shows the
 * provider and scope, not an account.
 */
const autodeskGrant: OAuthConnection = {
  provider: apsProvider,
  status: "connected",
  scopes: ["data:read"],
};

/** Past this many projects, searching a picker beats scanning the list. */
const PICKER_THRESHOLD = 8;

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

  let catalog: AccProjectCatalog;
  try {
    const token = await getAccessToken(visitorId);
    catalog = await listProjects(token);
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return <ConnectCard returnTo="/projects" />;
    }
    if (error instanceof ConnectNotConfiguredError) {
      return <SetupCard />;
    }
    throw error;
  }

  const { hubs, projects } = catalog;
  if (projects.length === 0) {
    return <NoProjectsCard />;
  }

  return (
    <div className="grid gap-8">
      {projects.length > PICKER_THRESHOLD && (
        <ProjectSwitcher hubs={hubs} projects={projects} />
      )}
      {groupProjectsByHub(hubs, projects).map(({ hub, projects: hubProjects }) => (
        <section key={hub?.id ?? "orphans"}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {hub?.name ?? "Other"}
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
      <ConnectionCard connection={autodeskGrant} onDisconnect={disconnectAction} />
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
      <ConnectionCard connection={autodeskGrant} onDisconnect={disconnectAction} />
    </div>
  );
}
