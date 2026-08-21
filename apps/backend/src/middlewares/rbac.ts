// src/middlewares/rbac.ts
import { NextFunction, Response, Request } from "express";
import {
  Permission,
  ROLE_PERMISSIONS,
  RoleCode,
} from "../models/role-permission";
import { AuthenticatedRequest } from "./auth";
import { prisma } from "src/config/prisma";

export interface OrgRequest extends AuthenticatedRequest {
  userPermissions?: Permission[];
  organisationId?: string;
}

/**
 * Extract orgId from params, headers, query, or body.
 *
 * Only non-empty string identifiers are accepted. Arrays and objects are
 * rejected so that an untrusted structured value (e.g. a body such as
 * `{"organisationId": {"not": ""}}`) can never reach an ORM filter as a
 * Prisma `StringFilter` and authorize the request against an unintended
 * organisation.
 */
function extractOrgId(req: Request): string | null {
  return (
    extractOrgIdFromParams(req.params) ??
    extractOrgIdFromHeader(req.headers["x-org-id"]) ??
    extractOrgIdFromQuery((req as { query?: unknown }).query) ??
    extractOrgIdFromBody((req as { body?: unknown }).body)
  );
}

function normalizeOrgId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractOrgIdFromParams(params: Request["params"]): string | null {
  return (
    normalizeOrgId(params.orgId) ??
    normalizeOrgId(params.organisationId) ??
    normalizeOrgId(params.organizationId)
  );
}

function extractOrgIdFromHeader(headerValue: unknown): string | null {
  return normalizeOrgId(headerValue);
}

function extractOrgIdFromQuery(query: unknown): string | null {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return null;
  }

  const queryRecord = query as Record<string, unknown>;
  return (
    normalizeOrgId(queryRecord.organisationId) ??
    normalizeOrgId(queryRecord.organizationId)
  );
}

function extractOrgIdFromBody(body: unknown): string | null {
  if (Array.isArray(body)) {
    const orgIds = new Set<string>();

    for (const entry of body) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const oid = normalizeOrgId(
        (entry as Record<string, unknown>).organisationId,
      );
      if (oid) {
        orgIds.add(oid);
      }
    }

    return orgIds.size === 1 ? (Array.from(orgIds)[0] ?? null) : null;
  }

  if (typeof body !== "object" || body === null) {
    return null;
  }

  return normalizeOrgId((body as Record<string, unknown>).organisationId);
}

export function withOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;

    const userId = typedReq.userId;
    const orgId = extractOrgId(req);

    if (!userId || !orgId) {
      return res
        .status(400)
        .json({ message: "Missing userId or organisationId" });
    }

    try {
      // Matching both raw ID and FHIR-style reference.
      // `active` is required: a deactivated membership must not resolve any
      // permissions, otherwise offboarded staff keep org access indefinitely.
      const mapping = await prisma.userOrganization.findFirst({
        where: {
          practitionerReference: userId,
          active: true,
          OR: [
            { organizationReference: orgId },
            { organizationReference: `Organization/${orgId}` },
          ],
        },
      });

      if (!mapping) {
        return res.status(403).json({
          message: "You are not associated with this organisation",
        });
      }

      const effectivePermissions = normalizePermissions(
        mapping.effectivePermissions,
      );

      const computed = computeEffectivePermissions(
        mapping.roleCode as RoleCode,
        mapping.extraPermissions,
        mapping.revokedPermissions,
      );

      if (samePermissions(effectivePermissions, computed)) {
        typedReq.userPermissions = effectivePermissions;
      } else {
        await prisma.userOrganization.updateMany({
          where: { id: mapping.id },
          data: { effectivePermissions: computed },
        });
        typedReq.userPermissions = computed;
      }

      typedReq.organisationId = orgId;

      return next();
    } catch (err) {
      console.error("Error resolving permissions:", err);
      return res.status(500).json({
        message: "Failed to resolve permissions",
      });
    }
  };
}

