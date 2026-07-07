import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { runTool } from '../tool-runner.js';

const SCOPE = 'organization:read';

export function registerOrganizationTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'get_organization',
    {
      description:
        'Get the profile of the organisation this API key belongs to: name, type, contact details, address, and rating. Singular resource; no ID is needed. Requires the organization:read scope.',
      annotations: { readOnlyHint: true },
    },
    async () => runTool(SCOPE, () => client.get<unknown>('/v1/developer/organization'))
  );
}
