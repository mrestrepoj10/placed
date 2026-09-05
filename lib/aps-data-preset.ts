import type {
  Folder,
  Hub,
  Item,
  ItemVersion,
  ModelTranslation,
  ModelTranslationStatus,
  Project,
  SheetVersionSet,
} from '@/lib/project-types'

// Data translation, not a client — fetching and token handling belong to your
// auth layer. Each input interface is the structural subset the adapter reads,
// so any payload with these fields adapts, including the emulator's.

interface ApsNamedResource {
  id: string
  attributes?: {
    name?: string
    displayName?: string
  }
}

// JSON:API resources are inconsistent about `name` versus `displayName`.
function resourceName(resource: ApsNamedResource): string {
  return resource.attributes?.displayName ?? resource.attributes?.name ?? resource.id
}

interface ApsRelationship {
  data?: { id?: string } | null
}

function relationshipId(relationship: ApsRelationship | undefined): string | undefined {
  return relationship?.data?.id
}

export interface ApsHubDoc {
  id: string
  attributes?: {
    name?: string
    region?: string
  }
}

export function fromApsHub(doc: ApsHubDoc): Hub {
  return {
    id: doc.id,
    name: resourceName(doc),
    region: doc.attributes?.region,
  }
}

export interface ApsProjectDoc {
  id: string
  attributes?: {
    name?: string
  }
  relationships?: {
    hub?: {
      data?: {
        id?: string
      }
    }
  }
}

export function fromApsProject(doc: ApsProjectDoc): Project {
  return {
    id: doc.id,
    name: resourceName(doc),
    hubId: relationshipId(doc.relationships?.hub),
  }
}

export interface ApsFolderDoc extends ApsNamedResource {
  attributes?: ApsNamedResource['attributes'] & {
    lastModifiedTime?: string
    lastModifiedUserName?: string
    lastModifiedUserId?: string
    objectCount?: number
  }
}

export function fromApsFolder(doc: ApsFolderDoc): Folder {
  return {
    id: doc.id,
    name: resourceName(doc),
    type: 'folder',
    lastModifiedTime: doc.attributes?.lastModifiedTime,
    modifiedBy: doc.attributes?.lastModifiedUserName ?? doc.attributes?.lastModifiedUserId,
    objectCount: doc.attributes?.objectCount,
  }
}

export interface ApsVersionDoc extends ApsNamedResource {
  attributes?: ApsNamedResource['attributes'] & {
    versionNumber?: number
    createTime?: string
    createUserName?: string
    createUserId?: string
    storageSize?: number
  }
  relationships?: {
    derivatives?: ApsRelationship
  }
}

export function fromApsVersion(doc: ApsVersionDoc): ItemVersion {
  return {
    id: doc.id,
    versionNumber: doc.attributes?.versionNumber ?? 1,
    displayName: resourceName(doc),
    createTime: doc.attributes?.createTime ?? 0,
    createdBy: doc.attributes?.createUserName ?? doc.attributes?.createUserId ?? 'Unknown user',
    storageSize: doc.attributes?.storageSize ?? 0,
    derivativeUrn: relationshipId(doc.relationships?.derivatives) ?? null,
  }
}

export interface ApsItemDoc extends ApsNamedResource {
  attributes?: ApsNamedResource['attributes'] & {
    lastModifiedTime?: string
    lastModifiedUserName?: string
    lastModifiedUserId?: string
  }
  relationships?: {
    tip?: ApsRelationship
  }
}

/** Pass the tip resource from the JSON:API `included` array when available;
 * it is ignored if it does not match the item's tip relation. */
export function fromApsItem(doc: ApsItemDoc, tipDoc?: ApsVersionDoc): Item {
  const tipId = relationshipId(doc.relationships?.tip)
  const tip = tipDoc && (!tipId || tipDoc.id === tipId) ? fromApsVersion(tipDoc) : undefined
  return {
    id: doc.id,
    name: resourceName(doc),
    type: 'item',
    lastModifiedTime: doc.attributes?.lastModifiedTime,
    modifiedBy: doc.attributes?.lastModifiedUserName ?? doc.attributes?.lastModifiedUserId,
    tip,
    translationStatus: tip ? (tip.derivativeUrn ? 'success' : 'pending') : undefined,
  }
}

const translationStatuses: ModelTranslationStatus[] = [
  'pending',
  'inprogress',
  'success',
  'failed',
  'timeout',
]

// Unknown strings read as "pending" — the one state that promises nothing.
export function toTranslationStatus(status: string | undefined): ModelTranslationStatus {
  const normalized = status?.toLowerCase()
  return translationStatuses.find((known) => known === normalized) ?? 'pending'
}

export interface ApsManifestDoc {
  urn: string
  status?: string
  progress?: string
  derivatives?: {
    name?: string
    outputType?: string
    status?: string
  }[]
}

// The design name comes from the first named derivative: the manifest itself has none.
export function fromApsManifest(doc: ApsManifestDoc): ModelTranslation {
  const derivatives = doc.derivatives ?? []
  const outputs: string[] = []
  for (const derivative of derivatives) {
    if (derivative.outputType && !outputs.includes(derivative.outputType)) {
      outputs.push(derivative.outputType)
    }
  }
  const failed = derivatives.find(
    (derivative) => toTranslationStatus(derivative.status) === 'failed',
  )
  return {
    urn: doc.urn,
    name: derivatives.find((derivative) => derivative.name)?.name,
    status: toTranslationStatus(doc.status),
    // "complete" restates success; it only reads as progress mid-translation.
    progress: doc.progress === 'complete' ? undefined : doc.progress,
    outputs: outputs.length > 0 ? outputs : undefined,
    error: failed?.name ? `Derivative "${failed.name}" failed to translate.` : undefined,
  }
}

export interface AccVersionSetDoc {
  id: string
  name?: string
  issuanceDate?: string
}

export function fromAccVersionSet(doc: AccVersionSetDoc): SheetVersionSet {
  return {
    id: doc.id,
    name: doc.name ?? doc.id,
    issuanceDate: doc.issuanceDate,
  }
}
