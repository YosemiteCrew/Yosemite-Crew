// 1. Set AWS Region immediately
process.env.AWS_REGION = "us-east-1";

import { Request, Response } from "express";
import { UserController } from "../../../src/controllers/web/user.controller";
// 2. Import UserService (for type) but we will use the mock implementation
import {
  UserService,
  UserServiceError,
} from "../../../src/services/user.service";
import logger from "../../../src/utils/logger";

// --- Mocks ---
jest.mock("../../../src/utils/logger");

const mockUpdateUserName = jest.fn();
const mockSetUserRole = jest.fn();
const mockRemoveUserRole = jest.fn();
let mockResolveCanonicalUserIdImpl = jest.fn(async (value: string) => value);
function mockResolveCanonicalUserId(value: string) {
  return mockResolveCanonicalUserIdImpl(value);
}
let mockAuthService: {
  updateUserName: typeof mockUpdateUserName;
  setUserRole: typeof mockSetUserRole;
  removeUserRole: typeof mockRemoveUserRole;
} | null = null;
jest.mock("@yosemite-crew/auth", () => ({
  getAuthService: () => mockAuthService,
}));

// 3. Fix: Partially mock user.service to keep the Error class real
jest.mock("../../../src/services/user.service", () => {
  const actual = jest.requireActual("../../../src/services/user.service");
  return {
    ...actual,
    UserService: {
      create: jest.fn(),
      getById: jest.fn(),
      deleteById: jest.fn(),
      updateName: jest.fn(),
    },
    resolveCanonicalUserId: mockResolveCanonicalUserId,
  };
});

// --- Helper Types & Factory ---
type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
};

// Generic mock request factory
const createMockReq = (data: Partial<any> = {}): any => ({
  params: {},
  body: {},
  ...data,
});

