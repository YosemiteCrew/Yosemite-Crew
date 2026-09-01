import { describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";

import { resolveAuthorizedOrganisationId } from "../../src/middlewares/authorized-organisation";

const buildRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
};

const buildReq = (organisationId?: string) =>
  ({ organisationId }) as unknown as Request;

describe("resolveAuthorizedOrganisationId", () => {
  it("returns the authorized organisation when nothing else is supplied", () => {
    const { res, status } = buildRes();

    expect(resolveAuthorizedOrganisationId(buildReq("org-1"), res)).toBe(
      "org-1",
    );
    expect(status).not.toHaveBeenCalled();
  });

  it("returns the authorized organisation when the request agrees with it", () => {
    const { res, status } = buildRes();

    expect(
      resolveAuthorizedOrganisationId(buildReq("org-1"), res, "org-1"),
    ).toBe("org-1");
    expect(status).not.toHaveBeenCalled();
  });

  it("accepts a FHIR-style reference for the authorized organisation", () => {
    const { res, status } = buildRes();

    expect(
      resolveAuthorizedOrganisationId(
        buildReq("org-1"),
        res,
        "Organization/org-1",
      ),
    ).toBe("org-1");
    expect(status).not.toHaveBeenCalled();
  });

  it("answers 403 when the request names a different organisation", () => {
    const { res, status, json } = buildRes();

    expect(
      resolveAuthorizedOrganisationId(buildReq("org-1"), res, "org-victim"),
    ).toBeUndefined();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: "Organisation does not match the authorized organisation.",
    });
  });

  it("answers 403 for a FHIR-style reference to a different organisation", () => {
    const { res, status } = buildRes();

    expect(
      resolveAuthorizedOrganisationId(
        buildReq("org-1"),
        res,
        "Organization/org-victim",
      ),
    ).toBeUndefined();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("answers 400 when the RBAC layer authorized no organisation", () => {
    const { res, status, json } = buildRes();

    expect(
      resolveAuthorizedOrganisationId(buildReq(undefined), res, "org-1"),
    ).toBeUndefined();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Organisation identifier is required.",
    });
  });
});
