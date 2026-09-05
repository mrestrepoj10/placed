import { connection } from "next/server";
import { Suspense } from "react";

import { ConnectCard, SetupCard } from "@/components/connect-card";
import { ProjectPhotoMap } from "@/components/photo-map/project-photo-map";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects, type AccProjectCatalog } from "@/lib/acc/client";
import {
  AuthorizationRequiredError,
  ConnectNotConfiguredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

/**
 * The map view for a connected ACC project. The static shell (skeleton)
 * prerenders; auth + project-name resolution stream in behind Suspense, then
 * the client component crawls the photo cursor and densifies the map.
 */
export default function ProjectPage(props: PageProps<"/p/[projectId]">) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <ProjectView params={props.params} />
    </Suspense>
  );
}

function MapSkeleton() {
  return (
    <div className="relative h-dvh w-full">
      <Skeleton className="absolute inset-0 rounded-none" />
      <Skeleton className="absolute top-3 left-3 h-14 w-64 rounded-lg" />
    </div>
  );
}

async function ProjectView({
  params,
}: {
  params: PageProps<"/p/[projectId]">["params"];
}) {
  // Request-time only — see ProjectList in app/projects/page.tsx
  await connection();
  const { projectId } = await params;
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <ConnectCard returnTo={`/p/${projectId}`} />
      </main>
    );
  }

  let catalog: AccProjectCatalog;
  try {
    const token = await getAccessToken(visitorId);
    catalog = await listProjects(token);
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6">
          <ConnectCard returnTo={`/p/${projectId}`} />
        </main>
      );
    }
    if (error instanceof ConnectNotConfiguredError) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6">
          <SetupCard />
        </main>
      );
    }
    throw error;
  }

  const projectName =
    catalog.projects.find((project) => project.id === projectId)?.name ??
    "Project";

  return (
    <ProjectPhotoMap
      projectId={projectId}
      projectName={projectName}
      catalog={catalog}
    />
  );
}