const createMockRes = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("UserController", () => {
  let mockRes: MockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    /*
     * clearAllMocks resets calls but NOT implementations, so a mockResolvedValue
     * set in one test leaked into every later one. That was invisible while
     * nothing read these on the default path; `create` now looks the user up
     * first, so a leaked `getById` silently turned a creation test into a
     * repeat-provisioning test. Reset the service mocks outright and let each
     * test state its own starting point.
     */
    (UserService.create as jest.Mock).mockReset();
    (UserService.getById as jest.Mock).mockReset();
    (UserService.updateName as jest.Mock).mockReset();
    (UserService.deleteById as jest.Mock).mockReset();
    mockRes = createMockRes();
    mockAuthService = null;
    mockResolveCanonicalUserIdImpl = jest.fn(async (value: string) => value);
  });

  describe("create", () => {
    const validAuthReq = {
      userId: "user-123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
    };

    it("should return 201 and created user on success", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      (UserService.create as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(UserService.create).toHaveBeenCalledWith({
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it("prefers body names/role and syncs them to the auth provider", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const mockUser = { id: "user-123" };
      (UserService.create as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
        firstName: "SessionFirst",
        lastName: "SessionLast",
        body: {
          firstName: "BodyFirst",
          lastName: "BodyLast",
          role: "developer",
        },
      });
      await UserController.create(req, mockRes as Response);

      expect(UserService.create).toHaveBeenCalledWith({
        id: "user-123",
        email: "test@example.com",
        firstName: "BodyFirst",
        lastName: "BodyLast",
      });
      expect(mockUpdateUserName).toHaveBeenCalledWith("user-123", {
        firstName: "BodyFirst",
        lastName: "BodyLast",
      });
      expect(mockSetUserRole).toHaveBeenCalledWith("user-123", "developer");
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("falls back to session names and drops an invalid role", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
        firstName: "SessionFirst",
        lastName: "SessionLast",
        body: { role: "not a valid role!!" },
      });
      await UserController.create(req, mockRes as Response);

      expect(UserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "SessionFirst",
          lastName: "SessionLast",
        }),
      );
      expect(mockUpdateUserName).toHaveBeenCalledWith("user-123", {
        firstName: "SessionFirst",
        lastName: "SessionLast",
      });
      expect(mockSetUserRole).not.toHaveBeenCalled();
    });

    /*
     * The route is behind `requireWebAuth` and nothing else, so a role the body
     * can name is a role any signed-up account can grant itself. `superadmin`
     * is the one that matters: `requireSuperAdmin` reads exactly these roles and
     * opens `/super-admin/businesses` across every tenant. The old shape check
     * accepted it. Names must still sync, so the request is served - only the
     * role is dropped.
     */
    it.each(["superadmin", "SuperAdmin", "  superadmin  ", "owner", "admin"])(
      "never grants a role the sign-up form cannot ask for: %s",
      async (role) => {
        mockAuthService = {
          updateUserName: mockUpdateUserName,
          setUserRole: mockSetUserRole,
          removeUserRole: mockRemoveUserRole,
        };
        (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

        const req = createMockReq({
          userId: "user-123",
          email: "test@example.com",
          firstName: "SessionFirst",
          lastName: "SessionLast",
          body: { role },
        });
        await UserController.create(req, mockRes as Response);

        expect(mockSetUserRole).not.toHaveBeenCalled();
        expect(mockUpdateUserName).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(201);
      },
    );

    // The other half of the allow-list: the two roles sign-up does send still
    // reach the provider, case- and padding-insensitively, or a developer
    // sign-up silently produces an account the portal will not admit.
    it.each([
      ["developer", "developer"],
      ["Developer", "developer"],
      ["  developer  ", "developer"],
      ["member", "member"],
    ])("still grants %s as %s", async (role, expected) => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
        firstName: "SessionFirst",
        lastName: "SessionLast",
        body: { role },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockSetUserRole).toHaveBeenCalledWith("user-123", expected);
    });

    /*
     * setUserRole ADDS a role. Without clearing the previous one the account
     * holds both, and /v1/auth/me answers with whichever the role list returns
     * first - so a correction reports 200 and changes nothing observable.
     */
    it("clears the other self-assignable role before setting the new one", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "developer" },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockRemoveUserRole).toHaveBeenCalledWith("user-123", "member");
      // Never the role being set - that would race its own addition.
      expect(mockRemoveUserRole).not.toHaveBeenCalledWith(
        "user-123",
        "developer",
      );
      expect(mockSetUserRole).toHaveBeenCalledWith("user-123", "developer");
    });

    /*
     * Only the self-assignable roles are cleared. Stripping everything would
     * revoke superadmin from an admin who did nothing but re-provision a name,
     * and this endpoint must not revoke a role it cannot grant.
     */
    it("leaves roles it cannot grant alone", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "member" },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockRemoveUserRole).toHaveBeenCalledTimes(1);
      expect(mockRemoveUserRole).toHaveBeenCalledWith("user-123", "developer");
      expect(mockRemoveUserRole).not.toHaveBeenCalledWith(
        "user-123",
        "superadmin",
      );
    });

    /*
     * The sync is best-effort: a provider failure is logged and the request
     * still answers 2xx, so the client accepts it and never retries. Revoking
     * first and then failing would strip the account's only role behind a
     * success. Granting first means a failure leaves both roles - the state
     * this replaced, and repaired by the next call.
     */
    it("grants the new role before revoking the old one", async () => {
      const order: string[] = [];
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole.mockImplementation(async () => {
          order.push("set");
        }),
        removeUserRole: mockRemoveUserRole.mockImplementation(async () => {
          order.push("remove");
        }),
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "developer" },
      });
      await UserController.create(req, mockRes as Response);

      expect(order).toEqual(["set", "remove"]);
    });

    it("keeps the old role when granting the new one fails", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole.mockRejectedValue(
          new Error("provider down"),
        ),
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "developer" },
      });
      await UserController.create(req, mockRes as Response);

      // Nothing was revoked, so the account still has whatever it had.
      expect(mockRemoveUserRole).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    /*
     * The sync writes the submitted names to the auth provider on this path
     * too, so the database has to take them as well - otherwise /v1/auth/me
     * and /fhir/v1/user/:id disagree about the name with nothing to repair it.
     */
    it("updates stored names on a repeat call, not just provider metadata", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const renamed = { id: "user-123", firstName: "New", lastName: "Name" };
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError(
          "User with the same id or email already exists.",
          409,
        ),
      );
      (UserService.getById as jest.Mock).mockResolvedValue({ id: "user-123" });
      (UserService.updateName as jest.Mock).mockResolvedValue(renamed);

      const req = createMockReq({
        ...validAuthReq,
        body: { firstName: "New", lastName: "Name" },
      });
      await UserController.create(req, mockRes as Response);

      expect(UserService.updateName).toHaveBeenCalledWith({
        userId: "user-123",
        firstName: "New",
        lastName: "Name",
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(renamed);
    });

    /*
     * updateName pushes the name to the auth provider before its database
     * write and does not guard it, so a provider outage would fail a request
     * whose whole point is to be repeatable. Serve the stored row instead -
     * both stores untouched, so nothing is left half-applied.
     */
    it("stays available when the name reconciliation fails", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const existing = { id: "user-123", firstName: "Old", lastName: "Name" };
      (UserService.getById as jest.Mock).mockResolvedValue(existing);
      (UserService.updateName as jest.Mock).mockRejectedValue(
        new Error("metadata provider unavailable"),
      );

      const req = createMockReq({
        ...validAuthReq,
        body: { firstName: "New", lastName: "Name" },
      });
      await UserController.create(req, mockRes as Response);

      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(existing);
    });

    /*
     * Exactly one name is malformed, not the intentional no-body retry. The
     * creation path has always rejected it; the repeat path must not read it as
     * "no names supplied" and answer 200 to a rename that never happened.
     */
    it.each([{ firstName: "OnlyFirst" }, { lastName: "OnlyLast" }])(
      "rejects a half-supplied name: %o",
      async (body) => {
        (UserService.getById as jest.Mock).mockResolvedValue({
          id: "user-123",
        });

        const req = createMockReq({
          userId: "user-123",
          email: "test@example.com",
          body,
        });
        await UserController.create(req, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(UserService.updateName).not.toHaveBeenCalled();
        expect(UserService.create).not.toHaveBeenCalled();
      },
    );

    /*
     * deleteById is a soft delete - isActive goes false and the row stays, while
     * the profile, availability and organisation records around it are really
     * gone. Answering 200 here would report success over a hollow identity.
     */
    it("refuses to provision over a deleted account", async () => {
      (UserService.getById as jest.Mock).mockResolvedValue({
        id: "user-123",
        isActive: false,
      });

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(UserService.create).not.toHaveBeenCalled();
      expect(UserService.updateName).not.toHaveBeenCalled();
      expect(mockSetUserRole).not.toHaveBeenCalled();
    });

    it("provisions normally for an active account", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const active = { id: "user-123", isActive: true };
      (UserService.getById as jest.Mock).mockResolvedValue(active);
      (UserService.updateName as jest.Mock).mockResolvedValue(active);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    /*
     * A rejected name is the caller's problem, not an outage. Swallowing it
     * would answer 200 to a rename the service refused, and let the sync push
     * the refused name into the provider anyway - while creation rejects the
     * same payload outright.
     */
    it("propagates a rejected name instead of reporting success", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.getById as jest.Mock).mockResolvedValue({ id: "user-123" });
      (UserService.updateName as jest.Mock).mockRejectedValue(
        new UserServiceError("First name is invalid.", 400),
      );

      const req = createMockReq({
        ...validAuthReq,
        body: { firstName: "$bad", lastName: "Name" },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "First name is invalid.",
      });
      // The refused name must not reach the provider either.
      expect(mockUpdateUserName).not.toHaveBeenCalled();
    });

    it("never blocks creation on an auth provider sync failure", async () => {
      mockAuthService = {
        updateUserName: jest.fn().mockRejectedValue(new Error("provider down")),
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      await UserController.create(req, mockRes as Response);

      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("skips provider sync entirely when no auth service is configured", async () => {
      mockAuthService = null;
      (UserService.create as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      await UserController.create(req, mockRes as Response);

      expect(mockUpdateUserName).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("should return 400 if userId or email is missing", async () => {
      const req = createMockReq({ userId: "", email: "" });
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
      expect(UserService.create).not.toHaveBeenCalled();
    });

    /*
     * A 409 matches on id OR email. When no row comes back for THIS id the
     * conflict was on the email, so the row belongs to someone else - serving
     * it would hand this caller another user's record. Still a 409.
     */
    it("still returns 409 when the conflicting row is not this user's", async () => {
      // Now using the real class which the controller also uses
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError("Conflict", 409),
      );
      (UserService.getById as jest.Mock).mockResolvedValue(null);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Conflict" });
      expect(mockSetUserRole).not.toHaveBeenCalled();
    });

    /*
     * The point of making this idempotent: an account provisioned before the
     * role was sent, or with the wrong one, had no way back - the 409 returned
     * before the sync ran, so the role was whatever the first call happened to
     * set. A repeat call now corrects it.
     */
    it("syncs the role on a repeat call and returns the existing user", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const existing = { id: "user-123", email: "test@example.com" };
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError(
          "User with the same id or email already exists.",
          409,
        ),
      );
      (UserService.getById as jest.Mock).mockResolvedValue(existing);
      // The repeat path pushes the submitted names through the service so the
      // database and the provider cannot drift apart; unchanged names no-op.
      (UserService.updateName as jest.Mock).mockResolvedValue(existing);

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "developer" },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockSetUserRole).toHaveBeenCalledWith("user-123", "developer");
      // 200, not 201: nothing was created this time.
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(existing);
    });

    // The allow-list is what makes the repeat call safe, so it has to hold on
    // this path too - not only on first provisioning.
    it("still refuses a privileged role on a repeat call", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError(
          "User with the same id or email already exists.",
          409,
        ),
      );
      (UserService.getById as jest.Mock).mockResolvedValue({ id: "user-123" });

      const req = createMockReq({
        ...validAuthReq,
        body: { role: "superadmin" },
      });
      await UserController.create(req, mockRes as Response);

      expect(mockSetUserRole).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    // A non-409 UserServiceError is not "already provisioned" and must not be
    // rewritten into a success.
    it("passes a non-409 UserServiceError straight through", async () => {
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError("Invalid user id", 400),
      );

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      /*
       * Once for the up-front "is this already provisioned" lookup, and no
       * more: only a 409 triggers the race recovery, so a 400 must not be
       * quietly converted into a repeat-provisioning success.
       */
      expect(UserService.getById).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Invalid user id" });
    });

    /*
     * The repeat call the client actually makes: once `pendingSignUp` is gone
     * it posts no body, and the session carries no names either. Create would
     * reject that on name validation before ever looking for the existing row,
     * so the lookup has to come first or provisioning can never be repeated.
     */
    it("serves a repeat call that carries no names at all", async () => {
      mockAuthService = {
        updateUserName: mockUpdateUserName,
        setUserRole: mockSetUserRole,
        removeUserRole: mockRemoveUserRole,
      };
      const existing = { id: "user-123", email: "test@example.com" };
      (UserService.getById as jest.Mock).mockResolvedValue(existing);

      const req = createMockReq({
        userId: "user-123",
        email: "test@example.com",
      });
      await UserController.create(req, mockRes as Response);

      expect(UserService.create).not.toHaveBeenCalled();
      // Nothing to write, so the stored names are left alone rather than cleared.
      expect(UserService.updateName).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(existing);
    });

    it("should return 500 and log error on generic exception", async () => {
      const error = new Error("Database Fail");
      (UserService.create as jest.Mock).mockRejectedValue(error);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith("Failed to create user", error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to create user.",
      });
    });
  });

  describe("getById", () => {
    it("should return 401 when auth context is missing", async () => {
      const req = createMockReq({ params: { id: "123" }, userId: undefined });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
      expect(UserService.getById).not.toHaveBeenCalled();
    });

    it("should return 403 when requesting another user's record", async () => {
      const req = createMockReq({
        params: { id: "123" },
        userId: "different-user",
      });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You can only view your own user.",
      });
      expect(UserService.getById).not.toHaveBeenCalled();
    });

    it("should return 200 and user if found", async () => {
      const mockUser = { id: "123", name: "Test" };
      (UserService.getById as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.getById(req, mockRes as Response);

      expect(UserService.getById).toHaveBeenCalledWith("123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it("should accept a supertokens alias when both ids resolve to the same user", async () => {
      mockResolveCanonicalUserIdImpl.mockImplementation(
        async (value: string) => (value === "st-user-1" ? "123" : value),
      );
      const mockUser = { id: "123", name: "Alias Test" };
      (UserService.getById as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: "st-user-1" }, userId: "123" });
      await UserController.getById(req, mockRes as Response);

      expect(UserService.getById).toHaveBeenCalledWith("st-user-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 if user not found", async () => {
      (UserService.getById as jest.Mock).mockResolvedValue(null);

      const req = createMockReq({ params: { id: "999" }, userId: "999" });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("should return 401 when auth context is missing userId", async () => {
      const req = createMockReq({ params: { id: "123" }, userId: undefined });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
      expect(UserService.getById).not.toHaveBeenCalled();
    });

    it("should return 403 when requesting a different user", async () => {
      const req = createMockReq({
        params: { id: "target-user" },
        userId: "123",
      });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You can only view your own user.",
      });
      expect(UserService.getById).not.toHaveBeenCalled();
    });

    it("should handle UserServiceError", async () => {
      (UserService.getById as jest.Mock).mockRejectedValue(
        new UserServiceError("Bad Request", 400),
      );

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Bad Request" });
    });

    it("should handle generic errors", async () => {
      const error = new Error("DB Error");
      (UserService.getById as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.getById(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve user",
        error,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteById", () => {
    it("should return 200 if deletion successful", async () => {
      (UserService.deleteById as jest.Mock).mockResolvedValue(true);

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.deleteById(req, mockRes as Response);

      expect(UserService.deleteById).toHaveBeenCalledWith("123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User deleted successfully.",
      });
    });

    it("should return 400 if id param is missing", async () => {
      const req = createMockReq({ params: { id: "" }, userId: "123" });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User id is required.",
      });
      expect(UserService.deleteById).not.toHaveBeenCalled();
    });

    it("should return 401 when auth context is missing userId", async () => {
      const req = createMockReq({ params: { id: "123" }, userId: undefined });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
      expect(UserService.deleteById).not.toHaveBeenCalled();
    });

    it("should return 403 when deleting a different user", async () => {
      const req = createMockReq({
        params: { id: "target-user" },
        userId: "123",
      });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You can only delete your own user.",
      });
      expect(UserService.deleteById).not.toHaveBeenCalled();
    });

    it("should return 404 if user not found (delete returned false)", async () => {
      (UserService.deleteById as jest.Mock).mockResolvedValue(false);

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("should handle UserServiceError", async () => {
      (UserService.deleteById as jest.Mock).mockRejectedValue(
        new UserServiceError("Forbidden", 403),
      );

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should handle generic errors", async () => {
      const error = new Error("Fail");
      (UserService.deleteById as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({ params: { id: "123" }, userId: "123" });
      await UserController.deleteById(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith("Failed to delete user", error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateName", () => {
    it("should return 200 and updated user on success", async () => {
      const mockUpdated = { firstName: "John", lastName: "Smith" };
      (UserService.updateName as jest.Mock).mockResolvedValue(mockUpdated);

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "John", lastName: "Smith" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(UserService.updateName).toHaveBeenCalledWith({
        userId: "user-123",
        firstName: "John",
        lastName: "Smith",
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
    });

    it("should return 401 if userId is missing from auth context", async () => {
      const req = createMockReq({
        userId: undefined,
        body: { firstName: "John", lastName: "Smith" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
    });

    it("should return 400 if firstName or lastName is missing", async () => {
      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "First name and last name are required.",
      });
    });

    it("should handle UserServiceError", async () => {
      (UserService.updateName as jest.Mock).mockRejectedValue(
        new UserServiceError("Validation Error", 422),
      );

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "A", lastName: "B" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(422);
    });

    it("should handle generic errors", async () => {
      const error = new Error("DB Error");
      (UserService.updateName as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "A", lastName: "B" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update user name",
        error,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
