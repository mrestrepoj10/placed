/**
 * What placed knows about a project beyond its photos — the facts the phase
 * and company legends read. Every field is optional by design: a source that
 * can't supply one (no project dates set, no permission to list members)
 * simply leaves it null, and the legend that depends on it stays hidden.
 */

export interface ProjectMember {
  name: string | null;
  companyId: string | null;
  companyName: string | null;
}

export interface ProjectContext {
  /** Project start, `YYYY-MM-DD`; null when the project has none set */
  startDate: string | null;
  /** Project end, `YYYY-MM-DD`; null when the project has none set */
  endDate: string | null;
  /**
   * Project members keyed by the id photos carry in `createdBy`; null when
   * the member list couldn't be read (as opposed to an empty project).
   */
  members: Record<string, ProjectMember> | null;
}

export const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  startDate: null,
  endDate: null,
  members: null,
};
