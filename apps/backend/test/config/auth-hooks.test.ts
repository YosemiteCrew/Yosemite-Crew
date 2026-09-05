import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockFindFirst: jest.Mock = jest.fn();
const mockFindMany: jest.Mock = jest.fn();
const mockUpsert: jest.Mock = jest.fn();
const mockCreateUserIdMapping: jest.Mock = jest.fn();
const mockUserOrgFindMany: jest.Mock = jest.fn();
const mockOrganizationCount: jest.Mock = jest.fn();
const mockUserFindFirst: jest.Mock = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    authIdentity: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    userOrganization: {
      findMany: (...args: unknown[]) => mockUserOrgFindMany(...args),
    },
    organization: {
      count: (...args: unknown[]) => mockOrganizationCount(...args),
    },
  },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock("supertokens-node", () => ({
  __esModule: true,
  default: {
    createUserIdMapping: (...args: unknown[]) =>
      mockCreateUserIdMapping(...args),
  },
}));

import { authHooks } from "src/config/auth-hooks";

describe("authHooks.resolveAuthProfile", () => {
  it("classifies email+password as the staff web product", async () => {
    await expect(
      authHooks.resolveAuthProfile!({
        appUserId: "u1",
        email: "vet@clinic.test",
        loginMethod: "emailpassword",
      }),
    ).resolves.toBe("pims_web");
  });

  it("classifies email OTP as the pet-parent mobile product even when the address matches staff", async () => {
    // The dual-role case: a vet who is also a pet owner signs in on mobile via
    // OTP with their clinic address. Profile must follow the login method, not
    // the email, or every mobile route would 403 them.
    await expect(
      authHooks.resolveAuthProfile!({
        appUserId: "u1",
        email: "vet@clinic.test",
        loginMethod: "otp-email",
      }),
    ).resolves.toBe("pet_parent_mobile");
  });

  it("classifies social logins as the pet-parent mobile product", async () => {
    for (const method of [
      "thirdparty-google",
      "thirdparty-apple",
      "thirdparty-facebook",
    ] as const) {
      await expect(
        authHooks.resolveAuthProfile!({
          appUserId: "u1",
          loginMethod: method,
        }),
      ).resolves.toBe("pet_parent_mobile");
    }
  });

  it("defers to the package default for an unknown login method", async () => {
    await expect(
      authHooks.resolveAuthProfile!({
        appUserId: "u1",
        loginMethod: "unknown",
      }),
    ).resolves.toBeUndefined();
  });

  it("never queries the database to resolve a profile", async () => {
    await authHooks.resolveAuthProfile!({
      appUserId: "u1",
      email: "vet@clinic.test",
      loginMethod: "otp-email",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("authHooks.onUserCreated", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
  });

  it("records the identity mapping for a supertokens sign-up", async () => {
    await authHooks.onUserCreated!({
      appUserId: "u1",
      providerUserId: "st-1",
      provider: "supertokens",
      authProfile: "pet_parent_mobile",
      email: "owner@example.test",
      loginMethod: "otp-email",
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const arg = mockUpsert.mock.calls[0][0] as {
      where: {
        provider_providerUserId: { provider: string; providerUserId: string };
      };
      create: { appUserId: string };
    };
    expect(arg.where.provider_providerUserId).toEqual({
      provider: "supertokens",
      providerUserId: "st-1",
    });
    expect(arg.create.appUserId).toBe("u1");
  });

  it("ignores non-supertokens providers", async () => {
    await authHooks.onUserCreated!({
      appUserId: "u1",
      providerUserId: "c-1",
      provider: "cognito",
      authProfile: "pims_web",
      email: "x@example.test",
      loginMethod: "unknown",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("swallows persistence errors so sign-up is never blocked", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("db down") as never);
    await expect(
      authHooks.onUserCreated!({
        appUserId: "u1",
        providerUserId: "st-2",
        provider: "supertokens",
        authProfile: "pet_parent_mobile",
        email: "owner@example.test",
        loginMethod: "otp-email",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("authHooks.resolveAppUserId", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindMany.mockReset();
    mockUpsert.mockReset();
    mockCreateUserIdMapping.mockReset();
  });

  it("relinks a migrated account to the legacy staff app id", async () => {
    mockFindMany.mockResolvedValueOnce([
      { appUserId: "legacy-staff-id" },
    ] as never);
    mockCreateUserIdMapping.mockResolvedValueOnce({ status: "OK" } as never);

    await expect(
      authHooks.resolveAppUserId!({
        appUserId: "st-user-1",
        providerUserId: "recipe-user-1",
        provider: "supertokens",
        authProfile: "pims_web",
        email: "vet@clinic.test",
        loginMethod: "emailpassword",
        claims: {},
      }),
    ).resolves.toBe("legacy-staff-id");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerUserId: {
            provider: "supertokens",
            providerUserId: "recipe-user-1",
          },
        },
        update: {
          appUserId: "legacy-staff-id",
          email: "vet@clinic.test",
          authProfile: "pims_web",
        },
      }),
    );
    expect(mockCreateUserIdMapping).not.toHaveBeenCalled();
  });

  it("falls back to the current supertokens id for a brand-new account", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);
    mockFindFirst.mockResolvedValueOnce({ appUserId: "st-user-2" } as never);

    await expect(
      authHooks.resolveAppUserId!({
        appUserId: "st-user-2",
        providerUserId: "recipe-user-2",
        provider: "supertokens",
        authProfile: "pet_parent_mobile",
        email: "new@example.test",
        loginMethod: "otp-email",
        claims: {},
      }),
    ).resolves.toBe("st-user-2");

    expect(mockCreateUserIdMapping).not.toHaveBeenCalled();
  });
});

describe("authHooks.isSignInBlocked", () => {
  const blocked = (appUserId: string, providerUserId = appUserId) =>
    authHooks.isSignInBlocked!({
      appUserId,
      providerUserId,
      email: "vet@clinic.test",
      loginMethod: "emailpassword",
    });

  beforeEach(() => {
    mockUserOrgFindMany.mockReset();
    mockOrganizationCount.mockReset();
    mockUserFindFirst.mockReset();
    mockFindFirst.mockReset();
    // Default: the supplied id IS the canonical one (an account created after
    // the migration). The migrated case is covered explicitly below.
    mockUserFindFirst.mockResolvedValue(null as never);
    mockFindFirst.mockResolvedValue(null as never);
  });

  it("blocks when every organisation the user belongs to is inactive", async () => {
    mockUserOrgFindMany.mockResolvedValue([
      { organizationReference: "org-1" },
    ] as never);
    mockOrganizationCount.mockResolvedValue(0 as never);

    await expect(blocked("staff-1")).resolves.toBe(true);
    expect(mockOrganizationCount).toHaveBeenCalledWith({
      where: { id: { in: ["org-1"] }, isActive: true },
    });
  });

  it("allows a user who still belongs to one active organisation", async () => {
    // Someone employed at a disabled practice and a live one still has a job.
    // Per-organisation authorisation decides what they can reach once in.
    mockUserOrgFindMany.mockResolvedValue([
      { organizationReference: "org-disabled" },
      { organizationReference: "Organization/org-live" },
    ] as never);
    mockOrganizationCount.mockResolvedValue(1 as never);

    await expect(blocked("staff-2")).resolves.toBe(false);
  });

  it("does not block a user with no organisation membership", async () => {
    // Pet parents have no userOrganization row. Reading an empty list as
    // "belongs to nothing, therefore disabled" would lock every mobile user out.
    mockUserOrgFindMany.mockResolvedValue([] as never);

    await expect(blocked("pet-parent-1")).resolves.toBe(false);
    expect(mockOrganizationCount).not.toHaveBeenCalled();
  });

  it("strips the FHIR Organization/ prefix before looking the row up", async () => {
    // Mappings are stored bare or prefixed; querying the prefixed string finds
    // nothing, which would count zero active orgs and block a live account.
    mockUserOrgFindMany.mockResolvedValue([
      { organizationReference: "Organization/org-9" },
    ] as never);
    mockOrganizationCount.mockResolvedValue(1 as never);

    await expect(blocked("staff-3")).resolves.toBe(false);
    expect(mockOrganizationCount).toHaveBeenCalledWith({
      where: { id: { in: ["org-9"] }, isActive: true },
    });
  });

  it("de-duplicates repeated organisation references", async () => {
    // One person holds several roleCodes at one practice, so the membership
    // query returns the same organisation more than once.
    mockUserOrgFindMany.mockResolvedValue([
      { organizationReference: "org-7" },
      { organizationReference: "Organization/org-7" },
    ] as never);
    mockOrganizationCount.mockResolvedValue(1 as never);

    await expect(blocked("staff-4")).resolves.toBe(false);
    expect(mockOrganizationCount).toHaveBeenCalledWith({
      where: { id: { in: ["org-7"] }, isActive: true },
    });
  });

  it("reads only active memberships, in both reference forms", async () => {
    mockUserOrgFindMany.mockResolvedValue([] as never);
    await blocked("staff-5", "recipe-5");

    expect(mockUserOrgFindMany).toHaveBeenCalledWith({
      where: {
        active: true,
        OR: [
          { practitionerReference: "staff-5" },
          { practitionerReference: "Practitioner/staff-5" },
          { practitionerReference: "recipe-5" },
          { practitionerReference: "Practitioner/recipe-5" },
        ],
      },
      select: { organizationReference: true },
    });
  });

  it("finds a membership stored as a FHIR Practitioner/ reference", async () => {
    // The fail-OPEN case, and the reason this query cannot match bare only.
    // A row stored as `Practitioner/<id>` is invisible to a bare lookup, the
    // empty result reads as "pet parent, not staff", and a disabled
    // organisation is silently unenforced - `organization.count` is never even
    // reached. `UserService.deleteById` matches both forms for the same reason.
    mockUserOrgFindMany.mockImplementation((async (args: {
      where: { OR: { practitionerReference: string }[] };
    }) => {
      const wanted = args.where.OR.map((c) => c.practitionerReference);
      return wanted.includes("Practitioner/staff-6")
        ? [{ organizationReference: "org-3" }]
        : [];
    }) as never);
    mockOrganizationCount.mockResolvedValue(0 as never);

    await expect(blocked("staff-6")).resolves.toBe(true);
    expect(mockOrganizationCount).toHaveBeenCalledWith({
      where: { id: { in: ["org-3"] }, isActive: true },
    });
  });

  it("finds a migrated account's membership under its legacy app user id", async () => {
    // `appUserId` here is the raw SuperTokens id from the sign-in override -
    // nothing has resolved it yet, unlike every authorised request. A migrated
    // account's rows are stored under the legacy id, so querying the alias
    // alone finds nothing and lets a disabled organisation sign in.
    // authIdentity is keyed on the RECIPE user id, which differs from
    // `result.user.id` once accounts are linked - so the mapping is only
    // reachable if the hook resolves `providerUserId` as well.
    mockFindFirst.mockImplementation((async (args: {
      where: { providerUserId: string };
    }) =>
      args.where.providerUserId === "recipe-77"
        ? { appUserId: "legacy-77" }
        : null) as never);
    mockUserOrgFindMany.mockImplementation((async (args: {
      where: { OR: { practitionerReference: string }[] };
    }) => {
      const wanted = args.where.OR.map((c) => c.practitionerReference);
      return wanted.includes("legacy-77")
        ? [{ organizationReference: "org-4" }]
        : [];
    }) as never);
    mockOrganizationCount.mockResolvedValue(0 as never);

    await expect(blocked("supertokens-alias-77", "recipe-77")).resolves.toBe(
      true,
    );
  });

  it("does not double-prefix an id that already carries the Practitioner/ form", async () => {
    mockUserOrgFindMany.mockResolvedValue([] as never);
    await blocked("Practitioner/staff-8");

    expect(mockUserOrgFindMany).toHaveBeenCalledWith({
      where: {
        active: true,
        OR: [
          { practitionerReference: "staff-8" },
          { practitionerReference: "Practitioner/staff-8" },
        ],
      },
      select: { organizationReference: true },
    });
  });

  it("does not query when neither id is usable", async () => {
    await expect(blocked("   ", "  ")).resolves.toBe(false);
    expect(mockUserOrgFindMany).not.toHaveBeenCalled();
  });
});
