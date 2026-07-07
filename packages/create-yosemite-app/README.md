# create-yosemite-app

Scaffold a TypeScript starter project for the [Yosemite Crew](https://github.com/YosemiteCrew/Yosemite-Crew)
Developer Data API v1.

## Usage

```bash
npx create-yosemite-app my-integration
cd my-integration
npm install
cp .env.example .env   # paste an API key from the portal (/developers/api-keys)
npm run dev
```

The project name must be kebab-case (lowercase letters and digits separated
by single hyphens, e.g. `my-integration`). The CLI creates `<name>/` in the
current directory and refuses to overwrite a non-empty directory. It is fully
non-interactive - everything is passed as arguments, nothing is prompted.

Options:

```
--template <name>  project template (default: "api-starter")
-h, --help         show help
```

## What gets generated

```
my-integration/
  package.json     dev-deps only (typescript, @types/node) - the client is
                   dependency-free
  tsconfig.json    strict, NodeNext ESM
  .env.example     YC_API_KEY, YC_API_BASE_URL
  .gitignore       includes .env
  README.md        how to get an API key and which scopes you need
  src/
    client.ts      fetch-based typed client: Bearer auth, { data, pagination }
                   envelope, { message, code } errors, 429 rate_limited vs
                   quota_exceeded
    types.ts       typed models for all v1 resources
    index.ts       example: list upcoming appointments, print API usage
```

## Templates

| Template      | Description                                                              |
| ------------- | ------------------------------------------------------------------------ |
| `api-starter` | Read-only Data API starter: appointments list + usage introspection demo |

## API contract

The generated client targets the read-only Developer Data API v1 defined in
[docs/plans/developer-portal-data-api.md](../../docs/plans/developer-portal-data-api.md):

- Auth via `Authorization: Bearer yc_live_...` (or `X-API-Key`), keys issued
  in the developer portal at `/developers/api-keys`.
- Resources: appointments, patients, encounters, invoices, organization, and
  usage under `/v1/developer/*`, all org-scoped by the key.
- Cursor pagination (`{ data, pagination: { nextCursor, hasMore, limit } }`)
  and stable error codes (`{ message, code }`).

## Development (this package)

```bash
pnpm --filter create-yosemite-app run build
pnpm --filter create-yosemite-app run type-check
pnpm --filter create-yosemite-app run test
```

Template sources live in `templates/<name>/` and are copied verbatim with
`{{name}}` substituted for the project name. `_gitignore` is stored with an
underscore (npm never packs `.gitignore` files) and renamed to `.gitignore`
at scaffold time.
