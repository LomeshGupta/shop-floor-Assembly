# Shop Floor

A fast, installable PWA that gives shop-floor operators a simple scan →
report → finish workflow over Business Central production orders.
Business Central remains the system of record for every manufacturing
rule; this app only collects operator input and calls BC.

See `ARCHITECTURE.md` for the full technical architecture and
`BUSINESS-CENTRAL-INTEGRATION.md` for exactly which Business Central APIs
are assumed (and which require a custom AL extension).

## 1. Installation

```bash
npm install
cp .env.example .env
```

Generate a session-signing secret and put it in `.env`:

```bash
openssl rand -hex 32
```

## 2. Environment variables

All configuration lives in `.env` — see `.env.example` for the full list.
The important one is `BC_MODE`:

| BC_MODE      | Needs a real BC tenant? | Notes                                   |
|--------------|--------------------------|------------------------------------------|
| `demo`       | No                       | Runs entirely on in-memory demo data     |
| `sandbox`    | Yes                      | Requires `BC_TENANT_ID`, `BC_CLIENT_ID`, `BC_CLIENT_SECRET`, `BC_SCOPE`, `BC_ENVIRONMENT_NAME`, `BC_COMPANY_ID` |
| `production` | Yes                      | Same variables, pointed at production    |

## 3. Demo mode

```bash
# .env
BC_MODE=demo
```

```bash
npm run dev
```

Open http://localhost:3000, log in with:

- Username `ravi` / password `demo123`
- Username `priya` / password `demo123`

Demo production orders include `PO-10452` (Forging, in progress) and
`PO-10460` (Heating, not yet started) — see `src/lib/demo/data.ts` to add
more.

## 4. Sandbox configuration

1. Register an app in Microsoft Entra ID with Business Central API
   permissions and a client secret.
2. Set `BC_MODE=sandbox` and fill in `BC_TENANT_ID`, `BC_CLIENT_ID`,
   `BC_CLIENT_SECRET`, `BC_SCOPE`, `BC_ENVIRONMENT_NAME`, `BC_COMPANY_ID` in
   `.env`.
3. Build and deploy the AL extension described in
   `BUSINESS-CENTRAL-INTEGRATION.md` — without it, login and every posting
   action will return "This feature isn't available yet in this
   environment" (by design — see that document).

## 5. Production configuration

Same as sandbox, pointed at the production environment/company. Never
commit `.env` — secrets come from your deployment platform's secret store.

## 6. Running locally

```bash
npm run dev
```

## 7. Building

```bash
npm run lint
npm run build
```

## 8. Running the PWA

```bash
npm run build && npm start
```

Then, on a phone/tablet, open the site in the browser and use "Add to Home
Screen" (iOS Safari) or the install prompt (Android Chrome). The app opens
full-screen with no browser chrome.

## 9. Camera permissions

The QR scanner (`Scan Job`) requests camera access via
`getUserMedia({ video: { facingMode: "environment" } })`. This requires
HTTPS in production (localhost is exempt for local dev). If permission is
denied or unsupported, the screen shows a message and operators can use
`Enter Job` instead — manual entry always leads to the same workflow.

## 10. Business Central authentication requirements

See `BUSINESS-CENTRAL-INTEGRATION.md` § Operator login. In short: this app
never stores or compares raw operator passwords itself — it delegates
validation to Business Central (via a custom API or Entra ID, to be
decided with the BC admin) and only receives a yes/no + operator identity
back.
