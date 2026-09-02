/**
 * The photo cluster layers get an explicit id prefix (rather than the
 * auto-generated one) so sibling components can name them: the hover card
 * binds its handlers to the point layer, the coverage grid slots itself
 * underneath the whole stack, and the 3D buildings go under that.
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

/**
 * The coverage grid's layers, bottom-to-top. Named here so `BuildingsLayer`
 * can anchor beneath them: the fill is the lowest layer this app draws
 * whenever the grid is on screen.
 */
export const COVERAGE_FILL_LAYER_ID = "coverage-fill";
export const COVERAGE_LINE_LAYER_ID = "coverage-line";
