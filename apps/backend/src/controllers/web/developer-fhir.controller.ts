import type { Request, Response } from "express";
import type {
  Bundle,
  BundleEntry,
  OperationOutcome,
  Resource,
} from "@yosemite-crew/fhir";
import type { OrgRequest } from "src/middlewares/rbac";
import { DeveloperFhirService } from "src/services/developer-fhir.service";
import type {
  AppointmentStatusFilter,
  InvoiceStatusFilter,
  PatientStatusFilter,
} from "src/services/developer-data.service";
import { InvalidCursorError, clampLimit } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";

// FHIR R4 read surface of the developer data plane (plan:
// docs/plans/developer-portal-fhir-api.md). This controller owns FHIR search
// parameter parsing, the searchset Bundle envelope with the opaque _cursor
// next link, and OperationOutcome errors that preserve the JSON API's machine
// code in issue[0].details.coding[0].code. Auth, scopes, rate limits, and
// quota are the shared data-plane middleware - nothing FHIR-specific there.

const FHIR_JSON = "application/fhir+json";

// Platform-owned system carrying the data API's stable machine codes so a
// caller can branch on the same values in both dialects (design doc s4).
const ERROR_CODE_SYSTEM =
  "https://yosemitecrew.com/fhir/CodeSystem/developer-api-error";

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const operationOutcome = (
  issueCode: string,
  apiCode: string,
  message: string,
): OperationOutcome => ({
  resourceType: "OperationOutcome",
  issue: [
    {
      severity: "error",
      code: issueCode,
      details: {
        coding: [{ system: ERROR_CODE_SYSTEM, code: apiCode }],
        text: message,
      },
    },
  ],
});

const sendOutcome = (
  res: Response,
  status: number,
  issueCode: string,
  apiCode: string,
  message: string,
): Response =>
  res
    .status(status)
    .type(FHIR_JSON)
    .json(operationOutcome(issueCode, apiCode, message));

const respondInvalid = (res: Response, message: string): Response =>
  sendOutcome(res, 400, "invalid", "invalid_request", message);

const respondNotSupported = (res: Response, message: string): Response =>
  sendOutcome(res, 400, "not-supported", "invalid_request", message);

const respondNotFound = (res: Response): Response =>
  sendOutcome(res, 404, "not-found", "not_found", "Resource not found");

const respondError = (
  res: Response,
  action: string,
  error: unknown,
): Response => {
  if (error instanceof InvalidCursorError) {
    return respondInvalid(res, "Invalid pagination cursor");
  }
  logger.error(`DeveloperFhir ${action} failed`, { error });
  return sendOutcome(
    res,
    500,
    "exception",
    "internal_error",
    "Internal server error",
  );
};

// --- Search parameter parsing ------------------------------------------------

class SearchParamError extends Error {
  constructor(
    message: string,
    public readonly supported: boolean,
  ) {
    super(message);
    this.name = "SearchParamError";
  }
}

// Query values that are not plain strings (qs nested objects) normalize to
// "" and fail the empty-value check downstream instead of stringifying to
// "[object Object]".
const toValues = (value: unknown): string[] => {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry : ""));
  }
  return [typeof value === "string" ? value : ""];
};

// Rejects any parameter outside the resource's declared set: unsupported
// search params are an OperationOutcome (not-supported), never silently
// ignored (design doc s5 - silent ignoring makes callers trust unfiltered
// data).
const assertOnlySupportedParams = (
  query: Request["query"],
  supported: readonly string[],
): void => {
  for (const key of Object.keys(query)) {
    if (!supported.includes(key)) {
      throw new SearchParamError(
        `Search parameter is not supported: ${key}`,
        false,
      );
    }
  }
};

const parseSingle = (
  query: Request["query"],
  name: string,
): string | undefined => {
  const values = toValues(query[name]);
  if (values.length > 1) {
    throw new SearchParamError(`Repeated search parameter: ${name}`, true);
  }
  const value = values[0];
  if (value === "") {
    throw new SearchParamError(`Empty search parameter: ${name}`, true);
  }
  return value;
};

const parseCount = (query: Request["query"]): number => {
  const raw = parseSingle(query, "_count");
  if (raw === undefined) {
    return clampLimit(undefined);
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new SearchParamError("Invalid _count value", true);
  }
  return clampLimit(parsed);
};

// FHIR date search values: ge/le prefixes only (design doc s5), each at most
// once, mapped onto the JSON API's dateFrom/dateTo ISO range.
const parseDateRange = (
  query: Request["query"],
): { dateFrom?: string; dateTo?: string } => {
  const range: { dateFrom?: string; dateTo?: string } = {};
  for (const raw of toValues(query.date)) {
    const prefix = raw.slice(0, 2);
    const value = raw.slice(2);
    if (prefix !== "ge" && prefix !== "le") {
      throw new SearchParamError(
        "Only ge/le prefixes are supported on the date parameter",
        false,
      );
    }
    if (!value || Number.isNaN(new Date(value).getTime())) {
      throw new SearchParamError(`Invalid date value: ${raw}`, true);
    }
    const key = prefix === "ge" ? "dateFrom" : "dateTo";
    if (range[key] !== undefined) {
      throw new SearchParamError(`Repeated ${prefix} date bound`, true);
    }
    range[key] = new Date(value).toISOString();
  }
  return range;
};

