/**
 * The photo cluster layers get an explicit id prefix (rather than the
 * auto-generated one) so sibling components can name them: the hover card
 * binds its handlers to the point layer, and the coverage grid slots itself
 * underneath the whole stack.
 */
export const PHOTO_LAYER_PREFIX = "photos";

export const PHOTO_CLUSTER_LAYER_ID = `clusters-${PHOTO_LAYER_PREFIX}`;
export const PHOTO_CLUSTER_COUNT_LAYER_ID = `cluster-count-${PHOTO_LAYER_PREFIX}`;
export const PHOTO_POINT_LAYER_ID = `unclustered-point-${PHOTO_LAYER_PREFIX}`;

/** Bottom-to-top, matching the order `MapClusterLayer` adds them. */
export const PHOTO_LAYER_IDS = [
  PHOTO_CLUSTER_LAYER_ID,
  PHOTO_CLUSTER_COUNT_LAYER_ID,
  PHOTO_POINT_LAYER_ID,
] as const;
