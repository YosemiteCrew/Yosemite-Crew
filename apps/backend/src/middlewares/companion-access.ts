import type { NextFunction, Request, Response } from "express";
import { prisma } from "src/config/prisma";
import { findParentIdForAuthUser } from "src/services/shared/parent-identity";

/**
 * Co-parent permissions, enforced on the server.
 *
 * `ParentPatient.permissions` is set when a co-parent invite is accepted and
 * toggled by the primary parent afterwards. Until this middleware existed it
 * was read ONLY by the mobile client, which used it to gate screens - so the
 * switches a primary parent set were a UI convention, not an authorisation
 * boundary. Any co-parent holding a valid session could call the API directly
 * and reach a feature that had been switched off for them. Production has a
 * co-parent with `expenses: false, appointments: false` today.
 *
 * The keys deliberately match the ones the app already gates on
 * (`guardFeature('documents', ...)` and friends), so the server enforces the
 * same model the product already describes rather than inventing a second one.
 *
 * Shape of the decision:
 *   - PRIMARY parents bypass. The permission set exists to describe what a
 *     primary parent has DELEGATED; it never constrains them.
 *   - CO_PARENT must hold the flag, strictly `=== true`. A missing key, a
 *     non-boolean, or a malformed permissions blob denies - this is an
 *     authorisation check, so anything it cannot read is a no.
 *   - No link at all is a 404, not a 403, matching the existing convention on
 *     parent-facing routes: a uniform "not found" so the endpoint cannot be
 *     used to discover which patient ids exist.
 *
 * Two ways in. `requireCompanionPermission` is for routes that carry the
 * patient id in the path. `requireCompanionPermissionForResource` is for routes
 * keyed by a resource id (an expense, an invoice) where the companion has to be
 * read off the row first - see the resolvers at the bottom of this file.
 */
export type CompanionFeature =
  | "appointments"
  | "chatWithVet"
  | "companionProfile"
  | "documents"
  | "emergencyBasedPermissions"
  | "expenses"
  | "medicalRecords"
  | "tasks";

/**
 * What a resolver concluded about the row behind a resource id.
 *
 * `allow` exists for rows that belong to the caller directly and have no
 * companion to check against - an invoice raised against a parent rather than a
 * patient. It is a deliberate, narrow escape hatch: a resolver may only return
 * it after proving ownership itself, which is why resolvers are handed the
 * caller's `parentId`.
 */
export type CompanionResourceScope =
  { kind: "patient"; patientId: string } | { kind: "allow" } | { kind: "deny" };

export type CompanionResourceResolver = (
  req: Request,
  parentId: string,
) => Promise<CompanionResourceScope>;

const FEATURE_LABELS: Record<CompanionFeature, string> = {
  appointments: "appointments",
  chatWithVet: "chat with vet",
  companionProfile: "companion profile",
  documents: "documents",
  emergencyBasedPermissions: "emergency actions",
  expenses: "expenses",
  medicalRecords: "medical records",
  tasks: "tasks",
};

const isGranted = (
  permissions: unknown,
  feature: CompanionFeature,
): boolean => {
  if (!permissions || typeof permissions !== "object") return false;
  return (permissions as Record<string, unknown>)[feature] === true;
};

/**
 * The whole access rule for one companion feature, in one place.
 *
 * Exported because it is not middleware-only. A read that resolves several
 * companions at once cannot run this middleware per row, so it filters with
 * this predicate instead - and if it reimplemented the rule it would drift from
 * the one every path-keyed route enforces. The PRIMARY bypass is the half that
 * gets forgotten: a primary parent's own permission set is a description of
 * what they have DELEGATED, and `promoteLinkToPrimary` and `updatePermissions`
 * both merge caller-supplied overrides over `PRIMARY_PARENT_PERMISSIONS`
 * without pinning anything but `assignAsPrimaryParent`, so a PRIMARY link
 * carrying `medicalRecords: false` is reachable and must still pass.
 *
 * Callers are responsible for the other two halves of the decision: the link
 * must be `status: "ACTIVE"`, and no link at all is a refusal.
 */
export const hasCompanionFeature = (
  role: string,
  permissions: unknown,
  feature: CompanionFeature,
): boolean => role === "PRIMARY" || isGranted(permissions, feature);

