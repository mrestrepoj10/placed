"use client";

import { LngLatBounds } from "maplibre-gl";
import {
  type ReactNode,
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
  type MapRef,
  type MapViewport,
} from "@/components/ui/map";
import {
  CATEGORY_META,
  categoryColorExpression,
  categoryCssColor,
} from "@/lib/photos/categories";
import { buildCoverageGrid } from "@/lib/photos/coverage";
import {
  DEFAULT_FILTERS,
  matchesFilters,
  type GroupResolver,
  type PhotoFilters,
} from "@/lib/photos/filters";
import {
  toPhotoFeatureCollection,
  type PhotoFeatureCollection,
} from "@/lib/photos/geojson";
import {
  companyEntries,
  GROUP_DIMENSIONS,
  groupColorExpression,
  PHASE_META,
  phaseOf,
  PHOTO_PHASES,
  projectWindow,
  themedCssColor,
  type GroupDimension,
  type GroupEntry,
  type PhotoPhase,
} from "@/lib/photos/groupings";
import type { MapMode } from "@/lib/photos/map-modes";
import type { ProjectContext } from "@/lib/photos/project-context";
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
import {
  readUrlState,
  writeUrlState,
  type ClusterPreference,
} from "@/lib/photos/url-state";

import { BuildingsLayer } from "./buildings-layer";
import { CoverageLayer } from "./coverage-layer";
import { FilterBar } from "./filter-bar";
import { PHOTO_LAYER_PREFIX, SELECTED_PIN_LAYER_ID } from "./layer-ids";
import { Legend, type LegendEntry } from "./legend";
import { PhotoHoverCard } from "./photo-hover-card";
import { PhotoPanel } from "./photo-panel";
import { SelectedPin } from "./selected-pin";
import { StatsBar, type LoadProgress } from "./stats-bar";
import { Timeline } from "./timeline";

/**
 * Where the camera tilts to when 3D turns on: steep enough that walls have
 * height, shallow enough that pins a block back stay legible.
 */
const PITCH_3D = 50;

/**
 * Past this many located photos, "auto" clusters. Below it every pin can show
 * its legend color without the map turning to mush, which is the whole point
 * of reading it unclustered.
 */
const AUTO_CLUSTER_THRESHOLD = 300;

interface PhotoMapProps {
  photos: PlacedPhoto[];
  projectName: string;
  /** Replaces the project name in the stats bar with a picker, when the
   * visitor has other projects to jump to */
  projectSwitcher?: ReactNode;
  /** Present while pages are still streaming in from the source */
  progress?: LoadProgress | null;
  /**
   * Project dates and members, when the source can supply them — unlocks the
   * phase and company legends. Absent or partial is fine; the legend only
   * offers what this can answer.
   */
  context?: ProjectContext | null;
  /** Viewport before data arrives (FitBounds takes over once pins exist) */
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}

/** Category-, recency- or coverage-colored layers; colors follow the theme. */
const PHASE_ENTRIES: GroupEntry[] = PHOTO_PHASES.map((phase) => ({
  key: phase,
  ...PHASE_META[phase],
}));

function PhotoLayers({
  collection,
  mode,
  dimension,
  companies,
  cluster,
  asOf,
  onSelect,
}: {
  collection: PhotoFeatureCollection;
  mode: MapMode;
  cluster: boolean;
  dimension: GroupDimension;
  /** Company rows, when the company grouping is available */
  companies: readonly GroupEntry[] | null;
  /** Null until the client has read the clock — see the effect in PhotoMap */
  asOf: number | null;
  onSelect: (id: string) => void;
}) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  // Toggling clustering rebuilds the photo layers on top of the stack (the
  // child's effect runs first); lift the selection ring back above them.
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (map.getLayer(SELECTED_PIN_LAYER_ID)) {
      map.moveLayer(SELECTED_PIN_LAYER_ID);
    }
  }, [map, isLoaded, cluster]);

  const pointColor = useMemo(() => {
    if (mode !== "categories" && asOf !== null) {
      return recencyColorExpression(theme, asOf);
    }
    if (dimension === "phase") {
      return groupColorExpression("phase", PHASE_ENTRIES, theme);
    }
    if (dimension === "company" && companies) {
      return groupColorExpression("company", companies, theme);
    }
    return categoryColorExpression(theme);
  }, [mode, dimension, companies, theme, asOf]);
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
      cluster={cluster}
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

const captionDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDay(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : captionDate.format(date);
}

/** The line under a grouped legend saying what it was cut against. */
function groupCaption(
  dimension: GroupDimension,
  context: ProjectContext | null,
): string | undefined {
  if (dimension === "phase" && context) {
    const start = formatDay(context.startDate);
    const end = formatDay(context.endDate);
    if (start && end) return `Project dates ${start} – ${end}`;
    if (start) return `Project start ${start}`;
    if (end) return `Project end ${end}`;
  }
  if (dimension === "company") {
    return "By the uploader's company on the project";
  }
  return undefined;
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
  projectSwitcher,
  progress,
  context = null,
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
  const [buildings3d, setBuildings3d] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupDimension>("origin");
  const [clusterPref, setClusterPref] = useState<ClusterPreference>("auto");
  const mapRef = useRef<MapRef>(null);

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
    setBuildings3d(restored.buildings3d);
    setGroupBy(restored.groupBy);
    setClusterPref(restored.cluster);
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

  // The context-dependent groupings. Company colors are ranked over every
  // located photo, not the filtered set, so a company keeps its color while
  // the viewer brushes and filters.
  const projectSpan = useMemo(
    () => (context ? projectWindow(context) : null),
    [context],
  );
  const companies = useMemo(
    () =>
      context?.members && located.some((photo) => photo.createdBy !== null)
        ? companyEntries(located, context.members)
        : null,
    [context, located],
  );
  const groups = useMemo<GroupResolver>(
    () => ({
      ...(projectSpan && {
        phaseOf: (photo: PlacedPhoto) => phaseOf(photo, projectSpan),
      }),
      ...(companies && { companyOf: companies.keyOf }),
    }),
    [projectSpan, companies],
  );
  const dimensions = useMemo(
    () =>
      GROUP_DIMENSIONS.filter(
        (dimension) =>
          dimension === "origin" ||
          (dimension === "phase" && projectSpan !== null) ||
          (dimension === "company" && companies !== null),
      ),
    [projectSpan, companies],
  );
  // Measured against every located photo, not the filtered set, so brushing
  // the timeline never flips the map between clustered and not.
  const cluster =
    clusterPref === "auto"
      ? located.length > AUTO_CLUSTER_THRESHOLD
      : clusterPref === "on";

  // A link can name a grouping this project can't answer (or can't yet, while
  // the context loads); origin stands in without rewriting the URL.
  const dimension = dimensions.includes(groupBy) ? groupBy : "origin";

  // Facet counts exclude their own facet, so a control always shows what
  // picking a different value in it would give you.
  const locatedCounts = useMemo(() => {
    const counts = {} as Record<PhotoCategory, number>;
    for (const category of PHOTO_CATEGORIES) counts[category] = 0;
    for (const photo of located) {
      if (matchesFilters(photo, filters, "categories", groups)) {
        counts[photo.category] += 1;
      }
    }
    return counts;
  }, [located, filters, groups]);

  const mediaTypeCounts = useMemo(() => {
    const counts = {} as Record<PhotoMediaType, number>;
    for (const type of PHOTO_MEDIA_TYPES) counts[type] = 0;
    for (const photo of located) {
      if (matchesFilters(photo, filters, "mediaTypes", groups)) {
        counts[photo.mediaType] += 1;
      }
    }
    return counts;
  }, [located, filters, groups]);

  const legendEntries = useMemo<LegendEntry[]>(() => {
    if (dimension === "phase" && groups.phaseOf) {
      const counts = new globalThis.Map<PhotoPhase, number>();
      for (const photo of located) {
        if (!matchesFilters(photo, filters, "phases", groups)) continue;
        const phase = groups.phaseOf(photo);
        counts.set(phase, (counts.get(phase) ?? 0) + 1);
      }
      return PHOTO_PHASES.map((phase) => ({
        key: phase,
        label: PHASE_META[phase].label,
        color: themedCssColor(PHASE_META[phase].color),
        count: counts.get(phase) ?? 0,
        active: filters.phases.has(phase),
      }));
    }
    if (dimension === "company" && companies && groups.companyOf) {
      const counts = new globalThis.Map<string, number>();
      for (const photo of located) {
        if (!matchesFilters(photo, filters, "companies", groups)) continue;
        const key = groups.companyOf(photo);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return companies.entries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        color: themedCssColor(entry.color),
        count: counts.get(entry.key) ?? 0,
        active: !filters.hiddenCompanies.has(entry.key),
      }));
    }
    return PHOTO_CATEGORIES.map((category) => ({
      key: category,
      label: CATEGORY_META[category].label,
      color: categoryCssColor(category),
      count: locatedCounts[category],
      active: filters.categories.has(category),
    }));
  }, [dimension, groups, companies, located, filters, locatedCounts]);

  const hiddenOrigins = PHOTO_CATEGORIES.filter(
    (category) => locatedCounts[category] > 0 && !filters.categories.has(category),
  ).length;

  // Filters set in a legend you've stepped away from still hide pins; say so
  // under the one on screen, so a thinner map never goes unexplained.
  const hiddenElsewhere = useMemo(() => {
    const notes: string[] = [];
    const plural = (n: number, word: string) =>
      n === 1 ? `1 ${word}` : `${n} ${word === "company" ? "companies" : `${word}s`}`;
    if (dimension !== "origin" && hiddenOrigins > 0) {
      notes.push(plural(hiddenOrigins, "origin"));
    }
    if (dimension !== "phase" && groups.phaseOf) {
      const hidden = PHOTO_PHASES.filter((phase) => !filters.phases.has(phase));
      if (hidden.length > 0) notes.push(plural(hidden.length, "phase"));
    }
    if (dimension !== "company" && companies) {
      const hidden = companies.entries.filter((entry) =>
        filters.hiddenCompanies.has(entry.key),
      );
      if (hidden.length > 0) notes.push(plural(hidden.length, "company"));
    }
    return notes.length > 0 ? `${notes.join(", ")} filtered out` : undefined;
  }, [dimension, hiddenOrigins, groups, companies, filters]);

  const timelinePhotos = useMemo(
    () =>
      located.filter((photo) => matchesFilters(photo, filters, "date", groups)),
    [located, filters, groups],
  );

  const visible = useMemo(
    () =>
      located.filter((photo) =>
        matchesFilters(photo, filters, undefined, groups),
      ),
    [located, filters, groups],
  );
  const collection = useMemo(
    () => toPhotoFeatureCollection(visible, groups),
    [visible, groups],
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
  const stateRef = useRef({
    selectedId,
    filters,
    mode,
    buildings3d,
    groupBy,
    clusterPref,
  });
  useEffect(() => {
    stateRef.current = {
      selectedId,
      filters,
      mode,
      buildings3d,
      groupBy,
      clusterPref,
    };
  }, [selectedId, filters, mode, buildings3d, groupBy, clusterPref]);

  const publish = useCallback((viewport: MapViewport | null) => {
    const {
      selectedId: photoId,
      filters: current,
      mode: currentMode,
      buildings3d: current3d,
      groupBy: currentGroupBy,
      clusterPref: currentCluster,
    } = stateRef.current;
    writeUrlState({
      photoId,
      viewport,
      filters: current,
      mode: currentMode,
      buildings3d: current3d,
      groupBy: currentGroupBy,
      cluster: currentCluster,
    });
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

  const updateGroupBy = useCallback(
    (next: GroupDimension) => {
      setGroupBy(next);
      stateRef.current = { ...stateRef.current, groupBy: next };
      publish(null);
    },
    [publish],
  );

  // The toggle always answers with an explicit choice; "auto" is only the
  // starting point, so a viewer who turns clustering off keeps it off on any
  // project they share the link to.
  const updateCluster = useCallback(
    (on: boolean) => {
      const next: ClusterPreference = on ? "on" : "off";
      setClusterPref(next);
      stateRef.current = { ...stateRef.current, clusterPref: next };
      publish(null);
    },
    [publish],
  );

  // Toggling 3D also drives the camera — a flat map shows nothing of an
  // extrusion — but only on the transition. A link that restored a tilted
  // view keeps the tilt it was shared with, because this never runs for it.
  const updateBuildings3d = useCallback(
    (next: boolean) => {
      setBuildings3d(next);
      stateRef.current = { ...stateRef.current, buildings3d: next };
      publish(null);
      const map = mapRef.current;
      if (!map) return;
      if (!next) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      } else if (map.getPitch() < PITCH_3D / 2) {
        // A view someone already tilted by hand is left alone; anything
        // flatter than half the target reads as flat and gets the full tilt.
        map.easeTo({ pitch: PITCH_3D, duration: 600 });
      }
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

  const toggleGroup = useCallback(
    (key: string) => {
      const current = stateRef.current.filters;
      const flip = <T,>(set: ReadonlySet<T>, value: T) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      };
      if (dimension === "phase") {
        updateFilters({
          ...current,
          phases: flip(current.phases, key as PhotoPhase),
        });
      } else if (dimension === "company") {
        updateFilters({
          ...current,
          hiddenCompanies: flip(current.hiddenCompanies, key),
        });
      } else {
        updateFilters({
          ...current,
          categories: flip(current.categories, key as PhotoCategory),
        });
      }
    },
    [dimension, updateFilters],
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
        ref={mapRef}
        className="absolute inset-0"
        center={initialViewport?.center ?? fallbackCenter}
        zoom={initialViewport?.zoom ?? fallbackZoom}
        pitch={initialViewport?.pitch ?? 0}
        bearing={initialViewport?.bearing ?? 0}
        onViewportChange={handleViewportChange}
        attributionControl={{ compact: true }}
      >
        {/* The compass and the rotate/tilt buttons are how rotation gets
            discovered and how a turned view finds north again; on a flat,
            north-up map they would be clutter. */}
        <MapControls
          position="bottom-right"
          showCompass={buildings3d}
          showRotate={buildings3d}
        />
        {/* First in the tree so a fresh style gets it at the bottom; the layer
            anchors itself beneath the rest when it mounts later. */}
        {buildings3d && <BuildingsLayer />}
        {coverage && <CoverageLayer grid={coverage} />}
        <PhotoLayers
          collection={collection}
          mode={mode}
          dimension={dimension}
          companies={companies?.entries ?? null}
          cluster={cluster}
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
          projectSwitcher={projectSwitcher}
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
          buildings3d={buildings3d}
          onBuildings3dChange={updateBuildings3d}
          cluster={cluster}
          clusterIsAuto={clusterPref === "auto"}
          onClusterChange={updateCluster}
        />
      </div>

      <Legend
        mode={mode}
        dimension={dimension}
        dimensions={dimensions}
        onDimensionChange={updateGroupBy}
        entries={legendEntries}
        onToggle={toggleGroup}
        groupCaption={
          [groupCaption(dimension, context), hiddenElsewhere]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        hiddenOrigins={hiddenOrigins}
        coverage={coverage}
        asOf={asOf}
        asOfFromBrush={asOfFromBrush}
        // Clears the timeline, which stacks a zoomed plot, its date axis and
        // the brush strip.
        className="absolute bottom-52 left-3 z-10"
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
