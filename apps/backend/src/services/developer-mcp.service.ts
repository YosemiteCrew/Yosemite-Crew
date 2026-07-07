import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  DeveloperDataService,
  type AppointmentStatusFilter,
  type InvoiceStatusFilter,
  type PatientStatusFilter,
} from "src/services/developer-data.service";
import { DeveloperUsageService } from "src/services/developer-usage.service";
import { InvalidCursorError } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";

// Remote MCP endpoint (ALL /v1/developer/mcp): builds a per-request McpServer
// whose tools mirror the stdio @yosemite-crew/mcp-server package exactly -
// same tool names, schemas, and descriptions - but call
// DeveloperDataService / DeveloperUsageService directly instead of HTTP
// self-calls. The verified key's organisationId and scopes are captured in
// the closure of every tool handler, so a handler can only ever read the
// key's own org and a request can never observe another tenant.

export type McpRequestContext = {
  organisationId: string;
  scopes: string[];
};

// Shared parameter schemas matching the v1 data API conventions (identical to
// the stdio package's params.ts).
const limitParam = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(50)
  .describe("Maximum number of results per page (1-100, default 50)");

const cursorParam = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Opaque pagination cursor from the previous response's pagination.nextCursor. Omit for the first page. Do not construct cursors manually.",
  );

const isoDateTimeParam = (description: string) =>
  z.string().datetime({ offset: true }).optional().describe(description);

const uuidParam = (description: string) =>
  z.string().uuid().describe(description);

const APPOINTMENT_STATUSES = [
  "REQUESTED",
  "UPCOMING",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

const PATIENT_STATUSES = ["active", "archived", "inactive"] as const;

const INVOICE_STATUSES = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

const jsonResult = (payload: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(payload ?? null, null, 2) }],
});

const errorResult = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text }],
});

const notFoundResult = (resource: string): CallToolResult =>
  errorResult(
    `Not found (not_found): no ${resource} with that ID exists in this organisation.`,
  );

const insufficientScopeResult = (scope: string): CallToolResult =>
  errorResult(
    `Insufficient scope (insufficient_scope): this tool requires the ${scope} scope, which this API key does not carry.`,
  );

/**
 * Run one tool body with the same failure envelope for every tool: scope
 * enforcement first, cursor errors surfaced as actionable text, anything else
 * logged server-side and returned as an opaque internal error.
 */
const runTool = async (
  context: McpRequestContext,
  requiredScope: string | undefined,
  tool: string,
  body: () => Promise<CallToolResult>,
): Promise<CallToolResult> => {
  if (
    requiredScope &&
    !context.scopes.includes(requiredScope) &&
    !context.scopes.includes("*")
  ) {
    return insufficientScopeResult(requiredScope);
  }
  try {
    return await body();
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return errorResult(
        "Invalid pagination cursor (invalid_request): pass the exact pagination.nextCursor from the previous response, or omit the cursor for the first page.",
      );
    }
    logger.error(`DeveloperMcp ${tool} failed`, { error });
    return errorResult("Internal error (internal_error): the tool failed.");
  }
};