const parseToken = <T extends string>(
  query: Request["query"],
  name: string,
  allowed: readonly T[],
): T | undefined => {
  const value = parseSingle(query, name);
  if (value === undefined) {
    return undefined;
  }
  if (!allowed.includes(value as T)) {
    throw new SearchParamError(`Invalid ${name} value: ${value}`, true);
  }
  return value as T;
};

// Accepts "Patient/{id}" or a bare id, per FHIR reference search convention.
const parsePatientReference = (query: Request["query"]): string | undefined => {
  const value = parseSingle(query, "patient");
  if (value === undefined) {
    return undefined;
  }
  const id = value.startsWith("Patient/")
    ? value.slice("Patient/".length)
    : value;
  if (!id) {
    throw new SearchParamError("Invalid patient reference", true);
  }
  return id;
};

const APPOINTMENT_STATUSES: readonly AppointmentStatusFilter[] = [
  "REQUESTED",
  "UPCOMING",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const INVOICE_STATUSES: readonly InvoiceStatusFilter[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

// --- Bundle assembly ----------------------------------------------------------

const requestPath = (req: Request): string => req.originalUrl.split("?")[0];

const buildNextUrl = (req: Request, cursor: string, count: number): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "_cursor" || key === "_count") {
      continue;
    }
    for (const entry of toValues(value)) {
      params.append(key, entry);
    }
  }
  params.set("_count", String(count));
  params.set("_cursor", cursor);
  return `${requestPath(req)}?${params.toString()}`;
};

const buildSearchsetBundle = (
  req: Request,
  resources: Array<Resource & { id?: string }>,
  nextCursor: string | null,
  count: number,
): Bundle => {
  const path = requestPath(req);
  const link = [{ relation: "self", url: req.originalUrl }];
  if (nextCursor) {
    link.push({ relation: "next", url: buildNextUrl(req, nextCursor, count) });
  }
  const entry: BundleEntry[] = resources.map((resource) => ({
    ...(resource.id ? { fullUrl: `${path}/${resource.id}` } : {}),
    resource,
    search: { mode: "match" },
  }));
  // No `total` - parity with the JSON API, which dropped it because org-wide
  // counts cost a full extra query per page (design doc s4).
  return { resourceType: "Bundle", type: "searchset", link, entry };
};

const sendBundle = (
  req: Request,
  res: Response,
  resources: Array<Resource & { id?: string }>,
  nextCursor: string | null,
  count: number,
): Response =>
  res
    .status(200)
    .type(FHIR_JSON)
    .json(buildSearchsetBundle(req, resources, nextCursor, count));

const handleSearchParamError = (
  res: Response,
  error: SearchParamError,
): Response =>
  error.supported
    ? respondInvalid(res, error.message)
    : respondNotSupported(res, error.message);

