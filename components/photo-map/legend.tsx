"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import { PHOTO_CATEGORIES, type PhotoCategory } from "@/lib/photos/types";

interface LegendProps {
  /** Located-photo count per category; categories at zero are hidden */
  counts: Record<PhotoCategory, number>;
  active: ReadonlySet<PhotoCategory>;
  onToggle: (category: PhotoCategory) => void;
}

export function Legend({ counts, active, onToggle }: LegendProps) {
  const visible = PHOTO_CATEGORIES.filter((category) => counts[category] > 0);
  if (visible.length === 0) return null;

  return (
    <div className="absolute bottom-10 left-3 z-10 w-44 rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm">
      <p className="px-3 pt-2.5 pb-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Photo origin
      </p>
      <ul className="pb-1.5">
        {visible.map((category) => (
          <li key={category}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-accent/50">
              <Checkbox
                checked={active.has(category)}
                onCheckedChange={() => onToggle(category)}
                className="size-3.5"
              />
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
                style={{ backgroundColor: categoryCssColor(category) }}
              />
              <span className="flex-1 truncate">
                {CATEGORY_META[category].label}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {counts[category]}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
