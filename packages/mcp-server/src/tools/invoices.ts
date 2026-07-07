import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { compactParams, cursorParam, isoDateTimeParam, limitParam, uuidParam } from '../params.js';
import { runTool } from '../tool-runner.js';

const SCOPE = 'invoices:read';

const INVOICE_STATUSES = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;

export function registerInvoiceTools(server: McpServer, client: AxiosInstance): void {
  server.registerTool(
    'list_invoices',
    {
      description:
        "List the organisation's invoices, sorted by creation date descending. Filter by status, patient, appointment, or creation date range. Requires the invoices:read scope.",
      inputSchema: {
        limit: limitParam,
        cursor: cursorParam,
        status: z.enum(INVOICE_STATUSES).optional().describe('Filter by invoice status'),
        patientId: z.string().uuid().optional().describe('Filter by patient ID'),
        appointmentId: z.string().uuid().optional().describe('Filter by appointment ID'),
        dateFrom: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include invoices created on or after this instant'
        ),
        dateTo: isoDateTimeParam(
          'ISO 8601 timestamp with offset; include invoices created on or before this instant'
        ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor, status, patientId, appointmentId, dateFrom, dateTo }) =>
      runTool(SCOPE, () =>
        client.get<unknown>('/v1/developer/invoices', {
          params: compactParams({
            limit,
            cursor,
            status,
            patientId,
            appointmentId,
            dateFrom,
            dateTo,
          }),
        })
      )
  );

  server.registerTool(
    'get_invoice',
    {
      description:
        'Get full details for one invoice by ID, including line items, discounts, tax, and deposit amounts. Requires the invoices:read scope.',
      inputSchema: {
        id: uuidParam('The invoice ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => runTool(SCOPE, () => client.get<unknown>(`/v1/developer/invoices/${id}`))
  );
}
