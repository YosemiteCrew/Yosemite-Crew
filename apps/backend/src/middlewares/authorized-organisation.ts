// src/middlewares/authorized-organisation.ts
import { Request, Response } from "express";

import { OrgRequest } from "./rbac";

const stripOrganisationPrefix = (value?: string) =>
  value?.replace(/^Organization\//, "");

/**
 * Resolve the organisation the RBAC layer actually authorized for this request.
 *
 * `withOrgPermissions` reads the organisation from the params, the `x-org-id`
 * header, the query and the body, in that order, and stops at the first one it
 * finds. A handler that goes back to the query or the body therefore reads a
 * *different* value from the one the membership check ran against whenever a
 * caller supplies both: authorize on the header for an organisation they belong
 * to, name another organisation in the payload, and the request acts outside the
 * tenant that was checked.
 *
 * So a client-supplied identifier is only ever used to detect that mismatch.
 * The organisation returned is always the authorized one. Responds and returns
 * `undefined` when the request cannot proceed.
 */
export const resolveAuthorizedOrganisationId = (
  req: Request,
  res: Response,
  provided?: string,
): string | undefined => {
  const authorized = (req as OrgRequest).organisationId;

  if (!authorized) {
    res.status(400).json({ message: "Organisation identifier is required." });
    return undefined;
  }

  const requested = stripOrganisationPrefix(provided);
  if (requested && requested !== authorized) {
    res.status(403).json({
      message: "Organisation does not match the authorized organisation.",
    });
    return undefined;
  }

  return authorized;
};
