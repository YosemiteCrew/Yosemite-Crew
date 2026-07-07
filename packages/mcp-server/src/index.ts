#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './client.js';
import { registerAppointmentTools } from './tools/appointments.js';
import { registerPatientTools } from './tools/patients.js';
import { registerEncounterTools } from './tools/encounters.js';
import { registerInvoiceTools } from './tools/invoices.js';
import { registerOrganizationTools } from './tools/organization.js';
import { registerUsageTools } from './tools/usage.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

const server = new McpServer({
  name: 'yosemite-crew',
  version,
});

const client = createApiClient();

registerAppointmentTools(server, client);
registerPatientTools(server, client);
registerEncounterTools(server, client);
registerInvoiceTools(server, client);
registerOrganizationTools(server, client);
registerUsageTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
