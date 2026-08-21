import type { ExpressionSpecification } from "maplibre-gl";
import type { PhotoCategory } from "./types";

/**
 * The single category → presentation map shared by the map layers, the legend,
 * and the inspect panel, so colors and labels can never drift apart.
 *
 * Colors are the eight slots of a CVD-validated categorical palette (worst
 * adjacent-pair CVD ΔE 9.1 light / 8.4 dark, normal-vision ≥ 19), stepped
 * separately for light and dark basemaps. Three light-mode hues sit below 3:1
 * contrast on the light basemap; the pins' white stroke and the always-visible
 * legend are the required relief.
 */
export const CATEGORY_META: Record<
  PhotoCategory,
  { label: string; color: { light: string; dark: string } }
> = {
  "field-report": {
    label: "Field report",
    color: { light: "#2a78d6", dark: "#3987e5" },
  },
  issue: { label: "Issue", color: { light: "#e34948", dark: "#e66767" } },
  form: { label: "Form", color: { light: "#4a3aa7", dark: "#9085e9" } },
  rfi: { label: "RFI", color: { light: "#eb6834", dark: "#d95926" } },
  gallery: { label: "Gallery", color: { light: "#1baf7a", dark: "#199e70" } },
  asset: { label: "Asset", color: { light: "#008300", dark: "#008300" } },
  meeting: { label: "Meeting", color: { light: "#e87ba4", dark: "#d55181" } },
  submittal: {
    label: "Submittal",
    color: { light: "#eda100", dark: "#c98500" },
  },
  other: { label: "Other", color: { light: "#898781", dark: "#898781" } },
};

/**
 * MapLibre expression coloring each point by its `category` feature property.
 */
export function categoryColorExpression(
  theme: "light" | "dark",
): ExpressionSpecification {
  // ["match", input, case1, out1, ..., fallback]
  const expression: unknown[] = ["match", ["get", "category"]];
  for (const [category, meta] of Object.entries(CATEGORY_META)) {
    if (category === "other") continue;
    expression.push(category, meta.color[theme]);
  }
  expression.push(CATEGORY_META.other.color[theme]);
  return expression as unknown as ExpressionSpecification;
}
