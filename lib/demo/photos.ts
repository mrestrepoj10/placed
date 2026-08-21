import type {
  PhotoCategory,
  PhotoMediaType,
  PlacedPhoto,
} from "@/lib/photos/types";

/**
 * Synthetic field photos for the zero-auth demo. Deterministic (seeded PRNG),
 * so the demo page prerenders to stable output. The layout mimics a real
 * project: a tight building-pad cluster, a linear utility corridor, a laydown
 * yard, scattered singles — and a bucket of photos with no geolocation, which
 * real projects always have (desktop uploads carry no EXIF coordinates).
 */

export const DEMO_PROJECT = {
  id: "demo",
  name: "Southline Civic Center",
  description:
    "Synthetic demo project — a downtown building package plus a utility corridor.",
} as const;

// South shore of Lady Bird Lake, Austin, TX
const SITE = { lat: 30.2589, lng: -97.7466 };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x9e37);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function weightedCategory(): PhotoCategory {
  const r = rand();
  if (r < 0.38) return "field-report";
  if (r < 0.58) return "gallery";
  if (r < 0.72) return "issue";
  if (r < 0.82) return "form";
  if (r < 0.88) return "rfi";
  if (r < 0.92) return "asset";
  if (r < 0.95) return "meeting";
  if (r < 0.98) return "submittal";
  return "other";
}

const TITLES: Record<PhotoCategory, readonly string[]> = {
  "field-report": [
    "Slab pour — grid C4",
    "Formwork stripped, level 2 deck",
    "Backfill at north retaining wall",
    "MEP rough-in progress, level 3",
    "Steel erection — bay 12",
    "Curtain wall panel staging",
    "Site drainage swale grading",
  ],
  issue: [
    "Rebar spacing out of tolerance",
    "Standing water at excavation",
    "Damaged conduit run — east riser",
    "Missing guardrail at slab edge",
    "Honeycombing in column pour",
  ],
  form: [
    "Daily pre-task safety plan",
    "Concrete pour checklist",
    "Hot work permit — welding",
    "Equipment inspection log",
  ],
  rfi: [
    "Clarify embed plate location",
    "Conflict: duct vs. beam at C7",
    "Finish grade at plaza steps",
  ],
  gallery: [
    "Morning site walk",
    "Progress photo — southeast corner",
    "Aerial reference shot",
    "Crane pick, HVAC units",
  ],
  asset: [
    "AHU-2 nameplate",
    "Switchgear serial tag",
    "Fire pump installation",
  ],
  meeting: ["OAC walk — week 14", "Punch walk, level 1"],
  submittal: ["Storefront mockup review", "Paving joint layout sample"],
  other: ["Reference photo", "Untitled"],
};

// Capture-time window: 90 days of workdays ending 2026-08-14, 07:00–17:00 local
const WINDOW_END = Date.UTC(2026, 7, 14, 22, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function randomTakenAt(): number {
  const daysAgo = Math.floor(rand() * 90);
  const withinDay = (7 + rand() * 10) * 60 * 60 * 1000;
  const day = WINDOW_END - daysAgo * DAY;
  return day - (day % DAY) + withinDay;
}

/** Meters → degrees, approximately, at the site's latitude */
function offset(lat: number, lng: number, eastM: number, northM: number) {
  return {
    lat: lat + northM / 111_320,
    lng: lng + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

function gauss(scaleM: number): number {
  // Sum of uniforms ≈ normal; good enough for scatter
  return (rand() + rand() + rand() - 1.5) * scaleM;
}

interface Spot {
  lat: number | null;
  lng: number | null;
}

function buildSpots(): Spot[] {
  const spots: Spot[] = [];

  // Building pad: tight cluster, ~50 photos within ~120m
  const pad = offset(SITE.lat, SITE.lng, -80, 40);
  for (let i = 0; i < 50; i++) {
    const p = offset(pad.lat, pad.lng, gauss(80), gauss(60));
    spots.push(p);
  }

  // Utility corridor: ~34 photos along ~1.3km heading east, slight jitter
  const corridorStart = offset(SITE.lat, SITE.lng, 120, -140);
  for (let i = 0; i < 34; i++) {
    const along = (i / 33) * 1300;
    const p = offset(
      corridorStart.lat,
      corridorStart.lng,
      along + gauss(25),
      -along * 0.12 + gauss(25),
    );
    spots.push(p);
  }

  // Laydown yard: loose cluster of 14
  const yard = offset(SITE.lat, SITE.lng, 420, 260);
  for (let i = 0; i < 14; i++) {
    spots.push(offset(yard.lat, yard.lng, gauss(120), gauss(90)));
  }

  // Scattered singles around the wider site
  for (let i = 0; i < 8; i++) {
    spots.push(offset(SITE.lat, SITE.lng, gauss(900), gauss(700)));
  }

  // No-location bucket: desktop uploads, EXIF-stripped images
  for (let i = 0; i < 14; i++) {
    spots.push({ lat: null, lng: null });
  }

  return spots;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function buildPhotos(): PlacedPhoto[] {
  const photos = buildSpots().map((spot, i): PlacedPhoto => {
    const category = weightedCategory();
    const takenAt = randomTakenAt();
    const mediaType: PhotoMediaType = rand() < 0.04 ? "video" : "photo";
    return {
      id: `demo-${String(i + 1).padStart(3, "0")}`,
      title: pick(TITLES[category]),
      category,
      mediaType,
      takenAt: new Date(takenAt).toISOString(),
      createdAt: new Date(takenAt + 40 * 60 * 1000).toISOString(),
      latitude: spot.lat === null ? null : round6(spot.lat),
      longitude: spot.lng === null ? null : round6(spot.lng),
      thumbnailUrl: `/demo/thumbs/${category}.svg`,
      sourceUrl: null,
    };
  });
  // Newest first, matching the ACC default sort
  return photos.sort((a, b) => (a.takenAt! < b.takenAt! ? 1 : -1));
}

export const DEMO_PHOTOS: PlacedPhoto[] = buildPhotos();
