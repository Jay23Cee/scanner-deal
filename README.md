# eBay Resale Scanner

Mobile-first Next.js app for two eBay workflows:

- comparing store items against active eBay listings to decide whether a deal is worth buying
- viewing your own recent sold orders through eBay Fulfillment with seller consent

## What This App Does

- Search active eBay listings by keyword
- Search active eBay listings by GTIN / barcode
- Filter obvious bad matches
- Open eBay sold/completed listings for manual review
- Estimate resale range, profit, ROI, and confidence
- Show a `BUY`, `MAYBE`, or `PASS` recommendation
- Save lightweight keyword/GTIN search history
- Save full deal analyses with comparison snapshots
- Connect one seller account and cache recent sold orders
- Review cached order detail with line items

## What This App Does Not Do

- Public sold comps search
- eBay page scraping
- Deprecated Finding API usage
- `findCompletedItems`
- ItemSold notifications

## API Boundaries

These eBay concepts are different and this app keeps them separate:

### Active listing search

- Uses the public Browse API
- Uses OAuth client credentials flow
- This app implements this
- Used for manual keyword search and GTIN search

### My own sold orders

- Uses Sell Fulfillment `getOrders`
- Requires OAuth authorization code flow and seller consent
- This app now implements this on `/orders`

### Manual sold/completed review

- Uses a normal browser handoff to eBay search
- Opens eBay sold/completed listings in a new tab
- Does not scrape eBay
- Does not parse sold prices automatically
- Implemented from each scanner session card

### ItemSold notifications

- Seller-facing notification when one of your subscribed listings sells
- Not public sold-comp search
- Not implemented in this app

### Restricted sold comps data

- Marketplace Insights is the closer sold-comps API
- eBay documents that Marketplace Insights is restricted and not open to new users
- This app does not claim market-wide sold-comp access

## Workflow Diagram

This flowchart shows how the app keeps active listing search, manual sold/completed review, and seller-owned orders separate while still storing results inside one app.

```mermaid
flowchart LR
  classDef lane fill:#f8fafc,stroke:#94a3b8,color:#0f172a;
  classDef app fill:#ecfdf5,stroke:#16a34a,color:#14532d;
  classDef ebay fill:#eff6ff,stroke:#2563eb,color:#1e3a8a;
  classDef store fill:#ecfeff,stroke:#0891b2,color:#164e63;
  classDef note fill:#fff7ed,stroke:#f97316,color:#7c2d12;

  subgraph USER["User"]
    direction TB
    U0[Open app]
    U1[Choose scanner or orders workflow]
    U2[Review sold comps manually on eBay]
    U3[Return to app and enter manual sold comps plus pricing assumptions]
    U4[Review BUY / MAYBE / PASS]
    U5[Approve seller consent]
    U6[Filter cached orders and open order detail]
  end

  subgraph UI["App UI"]
    direction TB
    S0["/scanner"]
    S1[Choose keyword / GTIN / optional picture search]
    S2[Run search]
    S3[Show active listings in scanner session]
    S4[Edit sold search title]
    S5[Open sold/completed results on eBay in new tab]
    S6[Submit selected active listings plus manual sold comps plus pricing assumptions]
    S7[Show BUY / MAYBE / PASS]
    H0["/history"]
    A0["/analyses"]
    O0["/orders"]
    O1[Connect seller account]
    O2[Refresh orders]
    O3[Show cached orders]
    OD0["/orders/[orderId]"]
  end

  subgraph BACKEND["App Backend"]
    direction TB
    B1[POST /api/ebay/search]
    B2[Normalize + filter active listings]
    B3[Save search log]
    B4[POST /api/deal/analyze]
    B5[Calculate profit / ROI / confidence]
    B6[Save analysis snapshot]
    B7[eBay OAuth connect + callback]
    B8[POST /api/orders/sync]
    B9[Cache seller orders in database]
  end

  subgraph EXT["eBay + Database"]
    direction TB
    E1[Browse API]
    E2[Manual browser handoff]
    E3[No sold-price scraping]
    E4[eBay sold/completed search results]
    E5[Search log]
    E6[Analysis snapshot]
    E7[eBay OAuth consent]
    E8[Sell Fulfillment getOrders]
    E9[Cached seller orders]
    N0[This app does not provide public sold comps through an API]
    N1[Seller orders only apply to the connected seller account with consent]
    N2[Picture search is optional and feeds the same scanner session]
  end

  U0 --> U1
  U1 --> S0
  U1 --> O0

  S0 --> S1 --> S2 --> B1 --> E1 --> B2 --> B3 --> E5 --> H0
  B2 --> S3
  S1 -.-> N2
  N2 -.-> S3
  S3 --> S4 --> S5 --> E2 --> E4 --> U2
  E2 -.-> E3
  E4 -.-> N0
  S3 --> S6
  U2 --> U3 --> S6 --> B4 --> B5 --> B6 --> E6 --> A0
  B5 --> S7 --> U4

  O0 --> O1 --> B7 --> E7 --> U5 --> B7
  B7 --> O2 --> B8 --> E8 --> B9 --> E9 --> O3 --> U6 --> OD0
  E8 -.-> N1

  class U0,U1,U2,U3,U4,U5,U6 lane;
  class S0,S1,S2,S3,S4,S5,S6,S7,H0,A0,O0,O1,O2,O3,OD0 app;
  class B1,B2,B3,B4,B5,B6,B7,B8,B9 app;
  class E1,E2,E3,E4,E7,E8 ebay;
  class E5,E6,E9 store;
  class N0,N1,N2 note;
```