const notFound = (res: Response) =>
  res.status(404).json({ message: "Companion not found." });

const enforce = async (
  req: Request,
  res: Response,
  next: NextFunction,
  feature: CompanionFeature,
  resolve: CompanionResourceResolver,
) => {
  try {
    const userId = (req as Request & { userId?: string | null }).userId;
    if (!userId) return notFound(res);

    const parentId = await findParentIdForAuthUser(userId);
    if (!parentId) return notFound(res);

    const scope = await resolve(req, parentId);
    if (scope.kind === "deny") return notFound(res);
    if (scope.kind === "allow") return next();

    // Load-bearing, and it must stay BEFORE the query.
    //
    // Prisma omits an `undefined` field from `where` rather than matching
    // nothing, so `{ patientId: undefined, parentId }` silently becomes
    // `{ parentId }` - a filter that matches this parent's link to ANY
    // patient and would hand back a link, and therefore access. A route
    // mounted with the wrong param name, or a resolver reading a column that
    // turned out to be null, would do exactly that. The type says this is a
    // string; the check is here because the cost of being wrong is a bypass.
    //
    // CodeQL flags this as js/user-controlled-bypass because a user-supplied
    // value guards an authorisation decision. The direction is inverted: the
    // falsy branch DENIES, and the value is used to look the permission up,
    // never to decide whether to check it. Removing this guard is the
    // vulnerability; having it is the fix.
    if (!scope.patientId) return notFound(res);

    const link = await prisma.parentPatient.findFirst({
      where: {
        patientId: scope.patientId,
        parentId,
        status: "ACTIVE",
        role: { in: ["PRIMARY", "CO_PARENT"] },
      },
      select: { role: true, permissions: true },
    });

    if (!link) return notFound(res);

    if (hasCompanionFeature(link.role, link.permissions, feature)) {
      return next();
    }

    // Worded so the app can show it as-is; it already says the same thing.
    return res.status(403).json({
      message: `Ask the primary parent to enable ${FEATURE_LABELS[feature]} access for you.`,
    });
  } catch (error) {
    return next(error);
  }
};

export const requireCompanionPermission =
  (feature: CompanionFeature, paramName = "patientId") =>
  (req: Request, res: Response, next: NextFunction) => {
    // Same guard as the one inside `enforce`, hoisted so a route mounted with
    // the wrong param name is denied before it costs a query. See the comment
    // there for why a falsy id must never reach a `where` clause.
    const patientId = (req.params as Record<string, string | undefined>)[
      paramName
    ]?.trim();
    if (!patientId) return notFound(res);

    return enforce(req, res, next, feature, async () => ({
      kind: "patient",
      patientId,
    }));
  };

export const requireCompanionPermissionForResource =
  (feature: CompanionFeature, resolve: CompanionResourceResolver) =>
  (req: Request, res: Response, next: NextFunction) =>
    enforce(req, res, next, feature, resolve);

/**
 * Expenses are keyed by a bare id, and the id space is shared: the route serves
 * both `ExternalExpense` (a parent-recorded cost) and `Invoice` (raised by a
 * practice), because `getExpenseById` falls through from one to the other.
 * Both have to be resolved here or the fall-through becomes the bypass.
 *
 * An invoice may have no `patientId` - it can be raised against the parent
 * directly - and there is no companion to authorise against in that case, so
 * ownership is checked in place instead.
 */
export const resolveExpenseCompanion: CompanionResourceResolver = async (
  req,
  parentId,
) => {
  const expenseId = (
    req.params as Record<string, string | undefined>
  ).expenseId?.trim();
  if (!expenseId) return { kind: "deny" };

  const expense = await prisma.externalExpense.findUnique({
    where: { id: expenseId },
    select: { patientId: true },
  });
  if (expense?.patientId) {
    return { kind: "patient", patientId: expense.patientId };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: expenseId },
    select: { patientId: true, parentId: true },
  });
  if (!invoice) return { kind: "deny" };
  if (invoice.patientId) {
    return { kind: "patient", patientId: invoice.patientId };
  }

  return invoice.parentId === parentId ? { kind: "allow" } : { kind: "deny" };
};
