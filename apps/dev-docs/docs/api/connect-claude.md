---
id: connect-claude
title: Connect Claude to Yosemite Crew
slug: /api/connect-claude
---

`@yosemite-crew/mcp-server` (in `packages/mcp-server`) is an MCP (Model Context Protocol) server that gives Claude read access to your Yosemite Crew organisation through the [Developer Data API](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/docs/plans/developer-portal-data-api.md) at `/v1/developer`. It runs locally over stdio and authenticates with your developer API key, so Claude Desktop, Claude Code, or any other MCP client can query appointments, patients, encounters, invoices, the organisation profile, and API usage.

All tools are read-only and form a static allowlist compiled into the server - there is no way to register new tools at runtime. Write tools arrive with the v1.1 write endpoints, and per [ADR 0005](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/docs/adr/0005-ai-editing-agent-security-model.md) agent-driven writes will only ever create drafts that a human promotes.

## Prerequisites

- Node.js 20 or later.
- A Yosemite Crew developer API key (`yc_live_...` or `yc_test_...`), created in the developer portal under `/developers/api-keys`.
- A running Yosemite Crew backend with the `/v1/developer` data plane mounted.

:::caution Test keys read real data
`yc_test_...` keys are read-only and excluded from billing, but in v1 they read your organisation's real data. Full sandbox isolation ships later with the preview environment. Prefer test keys for agent use anyway: they can never be charged and can never gain write scopes.
:::

## Build the server

From the monorepo root:

```bash
pnpm install
pnpm --filter @yosemite-crew/mcp-server run build
```

The built entry point is `packages/mcp-server/dist/index.js` (also exposed as the `yc-mcp` binary when installed).

## Environment variables

| Variable          | Required | Default                 | Purpose                                               |
| ----------------- | -------- | ----------------------- | ----------------------------------------------------- |
| `YC_API_KEY`      | yes      | -                       | Developer API key sent as `Authorization: Bearer ...` |
| `YC_API_BASE_URL` | no       | `http://localhost:3000` | Backend origin the data plane is served from          |

The server exits with a clear error at startup if `YC_API_KEY` is not set. The key lives only in your local MCP client configuration - keep that file out of version control and never commit a real key.

## Claude Desktop

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

Restart Claude Desktop after saving; the Yosemite Crew tools appear in the tools menu.

## Claude Code

```bash
claude mcp add yosemite-crew \
  --env YC_API_KEY=yc_test_your_key_here \
  --env YC_API_BASE_URL=http://localhost:3000 \
  -- node /path/to/Yosemite-Crew/packages/mcp-server/dist/index.js
```

## Available tools

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

## Quotas, rate limits, and errors

Every data-plane call the server makes counts against your key, so a chatty agent session consumes quota like any other integration:

- The free tier includes 1,000 calls per month. Exceeding it returns `429` with code `quota_exceeded`; the error message includes the `Retry-After` reset hint (seconds until the UTC billing month resets) and suggests upgrading to Pro.
- Each key also has a per-key burst rate limit. Exceeding it returns `429` with code `rate_limited`; retry after the reported number of seconds (typically 1). Rate-limited requests do not consume monthly quota.
- `get_usage` requires no scope and does not consume quota, so it always works for checking where the key stands against its monthly limit - ask Claude to call it if you suspect you are near the cap.

Other API failures are returned to Claude as MCP error results with actionable text rather than raw stack traces:

- `401` - the key is missing, revoked, or expired; check `YC_API_KEY`.
- `403` - the key lacks the scope listed in the table above; issue a key with the right scopes in the portal.
- `404` - the resource does not exist or belongs to a different organisation (the API deliberately does not distinguish these).

## Hosted MCP server: coming soon

Today the server runs locally over stdio. A hosted remote MCP server - connect from Claude with just a URL and your API key, no local Node.js or build step - is planned as part of the developer portal rollout. This page will be updated when it ships.
