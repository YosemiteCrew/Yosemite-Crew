// src/middlewares/rbac.ts
import { NextFunction, Response, Request } from "express";
import { Types } from "mongoose";
import {
  Permission,
  ROLE_PERMISSIONS,
  RoleCode,
} from "../models/role-permission";
import { AuthenticatedRequest } from "./auth";
import UserOrganizationModel from "src/models/user-organization";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import AppointmentModel from "src/models/appointment";
import InvoiceModel from "src/models/invoice";
import TaskModel from "src/models/task";
import { InventoryItemModel } from "src/models/inventory";

export interface OrgRequest extends AuthenticatedRequest {
  userPermissions?: Permission[];
  organisationId?: string;
}

/**
 * Extract orgId from params, headers, or body.
 */
function extractOrgId(req: Request): string | null {
  return (
    extractOrgIdFromParams(req.params) ??
    extractOrgIdFromHeader(req.headers["x-org-id"]) ??
    extractOrgIdFromQuery((req as { query?: unknown }).query) ??
    extractOrgIdFromBody((req as { body?: unknown }).body)
  );
}

function extractOrgIdFromParams(params: Request["params"]) {
  return params.orgId ?? params.organisationId ?? params.organizationId ?? null;
}

function extractOrgIdFromHeader(headerValue: unknown) {
  return typeof headerValue === "string" && headerValue.trim()
    ? headerValue.trim()
    : null;
}

function extractOrgIdFromQuery(query: unknown): unknown {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return undefined;
  }

  const queryRecord = query as Record<string, unknown>;
  return queryRecord.organisationId ?? queryRecord.organizationId;
}

function extractOrgIdFromBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    const orgIds = new Set<string>();

    for (const entry of body) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const oid = (entry as Record<string, unknown>).organisationId;
      if (typeof oid === "string" && oid.trim()) {
        orgIds.add(oid.trim());
      }
    }

    if (orgIds.size === 1) {
      return Array.from(orgIds)[0] ?? null;
    }

    return undefined;
  }

  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  return (body as Record<string, unknown>).organisationId;
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
      // Matching both raw ID and FHIR-style reference
      const mapping = isReadFromPostgres()
        ? await prisma.userOrganization.findFirst({
            where: {
              practitionerReference: userId,
              OR: [
                { organizationReference: orgId },
                { organizationReference: `Organization/${orgId}` },
              ],
            },
          })
        : await UserOrganizationModel.findOne({
            practitionerReference: userId,
            $or: [
              { organizationReference: orgId },
              { organizationReference: `Organization/${orgId}` },
            ],
          });

      if (!mapping) {
        return res.status(403).json({
          message: "You are not associated with this organisation",
        });
      }

      const effectivePermissions = normalizePermissions(
        (mapping as any).effectivePermissions,
      );

      const computed = computeEffectivePermissions(
        (mapping as any).roleCode as RoleCode,
        (mapping as any).extraPermissions,
        (mapping as any).revokedPermissions,
      );

      if (samePermissions(effectivePermissions, computed)) {
        typedReq.userPermissions = effectivePermissions;
      } else if (isReadFromPostgres()) {
        await prisma.userOrganization.updateMany({
          where: { id: (mapping as any).id },
          data: { effectivePermissions: computed },
        });
        typedReq.userPermissions = computed;
      } else {
        const updated = await UserOrganizationModel.findByIdAndUpdate(
          (mapping as any)._id,
          { $set: { effectivePermissions: computed } },
          { new: true },
        );
        typedReq.userPermissions = normalizePermissions(
          (updated as any)?.effectivePermissions ?? computed,
        );
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

export function withAppointmentOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const appointmentId = req.params.appointmentId;
    if (!appointmentId) {
      return res.status(400).json({ message: "Missing appointmentId" });
    }

    const appointment = isReadFromPostgres()
      ? await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { organisationId: true },
        })
      : Types.ObjectId.isValid(appointmentId)
        ? await AppointmentModel.findById(appointmentId, {
            organisationId: 1,
          }).lean()
        : null;

    const organisationId = appointment?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    req.params.organisationId = organisationId.toString();

    return withOrgPermissions()(req, res, next);
  };
}

export function withInvoiceOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const invoiceId = req.params.invoiceId;
    if (!invoiceId) {
      return res.status(400).json({ message: "Missing invoiceId" });
    }

    const invoice = isReadFromPostgres()
      ? await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { organisationId: true },
        })
      : await InvoiceModel.findById(invoiceId, {
          organisationId: 1,
        }).lean();

    const organisationId = invoice?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    req.params.organisationId = organisationId.toString();

    return withOrgPermissions()(req, res, next);
  };
}

export function withPaymentOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentId = req.params.paymentId;
    if (!paymentId) {
      return res.status(400).json({ message: "Missing paymentId" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { invoice: { select: { organisationId: true } } },
    });

    const organisationId = payment?.invoice?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Payment not found" });
    }

    req.params.organisationId = organisationId.toString();

    return withOrgPermissions()(req, res, next);
  };
}

export function withPaymentIntentOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentIntentId = req.params.paymentIntentId;
    if (!paymentIntentId) {
      return res.status(400).json({ message: "Missing paymentIntentId" });
    }

    const invoice = await prisma.paymentAttempt.findFirst({
      where: { providerPaymentIntentId: paymentIntentId },
      select: {
        invoice: {
          select: { organisationId: true },
        },
      },
    });

    const organisationId = invoice?.invoice?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    req.params.organisationId = organisationId.toString();

    return withOrgPermissions()(req, res, next);
  };
}

export function withTaskOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const taskId = req.params.taskId;
    if (!taskId) {
      return res.status(400).json({ message: "Missing taskId" });
    }

    const task = isReadFromPostgres()
      ? await prisma.task.findUnique({
          where: { id: taskId },
          select: { organisationId: true },
        })
      : Types.ObjectId.isValid(taskId)
        ? await TaskModel.findById(taskId, {
            organisationId: 1,
          }).lean()
        : null;

    const organisationId = task?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Task not found" });
    }

    req.params.organisationId = organisationId.toString();

    return withOrgPermissions()(req, res, next);
  };
}

export function withInventoryItemOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ message: "Missing itemId" });
    }

    const item = isReadFromPostgres()
      ? await prisma.inventoryItem.findUnique({
          where: { id: itemId },
          select: { organisationId: true },
        })
      : await InventoryItemModel.findById(itemId, {
          organisationId: 1,
        }).lean();

    const organisationId = item?.organisationId ?? null;
    if (!organisationId) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    req.params.organisationId = organisationId.toString();

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
