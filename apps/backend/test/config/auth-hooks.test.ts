import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockFindFirst: jest.Mock = jest.fn();
const mockFindMany: jest.Mock = jest.fn();
const mockUpsert: jest.Mock = jest.fn();
const mockCreateUserIdMapping: jest.Mock = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    authIdentity: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
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
