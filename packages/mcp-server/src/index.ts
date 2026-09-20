#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './client.js';
import { registerAppointmentTools } from './tools/appointments.js';
import { registerOrganizationTools } from './tools/organizations.js';
import { registerUsageTools } from './tools/usage.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

const server = new McpServer({ name: 'yosemite-crew', version });
const client = createApiClient();

registerOrganizationTools(server, client);
registerUsageTools(server, client);
registerAppointmentTools(server, client);

await server.connect(new StdioServerTransport());
