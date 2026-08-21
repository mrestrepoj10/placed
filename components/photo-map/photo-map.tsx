"use client";

import { LngLatBounds } from "maplibre-gl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Map,
  MapClusterLayer,
  MapControls,
  useMap,
  type MapViewport,
} from "@/components/ui/map";
import { categoryColorExpression } from "@/lib/photos/categories";
import {
  toPhotoFeatureCollection,
  type PhotoFeatureCollection,
} from "@/lib/photos/geojson";
import {
  hasLocation,
  PHOTO_CATEGORIES,
  type PhotoCategory,
  type PlacedPhoto,
} from "@/lib/photos/types";

import { Legend } from "./legend";
import { PhotoPanel } from "./photo-panel";
import { StatsBar, type LoadProgress } from "./stats-bar";

interface PhotoMapProps {
  photos: PlacedPhoto[];
  projectName: string;
  /** Present while pages are still streaming in from the source */
  progress?: LoadProgress | null;
  /** Viewport before data arrives (FitBounds takes over once pins exist) */
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}

/** Shareable URL state: ?photo=<id>&c=<lng>,<lat>,<zoom> */
function readUrlState() {
  if (typeof window === "undefined") return { photoId: null, viewport: null };
  const params = new URLSearchParams(window.location.search);
  const photoId = params.get("photo");
  const c = params.get("c")?.split(",").map(Number) ?? [];
  const viewport =
    c.length === 3 && c.every(Number.isFinite)
      ? { center: [c[0], c[1]] as [number, number], zoom: c[2] }
      : null;
  return { photoId, viewport };
}

function writeUrlState(photoId: string | null, viewport: MapViewport | null) {
  const params = new URLSearchParams(window.location.search);
  if (photoId) params.set("photo", photoId);
  else params.delete("photo");
  if (viewport) {
    const [lng, lat] = viewport.center;
    params.set(
      "c",
      `${lng.toFixed(5)},${lat.toFixed(5)},${viewport.zoom.toFixed(2)}`,
    );
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}

/** Category-colored cluster/point layers; colors follow the resolved theme. */
function PhotoLayers({
  collection,
  onSelect,
}: {
  collection: PhotoFeatureCollection;
  onSelect: (id: string) => void;
}) {
  const { resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const pointColor = useMemo(() => categoryColorExpression(theme), [theme]);
  const clusterColors = useMemo<[string, string, string]>(
    () =>
      theme === "dark"
        ? ["#52525b", "#3f3f46", "#27272a"]
        : ["#3f3f46", "#27272a", "#18181b"],
    [theme],
  );

  return (
    <MapClusterLayer
      data={collection}
      pointColor={pointColor}
      pointRadius={7}
      clusterColors={clusterColors}
      clusterThresholds={[25, 150]}
      clusterMaxZoom={16}
      clusterRadius={22}
      onPointClick={(feature) => onSelect(feature.properties.id)}
    />
  );
}

/** Fits the viewport to the data once, unless the URL restored a viewport. */
function FitBounds({
  collection,
  enabled,
}: {
  collection: PhotoFeatureCollection;
  enabled: boolean;
}) {
  const { map, isLoaded } = useMap();
  const doneRef = useRef(false);

  useEffect(() => {
    if (!enabled || doneRef.current || !map || !isLoaded) return;
    const features = collection.features;
    if (features.length === 0) return;
    const bounds = new LngLatBounds();
    for (const feature of features) {
      bounds.extend(feature.geometry.coordinates as [number, number]);
    }
    map.fitBounds(bounds, { padding: 96, maxZoom: 17, animate: false });
    doneRef.current = true;
  }, [enabled, map, isLoaded, collection]);

  return null;
}

export function PhotoMap({
  photos,
  projectName,
  progress,
  fallbackCenter = [0, 20],
  fallbackZoom = 1.5,
}: PhotoMapProps) {
  const [urlState] = useState(readUrlState);
  const [selectedId, setSelectedId] = useState<string | null>(
    urlState.photoId,
  );
  const [activeCategories, setActiveCategories] = useState<
    ReadonlySet<PhotoCategory>
  >(() => new Set(PHOTO_CATEGORIES));

  const photosById = useMemo(
    () => new globalThis.Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const located = useMemo(() => photos.filter(hasLocation), [photos]);

  const locatedCounts = useMemo(() => {
    const counts = {} as Record<PhotoCategory, number>;
    for (const category of PHOTO_CATEGORIES) counts[category] = 0;
    for (const photo of located) counts[photo.category] += 1;
    return counts;
  }, [located]);

  const collection = useMemo(
    () =>
      toPhotoFeatureCollection(
        located.filter((photo) => activeCategories.has(photo.category)),
      ),
    [located, activeCategories],
  );

  const selected = selectedId ? (photosById.get(selectedId) ?? null) : null;

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    writeUrlState(id, null);
  }, []);

  // Debounced shareable-viewport sync — shallow, never a server roundtrip
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const handleViewportChange = useCallback((viewport: MapViewport) => {
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = setTimeout(() => {
      writeUrlState(selectedIdRef.current, viewport);
    }, 400);
  }, []);
  useEffect(
    () => () => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
    },
    [],
  );

  const toggleCategory = useCallback((category: PhotoCategory) => {
    setActiveCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Map
        className="absolute inset-0"
        center={urlState.viewport?.center ?? fallbackCenter}
        zoom={urlState.viewport?.zoom ?? fallbackZoom}
        onViewportChange={handleViewportChange}
        attributionControl={{ compact: true }}
      >
        <MapControls position="bottom-right" />
        <PhotoLayers collection={collection} onSelect={select} />
        <FitBounds
          collection={collection}
          enabled={urlState.viewport === null}
        />
      </Map>

      <StatsBar
        projectName={projectName}
        photos={photos}
        locatedCount={located.length}
        progress={progress ?? null}
      />

      <Legend
        counts={locatedCounts}
        active={activeCategories}
        onToggle={toggleCategory}
      />

      {selected && (
        <PhotoPanel photo={selected} onClose={() => select(null)} />
      )}
    </div>
  );
}