export const DeveloperFhirController = {
  // Capability statement: valid key, no scope, quota-exempt (router wires it
  // through authorizeApiKeyVerifyOnly like /usage).
  metadata: (_req: Request, res: Response): Response =>
    res
      .status(200)
      .type(FHIR_JSON)
      .json(DeveloperFhirService.buildCapabilityStatement()),

  searchOrganization: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      assertOnlySupportedParams(req.query, []);
    } catch (error) {
      return handleSearchParamError(res, error as SearchParamError);
    }
    try {
      // Singular resource: the key's own org as a one-entry searchset.
      const resource =
        await DeveloperFhirService.getOrganization(organisationId);
      return sendBundle(req, res, resource ? [resource] : [], null, 1);
    } catch (error) {
      return respondError(res, "searchOrganization", error);
    }
  },

  readOrganization: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    // A foreign org id gets the same not-found as a missing one - the org
    // scoping rule of the JSON API, verbatim.
    if (req.params.id !== organisationId) {
      return respondNotFound(res);
    }
    try {
      const resource =
        await DeveloperFhirService.getOrganization(organisationId);
      if (!resource) {
        return respondNotFound(res);
      }
      return res.status(200).type(FHIR_JSON).json(resource);
    } catch (error) {
      return respondError(res, "readOrganization", error);
    }
  },

  searchPatients: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    let limit: number;
    let cursor: string | undefined;
    let status: PatientStatusFilter | undefined;
    try {
      assertOnlySupportedParams(req.query, ["active", "_count", "_cursor"]);
      limit = parseCount(req.query);
      cursor = parseSingle(req.query, "_cursor");
      const active = parseToken(req.query, "active", ["true", "false"]);
      // active=true -> active records; active=false -> archived records
      // (toFHIRCompanion maps archived to active: false).
      status =
        active === undefined
          ? undefined
          : active === "true"
            ? "active"
            : "archived";
    } catch (error) {
      return handleSearchParamError(res, error as SearchParamError);
    }
    try {
      const page = await DeveloperFhirService.listPatients({
        organisationId,
        limit,
        cursor,
        status,
      });
      return sendBundle(
        req,
        res,
        page.resources,
        page.pagination.nextCursor,
        limit,
      );
    } catch (error) {
      return respondError(res, "searchPatients", error);
    }
  },

  readPatient: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const resource = await DeveloperFhirService.getPatient(
        organisationId,
        req.params.id,
      );
      if (!resource) {
        return respondNotFound(res);
      }
      return res.status(200).type(FHIR_JSON).json(resource);
    } catch (error) {
      return respondError(res, "readPatient", error);
    }
  },

  searchAppointments: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    let limit: number;
    let cursor: string | undefined;
    let status: AppointmentStatusFilter | undefined;
    let range: { dateFrom?: string; dateTo?: string };
    try {
      assertOnlySupportedParams(req.query, [
        "date",
        "status",
        "_count",
        "_cursor",
      ]);
      limit = parseCount(req.query);
      cursor = parseSingle(req.query, "_cursor");
      status = parseToken(req.query, "status", APPOINTMENT_STATUSES);
      range = parseDateRange(req.query);
    } catch (error) {
      return handleSearchParamError(res, error as SearchParamError);
    }
    try {
      const page = await DeveloperFhirService.listAppointments({
        organisationId,
        limit,
        cursor,
        status,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      return sendBundle(
        req,
        res,
        page.resources,
        page.pagination.nextCursor,
        limit,
      );
    } catch (error) {
      return respondError(res, "searchAppointments", error);
    }
  },

  readAppointment: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const resource = await DeveloperFhirService.getAppointment(
        organisationId,
        req.params.id,
      );
      if (!resource) {
        return respondNotFound(res);
      }
      return res.status(200).type(FHIR_JSON).json(resource);
    } catch (error) {
      return respondError(res, "readAppointment", error);
    }
  },

  searchEncounters: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    let limit: number;
    let cursor: string | undefined;
    let status: string | undefined;
    let patientId: string | undefined;
    let range: { dateFrom?: string; dateTo?: string };
    try {
      assertOnlySupportedParams(req.query, [
        "status",
        "patient",
        "date",
        "_count",
        "_cursor",
      ]);
      limit = parseCount(req.query);
      cursor = parseSingle(req.query, "_cursor");
      status = parseSingle(req.query, "status");
      patientId = parsePatientReference(req.query);
      range = parseDateRange(req.query);
    } catch (error) {
      return handleSearchParamError(res, error as SearchParamError);
    }
    try {
      const page = await DeveloperFhirService.listEncounters({
        organisationId,
        limit,
        cursor,
        status,
        patientId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      return sendBundle(
        req,
        res,
        page.resources,
        page.pagination.nextCursor,
        limit,
      );
    } catch (error) {
      return respondError(res, "searchEncounters", error);
    }
  },

  readEncounter: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const resource = await DeveloperFhirService.getEncounter(
        organisationId,
        req.params.id,
      );
      if (!resource) {
        return respondNotFound(res);
      }
      return res.status(200).type(FHIR_JSON).json(resource);
    } catch (error) {
      return respondError(res, "readEncounter", error);
    }
  },

  searchInvoices: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    let limit: number;
    let cursor: string | undefined;
    let status: InvoiceStatusFilter | undefined;
    let patientId: string | undefined;
    let range: { dateFrom?: string; dateTo?: string };
    try {
      assertOnlySupportedParams(req.query, [
        "status",
        "patient",
        "date",
        "_count",
        "_cursor",
      ]);
      limit = parseCount(req.query);
      cursor = parseSingle(req.query, "_cursor");
      status = parseToken(req.query, "status", INVOICE_STATUSES);
      patientId = parsePatientReference(req.query);
      range = parseDateRange(req.query);
    } catch (error) {
      return handleSearchParamError(res, error as SearchParamError);
    }
    try {
      const page = await DeveloperFhirService.listInvoices({
        organisationId,
        limit,
        cursor,
        status,
        patientId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      return sendBundle(
        req,
        res,
        page.resources,
        page.pagination.nextCursor,
        limit,
      );
    } catch (error) {
      return respondError(res, "searchInvoices", error);
    }
  },

  readInvoice: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const resource = await DeveloperFhirService.getInvoice(
        organisationId,
        req.params.id,
      );
      if (!resource) {
        return respondNotFound(res);
      }
      return res.status(200).type(FHIR_JSON).json(resource);
    } catch (error) {
      return respondError(res, "readInvoice", error);
    }
  },
};
