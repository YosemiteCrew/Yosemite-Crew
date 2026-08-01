import type { Response } from "express";

const mockGetUserRoles = jest.fn();
const mockGetAuthService = jest.fn();

jest.mock("@yosemite-crew/auth", () => ({
  getAuthService: mockGetAuthService,
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { requireSuperAdmin } from "src/middlewares/super-admin";

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };

  return res;
};

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when auth is unavailable", async () => {
    mockGetAuthService.mockReturnValue(null);
    const res = createResponse();

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication service is not enabled",
    });
  });

  it("rejects missing sessions", async () => {
    mockGetAuthService.mockReturnValue({
      getUserRoles: mockGetUserRoles,
    });
    const res = createResponse();

    await requireSuperAdmin({} as never, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockGetUserRoles.mockResolvedValue(["admin"]);
    mockGetAuthService.mockReturnValue({
      getUserRoles: mockGetUserRoles,
    });
    const res = createResponse();

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("allows superadmin users regardless of case", async () => {
    const next = jest.fn();
    mockGetUserRoles.mockResolvedValue(["SUPERADMIN"]);
    mockGetAuthService.mockReturnValue({
      getUserRoles: mockGetUserRoles,
    });

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("prefers the session role claim when present", async () => {
    const next = jest.fn();
    mockGetAuthService.mockReturnValue({
      getUserRoles: mockGetUserRoles,
    });

    await requireSuperAdmin(
      {
        authSession: {
          appUserId: "user-1",
          providerUserId: "st-user-1",
          roles: ["superadmin"],
        },
      } as never,
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });
});
