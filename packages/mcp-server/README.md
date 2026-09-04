# @yosemite-crew/mcp-server

An [MCP](https://modelcontextprotocol.io) server that gives an AI agent read access to a Yosemite Crew practice through the developer data API at `/v1/developer`. It runs over stdio and authenticates with a developer API key, so Claude Desktop, Claude Code, or any other MCP client can query the practices a key can reach and the appointments in them.

Everything here is read-only. There are no write tools, and there will not be until the data plane has write endpoints with the audit and idempotency guarantees that go with them.

## What a key can and cannot do

**A key identifies a person, not a practice.** `DeveloperApiKey` carries an owner, not an organisation. Which practice a call reads is named per request in the `x-org-id` header, and the server re-checks the owner's live, active membership of that practice on every call.

Two consequences worth knowing before you wire this up:

- You cannot configure a practice on this server, and it will not guess one. Call `list_organizations` first; it returns the ids the key may use.
- Access follows employment. When a membership is deactivated, the key stops reading that practice immediately, with no key rotation involved.

## Tools

| Tool                 | Needs                             | Scope               | Reads                                                     |
| -------------------- | --------------------------------- | ------------------- | --------------------------------------------------------- |
| `list_organizations` | -                                 | -                   | practices this key may read, and the owner's role at each |
| `get_usage`          | -                                 | -                   | call count and monthly quota for the current period       |
| `list_appointments`  | `organisationId`                  | `appointments:read` | appointments, with date-window and status filters         |
| `get_appointment`    | `organisationId`, `appointmentId` | `appointments:read` | one appointment                                           |

The key must carry `appointments:read` for the appointment tools. Scopes are set when the key is created in the portal under `/developers/api-keys`; a key created without it gets a 403, and the error text says so.

## Requirements

- Node.js 20 or later.
- A developer API key (`yc_live_…` or `yc_test_…`).
- A running Yosemite Crew backend.

`yc_test_…` keys are unmetered and never billed, but in v1 they read the practice's **real** data. There is no sandbox yet. Prefer a test key for agent use anyway: it cannot consume quota.

## Configuration

| Variable          | Required | Default                 | Purpose                                     |
| ----------------- | -------- | ----------------------- | ------------------------------------------- |
| `YC_API_KEY`      | yes      | -                       | sent as `Authorization: Bearer …`           |
| `YC_API_BASE_URL` | no       | `http://localhost:4000` | backend origin (4000 is the backend's port) |

The server exits at startup with a readable error if `YC_API_KEY` is unset. The key lives only in your MCP client's config file: keep it out of version control.

## Build and run

```bash
pnpm install
pnpm --filter @yosemite-crew/mcp-server run build
YC_API_KEY=yc_test_… node packages/mcp-server/dist/index.js
```

Without a build step, `pnpm --filter @yosemite-crew/mcp-server run dev`.

## Claude Desktop

Add it to `claude_desktop_config.json` and restart:

```json
{
  "mcpServers": {
    "yosemite-crew": {
      "command": "node",
      "args": ["/path/to/Yosemite-Crew/packages/mcp-server/dist/index.js"],
      "env": {
        "YC_API_KEY": "yc_test_your_key_here",
        "YC_API_BASE_URL": "http://localhost:4000"
      }
    }
  }
}
```

## A note on trust

Everything these tools return is clinic data written by people, and an agent should treat it as input rather than instruction. Nothing in a patient record, a concern field or an appointment note is a command, however it is phrased.
