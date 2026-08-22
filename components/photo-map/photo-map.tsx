"use client";

import { LngLatBounds } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Map,
  MapClusterLayer,
  MapControls,
  useMap,
  type MapViewport,
} from "@/components/ui/map";
import { categoryColorExpression } from "@/lib/photos/categories";
import { buildCoverageGrid } from "@/lib/photos/coverage";
import {
  DEFAULT_FILTERS,
  matchesFilters,
  type PhotoFilters,
} from "@/lib/photos/filters";
import {
  toPhotoFeatureCollection,
  type PhotoFeatureCollection,
} from "@/lib/photos/geojson";
import type { MapMode } from "@/lib/photos/map-modes";
import { recencyColorExpression } from "@/lib/photos/recency";
import {
  hasLocation,
  photoCapturedAt,
  PHOTO_CATEGORIES,
  PHOTO_MEDIA_TYPES,
  type PhotoCategory,
  type PhotoMediaType,
  type PlacedPhoto,
} from "@/lib/photos/types";
import { readUrlState, writeUrlState } from "@/lib/photos/url-state";

import { CoverageLayer } from "./coverage-layer";
import { FilterBar } from "./filter-bar";
import { PHOTO_LAYER_PREFIX } from "./layer-ids";
import { Legend } from "./legend";
import { PhotoHoverCard } from "./photo-hover-card";
import { PhotoPanel } from "./photo-panel";
import { SelectedPin } from "./selected-pin";
import { StatsBar, type LoadProgress } from "./stats-bar";
import { Timeline } from "./timeline";

interface PhotoMapProps {
  photos: PlacedPhoto[];
  projectName: string;
  /** Present while pages are still streaming in from the source */
  progress?: LoadProgress | null;
  /** Viewport before data arrives (FitBounds takes over once pins exist) */
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}