/**
 * Build a middleware that derives the organisation from the *target resource*
 * rather than from client-supplied input, then delegates to
 * `withOrgPermissions()` for the membership and permission checks.
 *
 * `withOrgPermissions()` on its own only proves the caller belongs to whatever
 * organisation the request names (params, `x-org-id`, query or body). On a
 * route addressed by a resource id that is not sufficient: the caller can name
 * an organisation they legitimately belong to while targeting a record owned by
 * another tenant. Resolving the organisation from the record and overwriting
 * `req.params.organisationId` closes that gap, because the params extractor has
 * the highest precedence in `extractOrgId`.
 *
 * The loader is wrapped so that a malformed identifier is answered with 400
 * instead of rejecting inside an async handler, which Express 4 does not
 * forward to the error middleware.
 */
function withResourceOrgPermissions(
  paramName: string,
  notFoundMessage: string,
  loadOrganisationId: (resourceId: string) => Promise<unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params[paramName];
    if (!resourceId) {
      return res.status(400).json({ message: `Missing ${paramName}` });
    }

    let organisationId: unknown;
    try {
      organisationId = await loadOrganisationId(resourceId);
    } catch (err) {
      console.error(`Error resolving organisation from ${paramName}:`, err);
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }

    if (typeof organisationId !== "string" || !organisationId.trim()) {
      return res.status(404).json({ message: notFoundMessage });
    }

    req.params.organisationId = organisationId.trim();

    return withOrgPermissions()(req, res, next);
  };
}

export function withAppointmentOrgPermissions() {
  return withResourceOrgPermissions(
    "appointmentId",
    "Appointment not found",
    async (appointmentId) => {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { organisationId: true },
      });
      return appointment?.organisationId ?? null;
    },
  );
}

export function withInvoiceOrgPermissions() {
  return withResourceOrgPermissions(
    "invoiceId",
    "Invoice not found",
    async (invoiceId) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { organisationId: true },
      });
      return invoice?.organisationId ?? null;
    },
  );
}

export function withPaymentOrgPermissions() {
  return withResourceOrgPermissions(
    "paymentId",
    "Payment not found",
    async (paymentId) => {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { invoice: { select: { organisationId: true } } },
      });
      return payment?.invoice?.organisationId ?? null;
    },
  );
}

export function withPaymentIntentOrgPermissions() {
  return withResourceOrgPermissions(
    "paymentIntentId",
    "Invoice not found",
    async (paymentIntentId) => {
      const attempt = await prisma.paymentAttempt.findFirst({
        where: { providerPaymentIntentId: paymentIntentId },
        select: { invoice: { select: { organisationId: true } } },
      });
      return attempt?.invoice?.organisationId ?? null;
    },
  );
}

export function withTaskOrgPermissions() {
  return withResourceOrgPermissions(
    "taskId",
    "Task not found",
    async (taskId) => {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { organisationId: true },
      });
      return task?.organisationId ?? null;
    },
  );
}

export function withInventoryItemOrgPermissions() {
  return withResourceOrgPermissions(
    "itemId",
    "Inventory item not found",
    async (itemId) => {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        select: { organisationId: true },
      });
      return item?.organisationId ?? null;
    },
  );
}

export function withEncounterOrgPermissions(paramName = "id") {
  return withResourceOrgPermissions(
    paramName,
    "Encounter not found",
    async (encounterId) => {
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        select: { organisationId: true },
      });
      return encounter?.organisationId ?? null;
    },
  );
}

export function withCaseOrgPermissions(paramName = "id") {
  return withResourceOrgPermissions(
    paramName,
    "Case not found",
    async (caseId) => {
      const record = await prisma.case.findUnique({
        where: { id: caseId },
        select: { organisationId: true },
      });
      return record?.organisationId ?? null;
    },
  );
}