// Builds a stateless per-request server. Tool set mirrors packages/mcp-server
// (the stdio distribution) - keep the two in lockstep.
export const DeveloperMcpService = {
  buildServer(context: McpRequestContext): McpServer {
    const server = new McpServer({
      name: "yosemite-crew",
      version: "1.0.0",
    });

    server.registerTool(
      "list_appointments",
      {
        description:
          "List the organisation's appointments, sorted by appointment date descending. Filter by status or appointment date range. Requires the appointments:read scope.",
        inputSchema: {
          limit: limitParam,
          cursor: cursorParam,
          status: z
            .enum(APPOINTMENT_STATUSES)
            .optional()
            .describe("Filter by appointment status"),
          dateFrom: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include appointments with appointmentDate on or after this instant",
          ),
          dateTo: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include appointments with appointmentDate on or before this instant",
          ),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ limit, cursor, status, dateFrom, dateTo }) =>
        runTool(context, "appointments:read", "list_appointments", async () => {
          const page = await DeveloperDataService.listAppointments({
            organisationId: context.organisationId,
            limit,
            cursor,
            status: status as AppointmentStatusFilter | undefined,
            dateFrom,
            dateTo,
          });
          return jsonResult({ data: page.items, pagination: page.pagination });
        }),
    );

    server.registerTool(
      "get_appointment",
      {
        description:
          "Get full details for one appointment by ID, including support staff, attachments, form IDs, and linked case/encounter. Requires the appointments:read scope.",
        inputSchema: { id: uuidParam("The appointment ID") },
        annotations: { readOnlyHint: true },
      },
      async ({ id }) =>
        runTool(context, "appointments:read", "get_appointment", async () => {
          const row = await DeveloperDataService.getAppointment(
            context.organisationId,
            id,
          );
          return row
            ? jsonResult({ data: row })
            : notFoundResult("appointment");
        }),
    );

    server.registerTool(
      "list_patients",
      {
        description:
          "List patients (companion animals) actively linked to the key's organisation. Optionally filter by record status. Requires the patients:read scope.",
        inputSchema: {
          limit: limitParam,
          cursor: cursorParam,
          status: z
            .enum(PATIENT_STATUSES)
            .optional()
            .describe("Filter by patient record status"),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ limit, cursor, status }) =>
        runTool(context, "patients:read", "list_patients", async () => {
          const page = await DeveloperDataService.listPatients({
            organisationId: context.organisationId,
            limit,
            cursor,
            status: status as PatientStatusFilter | undefined,
          });
          return jsonResult({ data: page.items, pagination: page.pagination });
        }),
    );

    server.registerTool(
      "get_patient",
      {
        description:
          "Get full details for one patient (companion animal) by ID, including species/breed codes, weight, allergies, and passport number. Requires the patients:read scope.",
        inputSchema: { id: uuidParam("The patient ID") },
        annotations: { readOnlyHint: true },
      },
      async ({ id }) =>
        runTool(context, "patients:read", "get_patient", async () => {
          const row = await DeveloperDataService.getPatient(
            context.organisationId,
            id,
          );
          return row ? jsonResult({ data: row }) : notFoundResult("patient");
        }),
    );

    server.registerTool(
      "list_encounters",
      {
        description:
          "List the organisation's clinical encounters, sorted by creation date descending. Filter by status, patient, case, or period start date range. Requires the encounters:read scope.",
        inputSchema: {
          limit: limitParam,
          cursor: cursorParam,
          status: z
            .string()
            .min(1)
            .optional()
            .describe("Filter by encounter status"),
          patientId: z
            .string()
            .uuid()
            .optional()
            .describe("Filter by patient ID"),
          caseId: z.string().uuid().optional().describe("Filter by case ID"),
          dateFrom: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include encounters with periodStart on or after this instant",
          ),
          dateTo: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include encounters with periodStart on or before this instant",
          ),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ limit, cursor, status, patientId, caseId, dateFrom, dateTo }) =>
        runTool(context, "encounters:read", "list_encounters", async () => {
          const page = await DeveloperDataService.listEncounters({
            organisationId: context.organisationId,
            limit,
            cursor,
            status,
            patientId,
            caseId,
            dateFrom,
            dateTo,
          });
          return jsonResult({ data: page.items, pagination: page.pagination });
        }),
    );

    server.registerTool(
      "get_encounter",
      {
        description:
          "Get full details for one clinical encounter by ID. Requires the encounters:read scope.",
        inputSchema: { id: uuidParam("The encounter ID") },
        annotations: { readOnlyHint: true },
      },
      async ({ id }) =>
        runTool(context, "encounters:read", "get_encounter", async () => {
          const row = await DeveloperDataService.getEncounter(
            context.organisationId,
            id,
          );
          return row ? jsonResult({ data: row }) : notFoundResult("encounter");
        }),
    );

    server.registerTool(
      "list_invoices",
      {
        description:
          "List the organisation's invoices, sorted by creation date descending. Filter by status, patient, appointment, or creation date range. Requires the invoices:read scope.",
        inputSchema: {
          limit: limitParam,
          cursor: cursorParam,
          status: z
            .enum(INVOICE_STATUSES)
            .optional()
            .describe("Filter by invoice status"),
          patientId: z
            .string()
            .uuid()
            .optional()
            .describe("Filter by patient ID"),
          appointmentId: z
            .string()
            .uuid()
            .optional()
            .describe("Filter by appointment ID"),
          dateFrom: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include invoices created on or after this instant",
          ),
          dateTo: isoDateTimeParam(
            "ISO 8601 timestamp with offset; include invoices created on or before this instant",
          ),
        },
        annotations: { readOnlyHint: true },
      },
      async ({
        limit,
        cursor,
        status,
        patientId,
        appointmentId,
        dateFrom,
        dateTo,
      }) =>
        runTool(context, "invoices:read", "list_invoices", async () => {
          const page = await DeveloperDataService.listInvoices({
            organisationId: context.organisationId,
            limit,
            cursor,
            status: status as InvoiceStatusFilter | undefined,
            patientId,
            appointmentId,
            dateFrom,
            dateTo,
          });
          return jsonResult({ data: page.items, pagination: page.pagination });
        }),
    );

    server.registerTool(
      "get_invoice",
      {
        description:
          "Get full details for one invoice by ID, including line items, discounts, tax, and deposit amounts. Requires the invoices:read scope.",
        inputSchema: { id: uuidParam("The invoice ID") },
        annotations: { readOnlyHint: true },
      },
      async ({ id }) =>
        runTool(context, "invoices:read", "get_invoice", async () => {
          const row = await DeveloperDataService.getInvoice(
            context.organisationId,
            id,
          );
          return row ? jsonResult({ data: row }) : notFoundResult("invoice");
        }),
    );

    server.registerTool(
      "get_organization",
      {
        description:
          "Get the profile of the organisation this API key belongs to: name, type, contact details, address, and rating. Singular resource; no ID is needed. Requires the organization:read scope.",
        annotations: { readOnlyHint: true },
      },
      async () =>
        runTool(context, "organization:read", "get_organization", async () => {
          const org = await DeveloperDataService.getOrganization(
            context.organisationId,
          );
          return org
            ? jsonResult({ data: org })
            : notFoundResult("organisation");
        }),
    );

    server.registerTool(
      "get_usage",
      {
        // Diverges from the stdio package's description in one clause: over
        // this remote transport every MCP POST consumes one quota unit
        // (authorizeApiKey runs before the transport), so the stdio claim
        // "does not consume quota" would be false here.
        description:
          "Get API usage for the current billing period: billing period, call count, and monthly limit (null on pro/enterprise; the free tier allows 1000 calls per month). Works with any valid key and requires no scope.",
        annotations: { readOnlyHint: true },
      },
      async () =>
        runTool(context, undefined, "get_usage", async () => {
          const usage = await DeveloperUsageService.getUsage(
            context.organisationId,
          );
          return jsonResult({ data: usage });
        }),
    );

    return server;
  },
};
