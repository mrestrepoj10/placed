import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copied MapLibre worker bundles, not our code:
    "public/*.mjs",
  ]),
  {
    // Vendored from the mapcn registry; predates react-hooks v6 strict rules.
    // Relax only the new rules here — our forks still follow them elsewhere.
    files: ["components/ui/map.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Vendored from the evilcharts registry for the timeline — same deal as the
    // mapcn map: upstream source, so the rules it predates are off here and
    // nowhere else. Carries one local patch, marked PATCHED in echarts-brush.
    files: ["components/evilcharts/**"],
    // Upstream carries its own disable comments for rules we switch off below.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
