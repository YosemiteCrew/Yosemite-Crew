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

export const requireCompanionPermission =
  (feature: CompanionFeature, paramName = "patientId") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = (req.params as Record<string, string | undefined>)[
        paramName
      ];
      const userId = (req as Request & { userId?: string | null }).userId;

      // Load-bearing, and it must stay BEFORE the query.
      //
      // Prisma omits an `undefined` field from `where` rather than matching
      // nothing, so `{ patientId: undefined, parentId }` silently becomes
      // `{ parentId }` - a filter that matches this parent's link to ANY
      // patient and would hand back a link, and therefore access. A route
      // mounted with the wrong param name would do exactly that.
      //
      // CodeQL flags this as js/user-controlled-bypass because a user-supplied
      // value guards an authorisation decision. The direction is inverted: the
      // falsy branch DENIES, and the value is used to look the permission up,
      // never to decide whether to check it. Removing this guard is the
      // vulnerability; having it is the fix.
      if (!patientId || !userId) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const parentId = await findParentIdForAuthUser(userId);
      if (!parentId) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const link = await prisma.parentPatient.findFirst({
        where: {
          patientId,
          parentId,
          status: "ACTIVE",
          role: { in: ["PRIMARY", "CO_PARENT"] },
        },
        select: { role: true, permissions: true },
      });

      if (!link) {
        return res.status(404).json({ message: "Companion not found." });
      }

      if (link.role === "PRIMARY" || isGranted(link.permissions, feature)) {
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
