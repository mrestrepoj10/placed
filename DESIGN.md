# Placed — Design Document

> **Photos, placed.** Connect a construction project → see where every field photo happened.

Placed is a lightweight spatial viewer for geolocated field photos. First connector: Autodesk Construction Cloud (Autodesk Build Photos). ACC remains the system of record; Placed is the visualization layer — metadata only, no image duplication.

This document records the decisions from the design session (2026-08-21) and the research that drove them. Grill it before changing it.

---

## 1. Product

### Audience (all three, in this order of build priority)

1. **Developers in AEC tech** — the repo is a reference implementation to fork and adapt.
2. **End users** — a hosted app where anyone with an Autodesk account sees their project photos on a map.
3. **Portfolio piece** — polish and narrative matter; the repo, live demo, and announcement land together.

### v0.1 scope fence

**In:**
- Landing page (slim): hero, live-map teaser, **Try the demo** / **Connect Autodesk**, GitHub link.
- 3-legged Autodesk sign-in → hub/project picker.
- Map view: clustered photo pins, progressive streaming as pages load, click-to-inspect panel (thumbnail, metadata, deep link back to ACC Build).
- **Origin-module facet**: pins color-coded by photo `type` (Issue / RFI / Form / Field Report / Gallery…), with legend + toggle filters. `MARKUP`/`LOGO` hidden by default.
- **Honesty bar**: "N of M photos have location", with the no-location bucket visible as a simple count/list.
- **Demo mode**: zero-auth `/demo` route with ~100 synthetic geolocated photos on a plausible site. First-class feature — most visitors have no ACC project with geotagged photos.
- Shareable URLs (selected photo + coarse viewport in searchParams) — near-free side effect of the state model.

**Out (v0.2+ candidates):** date-range filter / time slider, multi-project view, satellite layer, photo-thumbnail markers, cone-of-view from EXIF, any persistence/sync layer, analytics, GIS features. v0.1 is not a GIS platform.

### Positioning

Esri GeoBIM does metadata-only georeferencing of ACC photos exactly like this thesis — commercially, inside ArcGIS Enterprise. Placed is "GeoBIM's photo layer without the ArcGIS license," plus the origin-module facet GeoBIM doesn't emphasize. (Inspiration: Edmundo Herrera's ACC Build → ArcGIS Online demo.)

---

## 2. Key research facts (constraints we build against)

### ACC Photos API (`construction/photos/v1`) — confirmed from docs

- Exactly **two read-only endpoints**: `POST …/projects/:projectId/photos:filter` (cursor-paginated search) and `GET …/projects/:projectId/photos/:photoId` (410 Gone = deleted).
- `latitude`/`longitude` are **first-class fields** on every photo object, EXIF-derived — populated only when the capture device geotagged. Desktop uploads/screenshots have none. No accuracy/heading/altitude.
- **No `has-location` filter, no `updatedAt` filter, no webhooks.** Filter supports `createdAt`/`takenAt` ranges, `mediaType`, `createdBy`, `id`, `title`. `type` is returned but **not filterable** — client-side facet.
- Pagination: opaque `cursorState`, `limit` max **50**, serial (no parallel pages). 10k photos ≈ 200 round-trips.
- **3-legged OAuth only** (scope `data:read`); no 2-legged/service mode, no `x-user-id` header. Permission scoping is therefore per-user, for free.
- Media: `signedUrls.fileUrl`/`thumbnailUrl` (S3 presigned, hot-linkable, **~60s expiry** in doc examples — fetch just-in-time, never cache) via `include: ["signedUrls"]`; only thumbnail + original sizes exist.
- Photos attached to Issues/RFIs/Forms/etc. all appear in the one gallery with `type` naming the origin module. No link back to the specific issue ID in this payload (Relationships API / Data Connector have it — v0.2+).
- Project IDs: Data Management returns `b.{uuid}`; **Photos API takes the bare UUID — strip the `b.`**. Enumerate via DM `GET /project/v1/hubs` → `/hubs/:id/projects` with the same 3LO token.
- APS tokens: access 60 min; refresh tokens **single-use rotating**, 15-day life.
- Deep-link format into ACC Build photos is **undocumented** — verify empirically during build.

### Vercel Connect — confirmed from docs + SDK + live OIDC endpoint

- **Custom OAuth connector** supports any OAuth/OIDC provider; APS publishes OIDC discovery at `developer.api.autodesk.com/.well-known/openid-configuration` (live-verified), so endpoint config auto-fills.
- **Per-end-user auth is the core use case**: `getToken(connector, { subject: { type: 'user', id } })`; on `UserAuthorizationRequiredError` → `startAuthorization(...)` → redirect; Vercel hosts the handshake, stores refresh tokens, auto-refreshes. **Our code never sees a refresh token** — which also eliminates the rotation-race failure mode of hand-rolled serverless APS auth.
- App still needs a **signed httpOnly cookie carrying a random visitor ID** (the `subject.id`), because subject IDs are asserted by our code. That cookie is the entire session system.
- Local dev: `vercel link && vercel env pull` → works with plain `next dev`.
- Trade-offs (documented, accepted): Connect is **beta**; Vercel-only; 5k free token requests/month then $3/10k; the redirect URI to whitelist in the APS app surfaces only during connector creation (README callout required).

### mapcn — confirmed from repo clone

