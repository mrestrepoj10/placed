/**
 * The exclusive map modes. Each one re-reads the same photo set through a
 * different lens: what kind of work happened here, how recently, and where
 * nothing has been photographed at all.
 */
export const MAP_MODES = ["categories", "activity", "coverage"] as const;

export type MapMode = (typeof MAP_MODES)[number];

export const MAP_MODE_META: Record<
  MapMode,
  { label: string; description: string }
> = {
  categories: {
    label: "Origin",
    description: "Points colored by the module the photo came from",
  },
  activity: {
    label: "Recency",
    description: "Points colored by how long ago they were captured",
  },
  coverage: {
    label: "Coverage",
    description: "Grid cells colored by their most recent photo; empty cells are gaps",
  },
};

export function isMapMode(value: string | null): value is MapMode {
  return value !== null && (MAP_MODES as readonly string[]).includes(value);
}
