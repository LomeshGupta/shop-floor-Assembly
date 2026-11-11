# Business Central Integration

This document lists every Business Central touchpoint this app makes, and —
critically — which ones are standard Business Central API v2.0 entities
versus which ones **require a custom API page / AL extension** that does
not exist in a stock Business Central tenant. Per the project's ground
rules, nothing in this codebase silently fakes a Business Central call; a
feature that needs a custom API returns a typed `NOT_IMPLEMENTED` error
until that API is built (see `lib/business-central/adapters/business-central.ts`).

## Why so much is "custom"

Standard BC API v2.0 exposes core entities (items, customers, sales, some
inventory) but does **not** expose:

- shop-floor-friendly, pre-joined "what should this operator see right
  now" views of a production order, its current routing operation, and its
  machine center
- production journal posting (output / scrap / consumption) as bound
  actions
- any endpoint intended for validating an end-user password outside of
  Microsoft Entra ID sign-in

All of these are legitimate, common asks for a shop-floor app — they just
need to be built as an AL extension exposing custom API pages, not invented
by this codebase.

## Per-action integration table

### Operator login

```
PWA action           Operator submits username + password
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
Auth                  App-level OAuth token calls the custom API; the
                       custom API itself must authenticate the operator
                       (e.g. by comparing against a User Setup–linked
                       credential store or delegating to Entra ID) —
                       this app must never receive or compare a raw
                       password itself against anything it stores.
Request               { username, password }  (over HTTPS only)
Response              { id, username, displayName }
Errors                401 invalid credentials
```

> Do not build this as "app reads password hash from BC and compares
> locally." That would mean this app stores/handles credential material it
> shouldn't. The custom API must own the comparison and only return a
> yes/no + identity.

### Get production order (Job Overview / Active Job / Consume Material)

```
PWA action           Scan/enter PO → fetch shop-floor view
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
                       (assumed name: shopFloorProductionOrders)
Auth                  App-level OAuth token
Request               GET shopFloorProductionOrders('PO-10452')
Response              ProductionOrder (see lib/business-central/types.ts) —
                       current operation, machine center, BOM lines,
                       produced/scrapped/remaining quantities
Errors                404 not found, 400 not released
```

### Start job

```
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
                       (bound action on shopFloorProductionOrders)
Request               POST .../Microsoft.NAV.startJob
Response              { orderNo, startedAt }
```

### Report output

```
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
                       Should create + post an Output Journal line
                       server-side inside Business Central.
Request               POST .../Microsoft.NAV.postOutput
                       { orderNo, operationNo, goodQuantity }
Response              { postedQuantity, postedAt, quantityProduced, quantityRemaining }
Errors                400 invalid quantity, 409 order changed since read,
                       500+ posting rejected by BC
```

### Report scrap

```
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
Request               POST .../Microsoft.NAV.postScrap
                       { orderNo, operationNo, quantity, reasonCode }
Response              { postedQuantity, postedAt, quantityScrapped }
```

### Scrap reasons (list)

```
BC endpoint            LIKELY standard — "Reason Codes" entity
                       (verify exact entity-set name against the target
                       tenant's published API before relying on this)
Request               GET reasonCodes
Response              { value: [{ code, description }] }
```

### Consume material

```
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
                       Must honor the BOM line's configured consumption
                       strategy (Expected / Actual / Bulk / LotControlled) —
                       see ProductionBOMLine.consumptionStrategy.
Request               POST .../Microsoft.NAV.postConsumption
                       { orderNo, itemNo, actualQuantity, lotNo? }
Response              { postedQuantity, postedAt }
Errors                400 insufficient inventory, 400 lot required
```

### Finish job

```
BC endpoint            REQUIRES BC CUSTOM API / AL EXTENSION
Request               POST .../Microsoft.NAV.finishJob
Response              { finishedAt, status }
```

## Building the AL extension

Everything marked "REQUIRES BC CUSTOM API / AL EXTENSION" above should
become a single AL extension exposing:

1. One API page (`shopFloorProductionOrders`) projecting exactly the read
   fields this app needs — not the full standard Production Order page.
2. Bound actions on that page for `startJob`, `postOutput`, `postScrap`,
   `postConsumption`, `finishJob` — each wrapping the equivalent standard
   manufacturing posting routine (Output Journal, Consumption Journal,
   etc.) so BC's own validation/business rules still run.
3. A operator-authentication endpoint or an agreed alternative (e.g. this
   app authenticates operators against Entra ID directly instead, if the
   organization prefers not to build a custom login API).

Until that extension exists, `BC_MODE=sandbox`/`production` will return
"This feature isn't available yet in this environment" for every write
action and for login — which is the correct, honest behavior rather than
pretending to succeed.
