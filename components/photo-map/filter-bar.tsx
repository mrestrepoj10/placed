"use client";

import {
  Box,
  Camera,
  Clock,
  Globe,
  Grid3x3,
  Search,
  Shapes,
  Thermometer,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAP_MODES, MAP_MODE_META, type MapMode } from "@/lib/photos/map-modes";
import { PHOTO_MEDIA_TYPES, type PhotoMediaType } from "@/lib/photos/types";

const MEDIA_TYPE_META: Record<
  PhotoMediaType,
  { label: string; icon: LucideIcon }
> = {
  photo: { label: "Photos", icon: Camera },
  video: { label: "Videos", icon: Video },
  photosphere: { label: "360° photospheres", icon: Globe },
  infrared: { label: "Infrared", icon: Thermometer },
};

const MODE_ICONS: Record<MapMode, LucideIcon> = {
  categories: Shapes,
  activity: Clock,
  coverage: Grid3x3,
};

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  mediaTypes: ReadonlySet<PhotoMediaType>;
  onMediaTypesChange: (next: ReadonlySet<PhotoMediaType>) => void;
  /** Located-photo count per media type; types at zero are hidden */
  mediaTypeCounts: Record<PhotoMediaType, number>;
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  buildings3d: boolean;
  onBuildings3dChange: (on: boolean) => void;
}

/**
 * The facets that don't belong to a spatial control: title search and media
 * type, plus the exclusive map-mode switcher and the 3D toggle — deliberately
 * not a fourth mode, since buildings are a view and compose with every lens.
 * Category lives in the legend, next to the colors it names; the date range
 * lives in the timeline, on the axis it brushes.
 */
export function FilterBar({
  search,
  onSearchChange,
  mediaTypes,
  onMediaTypesChange,
  mediaTypeCounts,
  mode,
  onModeChange,
  buildings3d,
  onBuildings3dChange,
}: FilterBarProps) {
  const searchId = useId();
  const availableMediaTypes = PHOTO_MEDIA_TYPES.filter(
    (type) => mediaTypeCounts[type] > 0,
  );

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border bg-background/90 px-2 py-1.5 shadow-sm backdrop-blur-sm">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label className="sr-only" htmlFor={searchId}>
          Search photo titles
        </label>
        <Input
          id={searchId}
          type="search"
          value={search}
          placeholder="Search titles…"
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-7 w-44 rounded-md pr-7 pl-7 [&::-webkit-search-cancel-button]:hidden"
        />
        {search !== "" && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="absolute top-1/2 right-0.5 -translate-y-1/2 rounded-md"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {availableMediaTypes.length > 1 && (
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Media type"
          value={availableMediaTypes.filter((type) => mediaTypes.has(type))}
          onValueChange={(values: string[]) => {
            // Only the types on screen are being answered for. A type another
            // facet has temporarily zeroed out keeps whatever the viewer last
            // chose, so clearing a search doesn't silently resurrect it
            // deselected. Emptying the group would blank the map with no way
            // back, so that falls through to showing every visible type.
            const chosen = new Set(values as PhotoMediaType[]);
            const next = new Set(mediaTypes);
            for (const type of availableMediaTypes) {
              if (chosen.size === 0 || chosen.has(type)) next.add(type);
              else next.delete(type);
            }
            onMediaTypesChange(next);
          }}
        >
          {availableMediaTypes.map((type) => {
            const { label, icon: Icon } = MEDIA_TYPE_META[type];
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value={type} aria-label={label}>
                    <Icon className="size-3.5" aria-hidden />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  {label} · {mediaTypeCounts[type].toLocaleString("en-US")}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </ToggleGroup>
      )}

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Map mode"
        value={mode}
        onValueChange={(value: string) => {
          if (value) onModeChange(value as MapMode);
        }}
      >
        {MAP_MODES.map((option) => {
          const Icon = MODE_ICONS[option];
          const { label, description } = MAP_MODE_META[option];
          return (
            <Tooltip key={option}>
              <TooltipTrigger asChild>
                <ToggleGroupItem value={option}>
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{description}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>

      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            variant="outline"
            size="sm"
            aria-label="3D buildings"
            pressed={buildings3d}
            onPressedChange={onBuildings3dChange}
          >
            <Box className="size-3.5" aria-hidden />
            3D
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          Basemap buildings in 3D from zoom 14 · rotate and tilt with the map
          buttons, by dragging the compass, or by right-dragging the map
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
