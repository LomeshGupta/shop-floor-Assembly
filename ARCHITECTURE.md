# Architecture

## Principle

Business Central is the system of record and business engine. This PWA is a
lightweight operator interface over Business Central APIs. There is no
separate business database and no duplicated manufacturing logic.

```
SHOP FLOOR DEVICE
      │
      ▼
  Next.js PWA (React/MUI)
      │
      ▼
  Next.js API Routes  (src/app/api/**)
      │
      ▼
  OAuth 2.0 client-credentials token (lib/business-central/auth.ts)
      │
      ▼
  Business Central APIs
```

React components never call Business Central (or even our own `/api`
routes' business logic) directly with ad-hoc `fetch`. The call chain is
always:

```
React component
      │  apiFetch() → our own /api route
      ▼
Next.js route handler          (src/app/api/business-central/**)
      │  requireOperator() guard, input validation
      ▼
ProductionService              (lib/business-central/service.ts)
      │  picks demo or live adapter based on BC_MODE
      ▼
demoAdapter  |  businessCentralAdapter
      │
      ▼  (live only)
businessCentralRequest()       (lib/business-central/client.ts)
      │  attaches OAuth token, handles HTTP errors
      ▼
Business Central
```

## Two identity systems — do not confuse them

1. **Business Central application credential** (`BC_CLIENT_ID` /
   `BC_CLIENT_SECRET`) — a server-only, client-credentials OAuth token
   shared by the whole app to call BC APIs. Cached in
   `lib/business-central/auth.ts`. Never tied to an individual operator,
   never revoked on operator logout.
2. **Operator session** (`lib/session/session.ts`) — a signed, HTTP-only
   cookie identifying which human is using the device right now. Created on
   login, cleared on logout. Holds no secret — just operator id/username/
   display name.

## API abstraction (`BC_MODE`)

`lib/business-central/adapters/types.ts` defines `ProductionService`, the
single interface both the demo adapter and the real Business Central
adapter implement. `lib/business-central/service.ts::getProductionService()`
is the **only** place in the codebase that branches on `BC_MODE`. UI
components and API routes call `getProductionService()` and never contain
`if (BC_MODE === "demo")` themselves.

## Folder structure

```
src/
  app/
    login/                    Screen 1
    home/                     Screen 2
    scan/                     Screen 3
    jobs/
      enter/                  manual PO entry
      [id]/                   Screen 4 — Job Overview
    active-job/[id]/          Screen 5 — the primary control surface
    report-output/[id]/
    report-scrap/[id]/
    consume-material/[id]/
    api/
      auth/{login,logout,session}/
      business-central/
        production-orders/[id]/
        start/[id]/
        output/[id]/
        scrap/[id]/
        scrap-reasons/
        consumption/[id]/
        finish/[id]/
  components/
    layout/    ScreenShell, ServiceWorkerRegistrar
    ui/        BigButton, Counter, NumericField, StatusBanner
    scanner/   QrScanner (jsQR over getUserMedia)
  lib/
    business-central/
      types.ts       domain types (ProductionOrder, transactions, ApiError…)
      config.ts       env parsing for demo/sandbox/production
      auth.ts         OAuth 2.0 client-credentials token service
      client.ts       businessCentralRequest() — the shared HTTP client
      errors.ts       HTTP status → operator-friendly ApiError mapping
      service.ts       getProductionService() — demo/live switch
      adapters/
        types.ts               ProductionService interface
        demo.ts                 in-memory demo implementation
        business-central.ts     real BC implementation
    demo/data.ts       demo manufacturing data
    session/session.ts operator login session (signed cookie)
    api-client.ts       browser-side fetch wrapper for our own /api routes
    api-helpers.ts       requireOperator() guard, error→status mapping
    active-job.ts         "which order is active on this device" convenience
  theme/                MUI theme + ThemeRegistry
  hooks/useOperator.ts
  middleware.ts          redirects unauthenticated devices to /login
```

## Environment modes

`BC_MODE` = `demo` | `sandbox` | `production`, read once in
`lib/business-central/config.ts` and cached. Demo mode requires no BC
tenant at all. Sandbox/production require the full OAuth + company
configuration documented in `.env.example`.

## Error handling

Every adapter method returns `ApiResult<T> = { ok: true; data } | { ok:
false; error: ApiError }` — never throws for expected failure modes
(validation, not found, not released, etc.). `ApiError.message` is always
operator-safe to render; `ApiError.detail` is for logs only.

## Security

- BC client secret and OAuth token never leave the server.
- Operator passwords are never stored by this app — see
  `BUSINESS-CENTRAL-INTEGRATION.md` for how validation is expected to work.
- Session cookie is HTTP-only, `SameSite=Lax`, signed with `SESSION_SECRET`.
- Structured logs (`console.log` JSON lines) never include passwords,
  secrets, or raw tokens — see `logBcCall` in `client.ts` and the login
  route for what is/isn't logged.

## PWA

`public/manifest.json` + `public/sw.js` make the app installable and cache
the static app shell only. Per spec §27, this first version intentionally
does **not** attempt offline production posting — Business Central stays
the single source of truth, and posting while offline risks duplicate or
lost transactions without a properly designed idempotency scheme.
