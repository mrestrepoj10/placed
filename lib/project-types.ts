export interface Hub {
  id: string
  name: string
  region?: string
}

export interface Project {
  id: string
  name: string
  /** Pickers group by it when present. */
  hubId?: string
}

export interface BrowsePathSegment {
  id: string
  name: string
  type: 'hub' | 'project' | 'folder'
}

export interface Folder {
  id: string
  name: string
  /** APS folder adapters set this; hubs and projects can omit it. */
  type?: 'folder'
  lastModifiedTime?: Date | string | number
  modifiedBy?: string
  objectCount?: number
}

export interface ItemVersion {
  id: string
  versionNumber: number
  displayName: string
  createTime: Date | string | number
  createdBy: string
  storageSize: number
  /** URL-safe Model Derivative URN, or null when this version is not translated. */
  derivativeUrn: string | null
}

export interface Item {
  id: string
  name: string
  type: 'item'
  lastModifiedTime?: Date | string | number
  modifiedBy?: string
  tip?: ItemVersion
  translationStatus?: ModelTranslationStatus
}

export type FolderEntry = Folder | Item

export function isItem(entry: FolderEntry): entry is Item {
  return entry.type === 'item'
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase()
}

/** Mirrors the Model Derivative manifest vocabulary; adapters normalize into it. */
export type ModelTranslationStatus = 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'

export interface ModelTranslation {
  /** The design URN the manifest describes (base64, as the API returns it). */
  urn: string
  name?: string
  status: ModelTranslationStatus
  progress?: string
  outputs?: string[]
  error?: string
}

/** A named issuance of construction sheets — an ACC Sheets version set. */
export interface SheetVersionSet {
  id: string
  name: string
  issuanceDate?: Date | string | number
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function versionSetIssuance(versionSet: SheetVersionSet): Date | null {
  if (versionSet.issuanceDate == null) return null
  // A date-only string ("2026-03-12" — the shape ACC Sheets returns) names a
  // calendar day, not an instant. `new Date(string)` would read it as UTC
  // midnight, which formats a day early anywhere west of UTC — so build it in
  // local time instead.
  if (typeof versionSet.issuanceDate === 'string') {
    const dateOnly = DATE_ONLY.exec(versionSet.issuanceDate)
    if (dateOnly) {
      const [, year, month, day] = dateOnly
      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }
  const date = new Date(versionSet.issuanceDate)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Projects referencing no known hub land in a trailing `hub: null` group, so
 * nothing is silently dropped. */
export function groupProjectsByHub(
  hubs: Hub[],
  projects: Project[],
): { hub: Hub | null; projects: Project[] }[] {
  const byHub = new Map<string, Project[]>()
  const orphans: Project[] = []
  // Membership by Set, not `hubs.some()` per project, which would be quadratic.
  const knownHubs = new Set(hubs.map((hub) => hub.id))
  for (const project of projects) {
    const hub = project.hubId != null && knownHubs.has(project.hubId)
    if (!hub) {
      orphans.push(project)
      continue
    }
    const group = byHub.get(project.hubId as string)
    if (group) group.push(project)
    else byHub.set(project.hubId as string, [project])
  }
  const groups: { hub: Hub | null; projects: Project[] }[] = []
  for (const hub of hubs) {
    const grouped = byHub.get(hub.id)
    if (grouped) groups.push({ hub, projects: grouped })
  }
  if (orphans.length > 0) groups.push({ hub: null, projects: orphans })
  return groups
}
