import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { compactParams, cursorParam, isoDateTimeParam, limitParam, uuidParam } from '../params.js';
import { runTool } from '../tool-runner.js';

const SCOPE = 'encounters:read';

export function registerEncounterTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'list_encounters',
    {
      description:
        "List the organisation's clinical encounters, sorted by creation date descending. Filter by status, patient, case, or period start date range. Requires the encounters:read scope.",
      inputSchema: {
        limit: limitParam,
        cursor: cursorParam,
        status: z.string().min(1).optional().describe('Filter by encounter status'),
        patientId: z.string().uuid().optional().describe('Filter by patient ID'),
        caseId: z.string().uuid().optional().describe('Filter by case ID'),
        dateFrom: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include encounters with periodStart on or after this instant'
        ),
        dateTo: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include encounters with periodStart on or before this instant'
        ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor, status, patientId, caseId, dateFrom, dateTo }) =>
      runTool(SCOPE, () =>
        client.get<unknown>('/v1/developer/encounters', {
          params: compactParams({ limit, cursor, status, patientId, caseId, dateFrom, dateTo }),
        })
      )
  );

  server.registerTool(
    'get_encounter',
    {
      description:
        'Get full details for one clinical encounter by ID. Requires the encounters:read scope.',
      inputSchema: {
        id: uuidParam('The encounter ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => runTool(SCOPE, () => client.get<unknown>(`/v1/developer/encounters/${id}`))
  );
}
