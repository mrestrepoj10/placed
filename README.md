# placed

**Photos, placed.** Connect a construction project → see where every field photo happened.

Placed is a lightweight, open-source spatial viewer for geolocated field photos. It reads photo metadata from Autodesk Construction Cloud (Autodesk Build Photos), drops every geotagged photo onto an interactive map — clustered, streamed in progressively, colored by the module it came from (Issues, RFIs, Forms, field reports…) — and deep-links back to ACC. ACC stays the system of record: **no images are duplicated, nothing is stored.**

- **Try it with zero setup:** the `/demo` route runs on a synthetic project — no Autodesk account needed.
- **Zero API keys to fork:** basemaps come from [OpenFreeMap](https://openfreemap.org) (no key, no usage cap, commercial-OK).

## How it works

- **Next.js 16** (Cache Components + Partial Prefetching): static shells, dynamic content streamed behind Suspense.
- **Auth is [aec-auth](https://www.npmjs.com/package/aec-auth) over [Vercel Connect](https://vercel.com/docs/connect)** (beta): a Custom OAuth connector runs Autodesk's 3-legged flow, storing and rotating the refresh tokens on Vercel's side, while aec-auth's `TokenSource` adds an in-process, expiry-aware token cache with single-flight de-duplication (Connect bills per token request). This app's only session state is an httpOnly cookie with a random visitor id — it never sees a refresh token. The data layer depends on a small `getAccessToken(visitorId)` seam (`lib/auth/access-token.ts`); a non-Vercel deployment swaps in another aec-auth backend (self-hosted vault, Better Auth) by changing one line.
- **Photo metadata** streams through a route handler proxying ACC's cursor pagination (max 50/page, serial); the map densifies as pages arrive. APS tokens never reach the browser.
- **Thumbnails**: ACC's signed URLs expire in ~60 seconds, so `<img>` tags point at a proxy route that fetches a fresh signed URL and 302-redirects. No client-side expiry bookkeeping, no caching of signed URLs.
- **UI for the ACC surface comes from [cantera](https://github.com/mrestrepoj10/cantera)**, a shadcn registry for construction UI: the sign-in card, the project picker in the map's stats bar and on `/projects`, and the connection card with disconnect. Installed as source with `npx shadcn@latest add @cantera/...` and owned here; the copies in `components/ui/` are adapted from cantera's Base UI idiom (`render`, `focusableWhenDisabled`) to this project's Radix primitives (`asChild`, `aria-disabled`).
- **Map**: [MapLibre GL](https://maplibre.org) via a locally-owned [mapcn](https://mapcn.dev) component (worker self-hosted, category-colored cluster layer). Photos render as canvas layers, not DOM markers.
- **No database.** Photo visibility is per-user (3-legged only — the Photos API has no service mode), there are no ACC photo webhooks, and signed URLs can't be cached — so a mirror would be pure cost. Every session reads live.

Key decisions and the research behind them: see [DESIGN.md](./DESIGN.md).

## Deploy your own

You need an Autodesk Platform Services app and a Vercel project.

1. **Create an APS app** at [aps.autodesk.com](https://aps.autodesk.com) → *Applications*. Enable the **Autodesk Construction Cloud API** category. You'll set its Callback URL in step 3.
   - **Then provision it into the account you want to read**: an Account Admin adds the app's Client ID under **Account Admin → Apps / Custom Integrations** (ACC) or **Settings → Custom Integrations** (BIM 360). Without this, the hub silently doesn't appear in the project list — no error, just an empty page.
2. **Deploy this repo to Vercel** (fork → import).
3. **Create the Connect connector**: in the Vercel project, open **Connect** → *Create Connector* → **OAuth** → server URL `developer.api.autodesk.com` (endpoint discovery fills in the rest) → paste your APS client ID + secret → name it `autodesk`. Enable the **authorization-code** grant (connector → Edit → grant types). ⚠️ Copy the **redirect URI shown during creation** into your APS app's Callback URL — this URL only appears in that flow.
4. That's it — no other env vars. (Optionally set `CONNECT_CONNECTOR` if you named the connector something other than `autodesk` — custom OAuth connector UIDs are `<oauth-server-host>/<name>`, so the default resolves to `developer.api.autodesk.com/autodesk`.)

### Local development

```bash
pnpm install
vercel link && vercel env pull   # gets the dev-environment OIDC token
pnpm dev
```

Works with plain `next dev`; re-run `vercel env pull` if the OIDC token expires (~12h).

### Notes & limitations

- Vercel Connect is in beta; the free tier includes 5,000 token requests/month.
- Photos only appear on the map if their EXIF data carries coordinates (mobile captures with location services on). Placed always shows the honest count — "N of M photos have location" — and lists the rest.
- The Photos API is read-only and 3-legged only: every viewer signs in with their own Autodesk account and sees exactly what their account can see.

## License

[MIT](./LICENSE)