- Shadcn-style registry: `npx shadcn@latest add @mapcn/map` installs one ~2,200-line `components/ui/map.tsx` we own outright. Built on **maplibre-gl v6** directly. Next 16 / React 19 / Tailwind v4, active, 11.6k stars.
- Ships: `Map` (theme-aware, shadcn tokens, controlled viewport), `MapClusterLayer` (MapLibre-native clustering, canvas), `MapPopup`/`MapMarker`, `MapControls`, `MapGeoJSON`. Progressive streaming = update the FeatureCollection prop; it calls `setData`.
- **Forks required** (in our owned file): per-category point/cluster colors (upstream supports one color), category filter, legend, inspect panel. DOM markers don't scale past ~300 — pins stay canvas layers.
- **Landmines**: default Carto basemaps **prohibit commercial use** (do not ship); MapLibre worker loads from unpkg CDN at runtime (**self-host it**).

### Next.js (16.3.2 current)

See §3. Key external validation: the Next 16.3 "app-like experiences" guidance explicitly blesses server-preloaded, client-continued fetching for data that changes while a view is open — placed's exact shape.

### npm

`placed` is unclaimed. **Decision: defer** — v0.1 ships no package; revisit if libraries get extracted.

---

## 3. Architecture

### Stack

Next.js **16.3.2** (Cache Components + Partial Prefetching enabled), TypeScript, Tailwind v4, shadcn/ui, mapcn (owned copy), maplibre-gl v6, TanStack Query, `@vercel/connect`. Deployed on Vercel. **No database. No persistence beyond the visitor cookie.**

### Auth (Connect-native)

- One Custom OAuth connector (`oauth/autodesk`) holding the deployer's APS app credentials; authorization-code grant enabled.
- Signed httpOnly cookie → random visitor ID → `getToken('oauth/autodesk', { subject: { type: 'user', id }, scopes: ['data:read'] })` in server code only (`import 'server-only'`).
- First use: catch `UserAuthorizationRequiredError` → `startAuthorization` → `redirect(url)`. Disconnect button → `revokeToken`.
- **Seam**: the ACC data layer depends on a `getAccessToken(visitorId)` interface so a non-Vercel deployer could swap in a hand-rolled provider. Build the seam, not the fallback.
- `proxy.ts` (not middleware.ts) stays a thin cookie-presence gate. No token exchange in proxy, no token in props/context/`NEXT_PUBLIC`, no direct browser→ACC calls. Ever.

### Routes & RSC/client boundary

```
/                 landing (static shell, slim)
/demo             fully static — synthetic JSON statically imported, CDN-served, no auth path
/projects         RSC hub/project list ('use cache: private', short cacheLife), <Link prefetch>
/p/[projectId]    map view — prerendered shell; client-heavy from the map canvas down
/api/projects/[projectId]/photos?cursor=   route handler: token server-side → ACC photos:filter → sanitized metadata JSON
/api/photos/[photoId]/thumbnail            route handler: fresh signed URL → 302 redirect (Cache-Control: private, max-age=30)
```

- **Server**: Connect token retrieval, project enumeration, page shells, metadata sanitization.
- **Client**: persistent `MapProvider` in the layout (next-beats pattern); MapLibre via `next/dynamic` `ssr: false`; clustering client-side.
- **Photo crawl**: TanStack Query `useInfiniteQuery` auto-advancing the serial cursor through the route handler; pins densify progressively with a "1,240 / ~3,000" progress affordance; abort on project switch. **Not** a streaming RSC (function-duration cost, no incremental client data, no abort) and **not** Server Actions (POST-only, serialized per client).
- **Thumbnails**: `<img src="/api/photos/{id}/thumbnail">` — the 302 proxy owns the 60s-TTL problem; the client does zero expiry bookkeeping. Never wrap in `'use cache'`; skip the `next/image` optimizer for these.
- **URL state, three tiers**: path = `projectId`; shallow searchParams via `history.replaceState` = selected photo + coarse viewport (shareable URLs for free; never `router.push` on pan/zoom); pure client state = hover, expansion, fetch progress. Server tree never reads searchParams on the map page.

### Map

- Default basemap: **OpenFreeMap** light/dark styles — zero API key, no usage cap, commercial-OK. A fork runs with **no keys at all**.
- No satellite layer in v0.1 (needs either gray-terms Esri raster or a MapTiler key; deferred).
- `MapClusterLayer` forked for `match`-expression category colors keyed off one shared `type → color` map (used by legend + layers). Category filter = filter the FeatureCollection in React (re-clusters correctly).
- Self-hosted MapLibre worker; Carto defaults removed.

## 4. Repo & release

- **`mrestrepoj10/placed`, public from the first commit** (building in public). MIT license.
- Hosted at the stock Vercel domain for now; custom domain deferred.
- README documents the two-step deployer setup: (1) create an APS app (callback = the Connect redirect URI shown during connector creation — explicit callout), (2) create/attach the Custom OAuth connector; `vercel link && vercel env pull` for local dev.
- Documented honestly in README: Connect beta status, pricing tier, Vercel-only coupling + the `getAccessToken` seam.

## 5. Risks (accepted, with mitigations)

| Risk | Mitigation |
| --- | --- |
| Real project has few/no geotagged photos → empty map | Honesty bar ("N of M have location"); demo mode as the primary funnel |
| Signed URLs expire in ~60s | 302 thumbnail proxy; just-in-time fetch; never cached |
| Large projects: serial 50/page crawl is slow | Progressive pin streaming with progress; date-window fetch is the designated v0.2 relief valve |
| Photos API is frozen (two endpoints, read-only since 2021) | Don't bet on `type` filters/webhooks arriving; client-side faceting |
| Vercel Connect is beta | Version-pin `@vercel/connect`; auth seam isolates the dependency |
| ACC deep-link format undocumented | Verify empirically; degrade to project-level link if unstable |

## 6. Deferred (v0.2+ shortlist)

Satellite layer (MapTiler key or licensed source) · date-range/time slider · multi-project · photo-thumbnail markers (symbol layers + `addImage`) · issue/RFI back-links via Relationships API · EXIF heading (cone of view) · date-window default fetch for huge projects · extracted ACC photos client package.
