"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProjectPicker } from "@/components/ui/project-picker";
import type { Hub, Project } from "@/lib/project-types";

/**
 * The cantera project picker bound to placed's routes: choosing a project
 * navigates to its map. `value` is the project already open, if any.
 */
export function ProjectSwitcher({
  hubs,
  projects,
  value,
  className,
}: {
  hubs: Hub[];
  projects: Project[];
  value?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <ProjectPicker
      hubs={hubs}
      projects={projects}
      value={value}
      pending={pending}
      placeholder="Open a project"
      aria-label="Project"
      className={className}
      onValueChange={(projectId) => {
        if (projectId === value) return;
        setPending(true);
        router.push(`/p/${projectId}`);
      }}
    />
  );
}