export function withRenderedDocumentOrgPermissions(
  paramName = "renderedDocumentId",
) {
  return withResourceOrgPermissions(
    paramName,
    "Rendered document not found",
    async (renderedDocumentId) => {
      const document = await prisma.renderedDocument.findUnique({
        where: { id: renderedDocumentId },
        select: { organisationId: true },
      });
      return document?.organisationId ?? null;
    },
  );
}

export function withRoomUnitOrgPermissions(paramName = "id") {
  return withResourceOrgPermissions(
    paramName,
    "Room unit not found",
    async (roomUnitId) => {
      const unit = await prisma.roomUnit.findUnique({
        where: { id: roomUnitId },
        select: { organisationId: true },
      });
      return unit?.organisationId ?? null;
    },
  );
}

export function withRoomUnitGroupOrgPermissions(paramName = "id") {
  return withResourceOrgPermissions(
    paramName,
    "Room unit group not found",
    async (groupId) => {
      const group = await prisma.roomUnitGroup.findUnique({
        where: { id: groupId },
        select: { organisationId: true },
      });
      return group?.organisationId ?? null;
    },
  );
}

/**
 * Scopes a route addressed by a `UserOrganization` mapping id to the
 * organisation that mapping grants access to.
 *
 * Role mappings ARE the permission system, so a route that edits one must be
 * authorised against the organisation the mapping belongs to - not against an
 * organisation the caller happens to name.
 */
export function withUserOrganizationOrgPermissions(paramName = "id") {
  return withResourceOrgPermissions(
    paramName,
    "Mapping not found",
    async (mappingId) => {
      const mapping = await prisma.userOrganization.findUnique({
        where: { id: mappingId },
        select: { organizationReference: true },
      });
      return (
        mapping?.organizationReference.replace(/^Organization\//, "") ?? null
      );
    },
  );
}

/**
 * Scopes a route whose organisation arrives in a FHIR `PractitionerRole` body
 * (`organization.reference`) rather than in the path.
 *
 * `withOrgPermissions` reads params / `x-org-id` / query / body, and the body
 * form it understands is a flat `organisationId`. A PractitionerRole nests the
 * reference, so without this the membership check would silently fall back to
 * whatever other org id the request carried.
 */
export function withPractitionerRoleOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body as
      | {
          organization?: { reference?: unknown };
          organizationReference?: unknown;
        }
      | undefined;
    const nested = body?.organization?.reference;
    const flat = body?.organizationReference;
    const reference =
      (typeof nested === "string" && nested.trim() ? nested : undefined) ??
      (typeof flat === "string" && flat.trim() ? flat : undefined);

    if (!reference) {
      return res
        .status(400)
        .json({ message: "Missing organisation reference" });
    }

    req.params.organisationId = reference.trim().replace(/^Organization\//, "");

    return withOrgPermissions()(req, res, next);
  };
}

export function requirePermission(required: Permission | Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;
    const perms = typedReq.userPermissions;

    if (!perms) {
      return res.status(500).json({
        message:
          "Permissions not loaded. Include withOrgPermissions before requirePermission.",
      });
    }

    const ok = Array.isArray(required)
      ? required.some((r) => perms.includes(r))
      : perms.includes(required);

    if (!ok) {
      return res
        .status(403)
        .json({ message: "Forbidden – insufficient permissions" });
    }

    return next();
  };
}

function normalizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];

  const set = new Set<Permission>();

  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      set.add(entry.trim() as Permission);
    }
  }
  return [...set];
}

function computeEffectivePermissions(
  role: RoleCode | undefined,
  extra?: string[],
  revoked?: string[],
): Permission[] {
  if (!role) return normalizePermissions(extra);
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = normalizePermissions(extra);
  const removed = new Set(normalizePermissions(revoked));
  const combined = new Set<Permission>([...base, ...extras]);
  for (const permission of removed) {
    combined.delete(permission);
  }
  return [...combined];
}

function samePermissions(a: Permission[], b: Permission[]) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const permission of b) {
    if (!setA.has(permission)) return false;
  }
  return true;
}