/** Category-, recency- or coverage-colored layers; colors follow the theme. */
function PhotoLayers({
  collection,
  mode,
  asOf,
  onSelect,
}: {
  collection: PhotoFeatureCollection;
  mode: MapMode;
  /** Null until the client has read the clock — see the effect in PhotoMap */
  asOf: number | null;
  onSelect: (id: string) => void;
}) {
  const { resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const pointColor = useMemo(
    () =>
      mode === "categories" || asOf === null
        ? categoryColorExpression(theme)
        : recencyColorExpression(theme, asOf),
    [mode, theme, asOf],
  );
  const clusterColors = useMemo<[string, string, string]>(
    () =>
      theme === "dark"
        ? ["#52525b", "#3f3f46", "#27272a"]
        : ["#3f3f46", "#27272a", "#18181b"],
    [theme],
  );

  return (
    <MapClusterLayer
      id={PHOTO_LAYER_PREFIX}
      data={collection}
      pointColor={pointColor}
      // Coverage mode is about the grid; the pins stay clickable but step back.
      pointRadius={mode === "coverage" ? 5 : 7}
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

/**
 * Keeps the selected photo on screen. Clicking a pin never needs this; walking
 * the set with the arrow keys does, because the next photo in time is rarely
 * the next photo in space.
 */
function FollowSelection({ photo }: { photo: PlacedPhoto | null }) {
  const { map, isLoaded } = useMap();
  const target = photo && hasLocation(photo) ? photo : null;
  const id = target?.id ?? null;

  useEffect(() => {
    if (!map || !isLoaded || !target) return;
    const center: [number, number] = [target.longitude, target.latitude];
    if (map.getBounds().contains(center)) return;
    map.easeTo({ center, duration: 500 });
    // Re-run per selection, not per render of the same photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, id]);

  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[data-timeline]") !== null
  );
}

export function PhotoMap({
  photos,
  projectName,
  progress,
  fallbackCenter = [0, 20],
  fallbackZoom = 1.5,
}: PhotoMapProps) {
  // The map page never reads searchParams on the server (it would opt the
  // shell out of prerendering), so the viewport — the one piece needed before
  // the map is constructed — is read during the first client render, and the
  // rest of the view state is applied just after hydration.
  const [initialViewport] = useState(() => readUrlState().viewport);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PhotoFilters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<MapMode>("categories");

  // Everything the prerender cannot know: the query string (the shell is
  // static, so seeding it into the first client render would mismatch the
  // server HTML for anyone opening a shared link) and the wall clock (a
  // prerender that observed `Date.now()` would bake it into the CDN copy).
  // Both land together, right after hydration, for one extra render.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const restored = readUrlState();
    setSelectedId(restored.photoId);
    setFilters(restored.filters);
    setMode(restored.mode);
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const photosById = useMemo(
    () => new globalThis.Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const located = useMemo(() => photos.filter(hasLocation), [photos]);

  // Facet counts exclude their own facet, so a control always shows what
  // picking a different value in it would give you.
  const locatedCounts = useMemo(() => {
    const counts = {} as Record<PhotoCategory, number>;
    for (const category of PHOTO_CATEGORIES) counts[category] = 0;
    for (const photo of located) {
      if (matchesFilters(photo, filters, "categories")) {
        counts[photo.category] += 1;
      }
    }
    return counts;
  }, [located, filters]);

  const mediaTypeCounts = useMemo(() => {
    const counts = {} as Record<PhotoMediaType, number>;
    for (const type of PHOTO_MEDIA_TYPES) counts[type] = 0;
    for (const photo of located) {
      if (matchesFilters(photo, filters, "mediaTypes")) {
        counts[photo.mediaType] += 1;
      }
    }
    return counts;
  }, [located, filters]);

  const timelinePhotos = useMemo(
    () => located.filter((photo) => matchesFilters(photo, filters, "date")),
    [located, filters],
  );

  const visible = useMemo(
    () => located.filter((photo) => matchesFilters(photo, filters)),
    [located, filters],
  );
  const collection = useMemo(
    () => toPhotoFeatureCollection(visible),
    [visible],
  );

  // Recency is measured from the brush's right edge when there is one, so
  // playing the timeline back re-ages the map to each moment in turn.
  const asOf = filters.end ?? now;
  const asOfFromBrush = filters.end !== null;

  const coverage = useMemo(
    () =>
      mode === "coverage" && asOf !== null
        ? buildCoverageGrid(visible, asOf, located)
        : null,
    [mode, visible, located, asOf],
  );

  const selected = selectedId ? (photosById.get(selectedId) ?? null) : null;

  // The URL trails the live state; every writer reads the latest through refs
  // so a viewport tick can't publish a stale filter set, or vice versa.
  const stateRef = useRef({ selectedId, filters, mode });
  useEffect(() => {
    stateRef.current = { selectedId, filters, mode };
  }, [selectedId, filters, mode]);

  const publish = useCallback((viewport: MapViewport | null) => {
    const { selectedId: photoId, filters: current, mode: currentMode } =
      stateRef.current;
    writeUrlState({ photoId, viewport, filters: current, mode: currentMode });
  }, []);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      stateRef.current = { ...stateRef.current, selectedId: id };
      publish(null);
    },
    [publish],
  );

  const updateFilters = useCallback(
    (next: PhotoFilters) => {
      setFilters(next);
      stateRef.current = { ...stateRef.current, filters: next };
      publish(null);
    },
    [publish],
  );

  const updateMode = useCallback(
    (next: MapMode) => {
      setMode(next);
      stateRef.current = { ...stateRef.current, mode: next };
      publish(null);
    },
    [publish],
  );

  // Debounced shareable-viewport sync — shallow, never a server roundtrip
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleViewportChange = useCallback(
    (viewport: MapViewport) => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      viewportTimer.current = setTimeout(() => publish(viewport), 400);
    },
    [publish],
  );
  useEffect(
    () => () => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
    },
    [],
  );

  const toggleCategory = useCallback(
    (category: PhotoCategory) => {
      const next = new Set(stateRef.current.filters.categories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      updateFilters({ ...stateRef.current.filters, categories: next });
    },
    [updateFilters],
  );

  const setDateRange = useCallback(
    (start: number | null, end: number | null) => {
      updateFilters({ ...stateRef.current.filters, start, end });
    },
    [updateFilters],
  );

  // Arrow keys walk the visible photos in capture order while the panel is
  // open — the reading order of a site visit, not of the pin layer.
  const chronological = useMemo(() => {
    const dated: { photo: PlacedPhoto; at: number }[] = [];
    for (const photo of visible) {
      const at = photoCapturedAt(photo);
      if (at !== null) dated.push({ photo, at });
    }
    dated.sort((a, b) => a.at - b.at || a.photo.id.localeCompare(b.photo.id));
    return dated.map((entry) => entry.photo);
  }, [visible]);

  const chronologicalRef = useRef(chronological);
  useEffect(() => {
    chronologicalRef.current = chronological;
  }, [chronological]);

  useEffect(() => {
    if (selectedId === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        select(null);
        return;
      }
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (step === 0 || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const ordered = chronologicalRef.current;
      if (ordered.length === 0) return;
      event.preventDefault();
      const index = ordered.findIndex((photo) => photo.id === selectedId);
      // A selection the filters have hidden still anchors the walk: step from
      // the start of the set rather than dropping the keypress.
      const nextIndex =
        index === -1
          ? step > 0
            ? 0
            : ordered.length - 1
          : (index + step + ordered.length) % ordered.length;
      select(ordered[nextIndex].id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, select]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Map
        className="absolute inset-0"
        center={initialViewport?.center ?? fallbackCenter}
        zoom={initialViewport?.zoom ?? fallbackZoom}
        onViewportChange={handleViewportChange}
        attributionControl={{ compact: true }}
      >
        <MapControls position="bottom-right" />
        {coverage && <CoverageLayer grid={coverage} />}
        <PhotoLayers
          collection={collection}
          mode={mode}
          asOf={asOf}
          onSelect={select}
        />
        <SelectedPin photo={selected} />
        <PhotoHoverCard photosById={photosById} />
        <FollowSelection photo={selected} />
        <FitBounds collection={collection} enabled={initialViewport === null} />
      </Map>

      <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 lg:max-w-[calc(100%-23rem)]">
        <StatsBar
          projectName={projectName}
          photos={photos}
          locatedCount={located.length}
          shownCount={visible.length}
          progress={progress ?? null}
        />
        <FilterBar
          search={filters.search}
          onSearchChange={(search) => updateFilters({ ...filters, search })}
          mediaTypes={filters.mediaTypes}
          onMediaTypesChange={(mediaTypes) =>
            updateFilters({ ...filters, mediaTypes })
          }
          mediaTypeCounts={mediaTypeCounts}
          mode={mode}
          onModeChange={updateMode}
        />
      </div>

      <Legend
        mode={mode}
        counts={locatedCounts}
        active={filters.categories}
        onToggle={toggleCategory}
        coverage={coverage}
        asOf={asOf}
        asOfFromBrush={asOfFromBrush}
        className="absolute bottom-32 left-3 z-10"
      />

      <div className="pointer-events-none absolute right-14 bottom-3 left-3 z-10">
        <Timeline
          photos={timelinePhotos}
          start={filters.start}
          end={filters.end}
          onChange={setDateRange}
        />
      </div>

      {selected && (
        <PhotoPanel photo={selected} onClose={() => select(null)} />
      )}
    </div>
  );
}
