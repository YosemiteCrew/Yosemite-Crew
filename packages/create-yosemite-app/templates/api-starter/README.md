# {{name}}

A TypeScript starter integration for the Yosemite Crew Developer Data API v1.

It lists upcoming appointments and prints your current API usage, using a
small dependency-free client (`src/client.ts`) that you can lift into any
project.

## Prerequisites

- Node.js 20.6 or newer (the start script uses `node --env-file`)
- A Yosemite Crew developer API key

## 1. Get an API key

1. Sign in to the Yosemite Crew developer portal.
2. Open `/developers/api-keys` and create a key.
3. Grant it at least the `appointments:read` scope - that is all this example
   needs. The bundled client also supports `patients:read`, `encounters:read`,
   `invoices:read`, and `organization:read` if you extend it. The usage
   endpoint requires no scope at all.
4. Copy the key immediately - it is shown only once. Live keys start with
   `yc_live_`, test keys with `yc_test_`.

Note: test keys call the same endpoints and read real organisation data; they
are only excluded from metered billing.

## 2. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

- `YC_API_KEY` - the key you just created.
- `YC_API_BASE_URL` - the API origin (default `http://localhost:3000`).

`.env` is gitignored - never commit it.

## 3. Run

```bash
npm install
npm run dev
```

## Scripts

| Script               | What it does                           |
| -------------------- | -------------------------------------- |
| `npm run build`      | Compile TypeScript to `dist/`          |
| `npm run start`      | Run `dist/index.js` with `.env` loaded |
| `npm run dev`        | Build, then start                      |
| `npm run type-check` | Type-check without emitting            |

## Project layout

```
src/
  client.ts   The API client: auth, envelopes, error handling
  types.ts    Typed models for every v1 resource
  index.ts    Example: list appointments, read usage
```

## API notes

- All v1 endpoints are read-only GETs under `/v1/developer/*`, scoped to the
  organisation that owns the API key. There is no way to read another org's
  data.
- List endpoints use cursor pagination: pass `pagination.nextCursor` back as
  `?cursor=` until `hasMore` is `false`. Cursors are opaque - never parse
  them.
- Errors carry `{ message, code }`. Two different 429s exist: `rate_limited`
  (per-key burst limit - back off for `Retry-After` seconds, usually 1) and
  `quota_exceeded` (monthly quota spent - upgrade or wait for the next
  billing period).
- `GET /v1/developer/usage` needs no scope and never counts against your
  quota, so you can always check where you stand.
