# @yosemite-crew/mcp-server

An MCP (Model Context Protocol) server that gives AI agents read access to a Yosemite Crew organisation through the developer data API (`/v1/developer/...`). It runs over stdio and authenticates with a developer API key, so any MCP client (Claude Desktop, Claude Code, or your own agent) can query appointments, patients, encounters, invoices, the organisation profile, and API usage.

The API surface this server targets is defined in `docs/plans/developer-portal-data-api.md` (the v1 data plane contract). All tools are read-only; write tools arrive with the v1.1 write endpoints.

## Requirements

- Node.js 20 or later.
- A Yosemite Crew developer API key (`yc_live_...` or `yc_test_...`), created in the developer portal under `/developers/api-keys`.
- A running Yosemite Crew backend with the `/v1/developer` data plane mounted.

Note on test keys: `yc_test_...` keys are read-only and excluded from billing, but in v1 they read your organisation's real data. Full sandbox isolation ships later with the preview environment.

## Configuration

The server is configured entirely through environment variables:

| Variable          | Required | Default                 | Purpose                                               |
| ----------------- | -------- | ----------------------- | ----------------------------------------------------- |
| `YC_API_KEY`      | yes      | -                       | Developer API key sent as `Authorization: Bearer ...` |
| `YC_API_BASE_URL` | no       | `http://localhost:3000` | Backend origin the data plane is served from          |

The server exits with a clear error at startup if `YC_API_KEY` is not set.

## Build and run

From the monorepo root:

```bash
pnpm install
pnpm --filter @yosemite-crew/mcp-server run build
YC_API_KEY=yc_test_xxx node packages/mcp-server/dist/index.js
```

For development without a build step:

```bash
YC_API_KEY=yc_test_xxx pnpm --filter @yosemite-crew/mcp-server run dev
```

The package also exposes the binary as `yc-mcp` when installed.

## Claude Desktop configuration

Add the server to `claude_desktop_config.json` (replace the placeholder key and path):

```json
{
  "mcpServers": {
    "yosemite-crew": {
      "command": "node",
      "args": ["/path/to/Yosemite-Crew/packages/mcp-server/dist/index.js"],
      "env": {
        "YC_API_KEY": "yc_test_your_key_here",
        "YC_API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Claude Code configuration

```bash
claude mcp add yosemite-crew \
  --env YC_API_KEY=yc_test_your_key_here \
  --env YC_API_BASE_URL=http://localhost:3000 \
  -- node /path/to/Yosemite-Crew/packages/mcp-server/dist/index.js
```

## Tools

| Tool                | Endpoint                             | Required scope      |
| ------------------- | ------------------------------------ | ------------------- |
| `list_appointments` | `GET /v1/developer/appointments`     | `appointments:read` |
| `get_appointment`   | `GET /v1/developer/appointments/:id` | `appointments:read` |
| `list_patients`     | `GET /v1/developer/patients`         | `patients:read`     |
| `get_patient`       | `GET /v1/developer/patients/:id`     | `patients:read`     |
| `list_encounters`   | `GET /v1/developer/encounters`       | `encounters:read`   |
| `get_encounter`     | `GET /v1/developer/encounters/:id`   | `encounters:read`   |
| `list_invoices`     | `GET /v1/developer/invoices`         | `invoices:read`     |
| `get_invoice`       | `GET /v1/developer/invoices/:id`     | `invoices:read`     |
| `get_organization`  | `GET /v1/developer/organization`     | `organization:read` |
| `get_usage`         | `GET /v1/developer/usage`            | none                |

List tools accept `limit` (1-100, default 50) and an opaque `cursor` taken from the previous response's `pagination.nextCursor`, plus the per-resource filters from the contract (status enums, `patientId` / `caseId` / `appointmentId`, and ISO 8601 `dateFrom` / `dateTo` ranges). Tool results contain the raw JSON response envelope, so paginated responses include the `pagination` object needed to fetch the next page.

## Errors, quotas, and rate limits

API failures are returned as MCP error results with actionable text rather than raw stack traces:

- `401` - the key is missing, revoked, or expired; check `YC_API_KEY`.
- `403` - the key lacks the scope listed in the table above; issue a key with the right scopes in the portal.
- `404` - the resource does not exist or belongs to a different organisation (the API deliberately does not distinguish these).
- `429` with code `quota_exceeded` - the free tier includes 1,000 calls per month; the message includes the `Retry-After` reset hint and suggests upgrading to Pro.
- `429` with code `rate_limited` - a per-key burst limit; retry after the reported number of seconds.

`get_usage` requires no scope and does not consume quota, so it always works for checking where the key stands against its monthly limit.

## Development

```bash
pnpm --filter @yosemite-crew/mcp-server run type-check
pnpm --filter @yosemite-crew/mcp-server run lint
pnpm --filter @yosemite-crew/mcp-server run test
```

Tests mock axios throughout; no network or backend is needed.