## Production Access Warning

Local development can proceed with valid eBay credentials, but eBay documents that production Buy API access may require approval through the eBay production access process. Build and test locally first, and treat hosted production deployment as dependent on valid production approval. Use `production` when you need real active listings. Use `sandbox` only for developer-side endpoint testing.

## Stack

- Next.js App Router
- TypeScript
- Prisma + SQLite locally, Turso when hosted
- Node runtime API routes
- Optional Python CLI under `tools/ebay-cli/` for developer testing only

## Setup

1. Install dependencies.

```powershell
npm install
```

2. Create the local environment file.

```powershell
Copy-Item .env.local.example .env.local
```

3. Fill in `.env.local`.

```dotenv
DATABASE_URL="file:./dev.db"
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
EBAY_ENV=production
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_SANDBOX_CLIENT_ID=
EBAY_SANDBOX_CLIENT_SECRET=
EBAY_MARKETPLACE_ID=EBAY_US
EBAY_RU_NAME=
APP_SECRET=
```

For real active listings, use your Production App ID and Production Cert ID with
`EBAY_ENV=production`.

For sandbox-only testing, set `EBAY_ENV=sandbox` and fill
`EBAY_SANDBOX_CLIENT_ID` and `EBAY_SANDBOX_CLIENT_SECRET` with the Sandbox App ID
and Sandbox Cert ID from the same eBay Application Keys page.

If `EBAY_ENV` is omitted, the app defaults to `production`.

The app requests OAuth application tokens with the client-credentials flow,
caches the token in memory until it is near expiration, and refreshes it
automatically. No manually pasted app token is required.

To use `/orders`, also configure:

- `EBAY_RU_NAME`
  The eBay RuName for the active environment. It must match the redirect configuration in the eBay developer portal.
- `APP_SECRET`
  Secret used to encrypt persisted seller access and refresh tokens in the app database.

Picture search is optional. To enable the photo-to-search flow on `/scanner`, configure:

- `EBAY_CLIENT_ID`
  Required. Picture search reuses the app's eBay Browse API credentials.
- `EBAY_CLIENT_SECRET`
  Required. Use the matching Cert ID for the same production keyset.
- `EBAY_MARKETPLACE_ID`
  Required. The Browse marketplace used for both keyword and picture search.
- `EBAY_ENV=production`
  Required for picture search. eBay `searchByImage` is not available in Sandbox.

On mobile, the scanner shows separate `Take Photo` and `Choose Photo` actions. `Take Photo`
uses the camera hint, while `Choose Photo` uses the normal file picker and can select multiple
saved images in one batch.
Browsers and devices can still vary in how they present gallery choices.

For local development, point the eBay redirect configuration for that RuName at:

```text
http://localhost:3000/api/ebay/sell/callback
```

4. Generate the Prisma client and create or update the local SQLite database.

```powershell
npm run prisma:generate
npm run db:migrate
```

For hosted Vercel deployments backed by Turso:

- Keep `DATABASE_URL="file:./dev.db"` for local Prisma migrations.
- Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel for runtime database access.
- Generate migration SQL locally, then apply it to Turso with the Turso CLI.

5. Start the app.

```powershell
npm run dev
```

Optional local scanner/eBay preflight:

```text
http://localhost:3000/api/ebay/verify
```

This route verifies the current eBay config, confirms an OAuth app token can be requested, and reports whether `keyword`, `gtin`, and `picture` search are available in the active environment.

Mobile testing on local network:

- If you open the dev server from a phone or another device on your LAN, add that local origin to `allowedDevOrigins` in [next.config.js](/c:/Users/jayce/Desktop/JC/Code/Ebay_Scanner/next.config.js).
- This matters for `next dev` only. It is the fix for mobile testing where the page appears to refresh instead of running the scanner search.
- When your computer's LAN IP changes, update the origin list and restart the dev server.

