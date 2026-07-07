import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { compactParams, cursorParam, limitParam, uuidParam } from '../params.js';
import { runTool } from '../tool-runner.js';

const SCOPE = 'patients:read';

const PATIENT_STATUSES = ['active', 'archived', 'inactive'] as const;

export function registerPatientTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'list_patients',
    {
      description:
        "List patients (companion animals) actively linked to the key's organisation. Optionally filter by record status. Requires the patients:read scope.",
      inputSchema: {
        limit: limitParam,
        cursor: cursorParam,
        status: z.enum(PATIENT_STATUSES).optional().describe('Filter by patient record status'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor, status }) =>
      runTool(SCOPE, () =>
        client.get<unknown>('/v1/developer/patients', {
          params: compactParams({ limit, cursor, status }),
        })
      )
  );

  server.registerTool(
    'get_patient',
    {
      description:
        'Get full details for one patient (companion animal) by ID, including species/breed codes, weight, allergies, and passport number. Requires the patients:read scope.',
      inputSchema: {
        id: uuidParam('The patient ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => runTool(SCOPE, () => client.get<unknown>(`/v1/developer/patients/${id}`))
  );
}
