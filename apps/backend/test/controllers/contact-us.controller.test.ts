import { ContactController } from "../../src/controllers/app/contact-us.controller";
import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";

jest.mock("../../src/services/contact-us.service", () => {
  const actual = jest.requireActual("../../src/services/contact-us.service");
  return {
    ...actual,
    ContactService: {
      createRequest: jest.fn(),
      listRequests: jest.fn(),
      getById: jest.fn(),
      updateStatus: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

const mockedContactService = ContactService as unknown as {
  createRequest: jest.Mock;
  listRequests: jest.Mock;
  getById: jest.Mock;
  updateStatus: jest.Mock;
};

const mockedAuthUserMobileService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("ContactController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("returns 404 when mobile user is not found", async () => {
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null,
      );
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Hello",
          message: "World",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found for provided userId.",
      });
      expect(mockedContactService.createRequest).not.toHaveBeenCalled();
    });

    it("creates a contact request using resolved ids", async () => {
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: { toString: () => "parent-123" },
      });
      mockedContactService.createRequest.mockResolvedValueOnce({
        _id: { toString: () => "contact-1" },
      });
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
          email: "a@b.com",
          organisationId: "org-1",
          parentId: "body-parent",
          userId: "body-user",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(mockedContactService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
          email: "a@b.com",
          organisationId: "org-1",
          parentId: "parent-123",
          userId: "user-1",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "contact-1" });
    });

    it("handles ContactServiceError responses", async () => {
      mockedContactService.createRequest.mockRejectedValueOnce(
        new ContactServiceError("invalid", 422),
      );
      const req = {
        headers: {},
        body: {
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Subject",
          message: "Message",
        },
      } as any;
      const res = createResponse();

      await ContactController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "invalid" });
    });
  });

  describe("list", () => {
    it("returns filtered contact requests", async () => {
      const docs = [{ id: "1" }];
      mockedContactService.listRequests.mockResolvedValueOnce(docs);
      const req = {
        query: { status: "OPEN", type: "DSAR", organisationId: "org-1" },
      } as any;
      const res = createResponse();

      await ContactController.list(req as any, res as any);

      expect(mockedContactService.listRequests).toHaveBeenCalledWith({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org-1",
      });
      expect(res.json).toHaveBeenCalledWith(docs);
    });

    it("handles errors", async () => {
      mockedContactService.listRequests.mockRejectedValueOnce(
        new Error("failed"),
      );
      const req = { query: {} } as any;
      const res = createResponse();

      await ContactController.list(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("getById", () => {
    it("returns 404 when not found", async () => {
      mockedContactService.getById.mockResolvedValueOnce(null);
      const req = { params: { id: "missing" } } as any;
      const res = createResponse();

      await ContactController.getById(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("returns document when found", async () => {
      const doc = { id: "contact-1" };
      mockedContactService.getById.mockResolvedValueOnce(doc);
      const req = { params: { id: "contact-1" } } as any;
      const res = createResponse();

      await ContactController.getById(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(doc);
    });
  });

  describe("updateStatus", () => {
    it("rejects invalid status", async () => {
      const req = { params: { id: "1" }, body: { status: "INVALID" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid status value",
      });
      expect(mockedContactService.updateStatus).not.toHaveBeenCalled();
    });

    it("returns 404 when contact is missing", async () => {
      mockedContactService.updateStatus.mockResolvedValueOnce(null);
      const req = { params: { id: "1" }, body: { status: "RESOLVED" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(mockedContactService.updateStatus).toHaveBeenCalledWith(
        "1",
        "RESOLVED",
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("updates status successfully", async () => {
      const updated = { id: "1", status: "RESOLVED" };
      mockedContactService.updateStatus.mockResolvedValueOnce(updated);
      const req = { params: { id: "1" }, body: { status: "RESOLVED" } } as any;
      const res = createResponse();

      await ContactController.updateStatus(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });
});