6. Open the scanner.

```text
http://localhost:3000/scanner
```

## Main Screens

- `/scanner`
  Search, scan, open eBay sold/completed results for manual review, and analyze a deal
- `/orders`
  Connect a seller account, sync recent sold orders, and inspect cached order detail
- `/history`
  View the latest saved keyword and GTIN searches
- `/analyses`
  View the latest saved deal analyses
- `/settings`
  Save local default assumptions such as fee rate and shipping estimate

## Scanner Flow

1. Choose `Keyword` or `GTIN`
2. Enter a search or scan a barcode
3. Choose item condition: `new`, `open_box`, or `used`
4. Run search
5. Review or edit the sold search title
6. Open `View Sold Items on eBay`
7. Check sold/completed listings manually in eBay
8. Return to the app, enter store price and selling assumptions
9. Run analysis
10. Review `BUY`, `MAYBE`, or `PASS`
11. Check `/history` later for saved searches or `/analyses` for completed deal checks

## Seller Orders Flow

1. Open `/orders`
2. Connect your seller account through eBay consent
3. Approve `sell.fulfillment.readonly`
4. Let the page auto-sync the default 90-day window
5. Narrow the date range or fulfillment status and refresh
6. Open a cached order to inspect totals, statuses, and line items

## Seller Orders Notes

- Orders are cached in the app database after each sync.
- The app supports one connected seller account at a time.
- Cached seller tokens are encrypted with `APP_SECRET`.
- eBay does not return archived orders from `getOrders`.
- eBay notes that certain pending-payment purchases requiring immediate payment are not returned by `getOrders`.

## Decision Model

The app uses active Browse listings only and estimates profit with:

```text
Estimated Profit =
Suggested List Price
- Store Price
- eBay Fee Estimate
- Seller Shipping Cost
- Packaging Cost
- Promoted Listing Cost
- Safety Buffer
```

Then:

```text
ROI = Estimated Profit / Store Price
```

Default v1 thresholds:

- `BUY`: profit meets target, ROI >= 40%, at least 5 usable listings, confidence medium or high
- `MAYBE`: profit >= $10, ROI >= 25%, at least 3 usable listings, but confidence is weaker or spread is wide
- `PASS`: everything else

## Python CLI

The original Python prototype now lives under `tools/ebay-cli/` and is only for developer-side API testing. It is not the main product and should read the root `.env.local`.

## Troubleshooting eBay Auth

- `EBAY_ENV=production` must be paired with `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`.
- `EBAY_ENV=sandbox` must be paired with `EBAY_SANDBOX_CLIENT_ID` and `EBAY_SANDBOX_CLIENT_SECRET`.
- `EBAY_RU_NAME` must belong to the same eBay environment as `EBAY_ENV`.
- The RuName's redirect target must point to `/api/ebay/sell/callback` for the app instance you are running.
- `APP_SECRET` must be set before seller tokens can be saved locally.
- If those do not match, the app now fails fast with a configuration error before it sends the OAuth request.

## Troubleshooting Local Mobile Testing

- `allowedDevOrigins` in [next.config.js](/c:/Users/jayce/Desktop/JC/Code/Ebay_Scanner/next.config.js) must include the LAN origin you use from your phone while running `next dev`.
- Update that list when your workstation IP changes, then restart `npm run dev`.
- If this is missing, mobile Chrome or Samsung Internet can look like the scanner button is refreshing the page without running the search.

## Troubleshooting Picture Search

- Picture search stays available only when `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_MARKETPLACE_ID` are configured in `.env.local`.
- Sandbox credentials do not enable picture search. eBay `searchByImage` remains production-only.
- Picture search also requires `EBAY_ENV=production` because eBay `searchByImage` is not available in Sandbox.
- `Choose Photo` removes the camera hint, supports selecting multiple saved images, and still depends on the mobile browser and device for the exact picker UI.
- If the required eBay config is missing or the app is running in Sandbox, `/scanner` keeps the panel visible but disables uploads and falls back to keyword or GTIN search.
- Open `/api/ebay/verify` locally to confirm the current environment, token status, and whether picture search is expected to be available.

## Useful Commands

```powershell
npm run dev
npm run build
npm run test
npm run typecheck
npm run db:migrate
```

## Official References

- Browse search: https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
- Browse overview: https://developer.ebay.com/api-docs/buy/browse/overview.html
- Buy API requirements: https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
- Browse filters: https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html
- Marketplace support: https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html
- OAuth authorization code grant: https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
- OAuth refresh token flow: https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
- ItemSold: https://developer.ebay.com/api-docs/static/pn_item-sold.html
- Sell Fulfillment `getOrders`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders
