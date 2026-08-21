import type { Metadata } from "next";

import { PhotoMap } from "@/components/photo-map/photo-map";
import { DEMO_PHOTOS, DEMO_PROJECT } from "@/lib/demo/photos";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Explore Placed with a synthetic construction project — no account needed.",
};

/**
 * Zero-auth demo: the synthetic dataset is statically imported, so this page
 * fully prerenders and serves from the CDN.
 */
export default function DemoPage() {
  return (
    <PhotoMap
      photos={DEMO_PHOTOS}
      projectName={DEMO_PROJECT.name}
      fallbackCenter={[-97.7466, 30.2589]}
      fallbackZoom={14}
    />
  );
}
