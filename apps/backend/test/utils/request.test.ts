import type { Request } from "express";
import {
  resolveUserIdFromRequest,
  resolveVerifiedOrganisationId,
  resolveVerifiedUserId,
} from "../../src/utils/request";

describe("resolveUserIdFromRequest", () => {
  it("returns authenticated userId when both auth userId and x-user-id header are present", () => {
    const req = {
      headers: { "x-user-id": "spoofed-user" },
      userId: "real-user",
    } as unknown as Request;

    expect(resolveUserIdFromRequest(req)).toBe("real-user");
  });

  // The header fallback is gone: it was unreachable on authenticated routes and
  // a spoof everywhere else, and the same helper was being used for
  // authorization decisions. The name is kept as an alias of
  // `resolveVerifiedUserId` so the existing call sites keep compiling.
  it("no longer falls back to x-user-id when no session is set", () => {
    const req = {
      headers: { "x-user-id": "header-user" },
    } as unknown as Request;

    expect(resolveUserIdFromRequest(req)).toBeUndefined();
  });
});

describe("resolveVerifiedUserId", () => {
  it("returns the session userId", () => {
    const req = { headers: {}, userId: "real-user" } as unknown as Request;

    expect(resolveVerifiedUserId(req)).toBe("real-user");
  });

  it("never falls back to the x-user-id header", () => {
    const req = {
      headers: { "x-user-id": "spoofed-user" },
    } as unknown as Request;

    expect(resolveVerifiedUserId(req)).toBeUndefined();
  });

  it("treats a blank session userId as absent", () => {
    const req = {
      headers: { "x-user-id": "spoofed-user" },
      userId: "   ",
    } as unknown as Request;

    expect(resolveVerifiedUserId(req)).toBeUndefined();
  });
});

describe("resolveVerifiedOrganisationId", () => {
  it("returns the organisation withOrgPermissions attached", () => {
    const req = {
      headers: {},
      organisationId: "verified-org",
    } as unknown as Request;

    expect(resolveVerifiedOrganisationId(req)).toBe("verified-org");
  });

  it("never falls back to the x-org-id header, params or body", () => {
    const req = {
      headers: { "x-org-id": "victim-org" },
      params: { organisationId: "victim-org" },
      body: { organisationId: "victim-org" },
    } as unknown as Request;

    expect(resolveVerifiedOrganisationId(req)).toBeUndefined();
  });

  it("treats a blank organisationId as absent", () => {
    const req = { headers: {}, organisationId: "  " } as unknown as Request;

    expect(resolveVerifiedOrganisationId(req)).toBeUndefined();
  });
});
