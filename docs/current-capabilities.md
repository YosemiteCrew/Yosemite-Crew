# Current capabilities

This page describes the capabilities available in the current product build. It is a map of shipped surfaces, not a roadmap; proposed work remains in the relevant issue or ADR until it is implemented.

| Surface | Available today | Start here |
| --- | --- | --- |
| Practice operations | Appointments, clinical records, forms, templates, tasks, inventory, billing, communications, and connected laboratory workflows in the web and desktop apps. | [Frontend app](../apps/frontend/README.md), [backend API index](../apps/frontend/content/docs/apps/backend/index.md) |
| Developer portal | Developer sign-in, API-key creation and revocation, usage and billing views, API documentation, playground, website-builder preview, plugins, and intake-form draft import. | [`apps/frontend/src/app/(routes)/(app)/developers`](../apps/frontend/src/app/(routes)/(app)/developers), [developer portal E2E coverage](../apps/frontend/e2e/developer-portal.spec.ts) |
| Developer data API | API-key authenticated reads for organisations, usage, appointments, and appointment details. Organisation access is checked against the key owner's active membership on each request. | [Developer Data API reference](../apps/frontend/content/docs/apps/backend/routers/developer-data.md), [router](../apps/backend/src/routers/developer-data.router.ts) |
| MCP integration | A read-only stdio MCP server backed by the developer data API, with organisation, usage, appointment-list, and appointment-detail tools. | [`@yosemitecrew/mcp-server` guide](../packages/mcp-server/README.md) |
| Pet-owner mobile app | Appointments, records, messages, visit preparation, and companion workflows for participating practices. | [Mobile app guide](../apps/mobileAppYC/README.md) |
| Desktop app | A packaged Electron client for the web PIMS workflows, with update and release support. | [Desktop guide](../apps/desktop/README.md) |

## Still proposed

The in-browser AI editing agent, draft-only MCP configuration writes, and provider-managed inference key vaulting described in [ADR 0005](./adr/0005-ai-editing-agent-security-model.md) are design constraints for future work. The read-only developer data API and MCP integration are implemented; those proposed write and agent surfaces are not.
