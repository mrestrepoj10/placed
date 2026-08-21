// Generates the demo-mode thumbnail placeholders (one SVG per photo category)
// into public/demo/thumbs/. Colors mirror CATEGORY_META in
// lib/photos/categories.ts — keep the two in sync.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CATEGORIES = {
  "field-report": { label: "Field report", color: "#2a78d6" },
  issue: { label: "Issue", color: "#e34948" },
  form: { label: "Form", color: "#4a3aa7" },
  rfi: { label: "RFI", color: "#eb6834" },
  gallery: { label: "Gallery", color: "#1baf7a" },
  asset: { label: "Asset", color: "#008300" },
  meeting: { label: "Meeting", color: "#e87ba4" },
  submittal: { label: "Submittal", color: "#eda100" },
  other: { label: "Other", color: "#898781" },
};

const CAMERA_PATH =
  "M-14 -7 h7 l3 -4 h8 l3 4 h7 a3 3 0 0 1 3 3 v14 a3 3 0 0 1 -3 3 h-28 a3 3 0 0 1 -3 -3 v-14 a3 3 0 0 1 3 -3 z M0 10 a7 7 0 1 0 0 -14 a7 7 0 0 0 0 14 z";

function svg(label, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.62"/>
    </linearGradient>
    <pattern id="t" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="28" height="28" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="28" stroke="#ffffff" stroke-opacity="0.06" stroke-width="10"/>
    </pattern>
  </defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <rect width="640" height="480" fill="url(#t)"/>
  <g transform="translate(320 218) scale(3.2)" fill="#ffffff" fill-opacity="0.55" fill-rule="evenodd">
    <path d="${CAMERA_PATH}"/>
  </g>
  <text x="32" y="436" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="26" font-weight="600" fill="#ffffff" fill-opacity="0.85">${label}</text>
  <text x="608" y="436" text-anchor="end" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" fill="#ffffff" fill-opacity="0.6">demo</text>
</svg>
`;
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "demo",
  "thumbs",
);
mkdirSync(outDir, { recursive: true });
for (const [slug, { label, color }] of Object.entries(CATEGORIES)) {
  writeFileSync(join(outDir, `${slug}.svg`), svg(label, color));
}
console.log(`Wrote ${Object.keys(CATEGORIES).length} thumbs to ${outDir}`);
