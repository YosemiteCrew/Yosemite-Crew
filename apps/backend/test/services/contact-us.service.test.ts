import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";
import ContactRequestModel from "../../src/models/contect-us";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

// --- Mocks ---
jest.mock("../../src/models/contect-us");
jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

describe("ContactService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  // 1. createRequest
  describe("createRequest", () => {
    const baseInput: any = {
      type: "GENERAL_ENQUIRY",
      source: "MOBILE_APP",
      subject: "Help",
      message: "I need help",
    };

    it("should throw error if subject or message is missing", async () => {
      await expect(
        ContactService.createRequest({ ...baseInput, subject: "" }),
      ).rejects.toThrow("subject and message are required");

      await expect(
        ContactService.createRequest({ ...baseInput, message: "" }),
      ).rejects.toThrow("subject and message are required");
    });

    it("should successfully create a general request", async () => {
      (ContactRequestModel.create as jest.Mock).mockResolvedValue({
        ...baseInput,
        status: "OPEN",
        _id: "123",
      });

      const result = await ContactService.createRequest(baseInput);

      expect(ContactRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "OPEN",
          subject: "Help",
        }),
      );
      expect(result).toEqual(expect.objectContaining({ _id: "123" }));
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await ContactService.createRequest(baseInput);

      expect(prisma.contactRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "OPEN" }),
        }),
      );
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors", async () => {
      (ContactRequestModel.create as jest.Mock).mockResolvedValue({
        ...baseInput,
        status: "OPEN",
        _id: { toString: () => "mongo-1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.contactRequest.create as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await ContactService.createRequest(baseInput);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ContactRequest",
        expect.any(Error),
      );
    });

    describe("DSAR Validations", () => {
      const dsarInput: any = {
        ...baseInput,
        type: "DSAR",
        dsarDetails: {
          requesterType: "DATA_SUBJECT",
          declarationAccepted: true,
        },
      };

      it("should throw if dsarDetails.requesterType is missing", async () => {
        const invalidDsar = { ...dsarInput, dsarDetails: {} };
        await expect(ContactService.createRequest(invalidDsar)).rejects.toThrow(
          "DSAR requests must include dsarDetails.requesterType",
        );
      });

      it("should throw if declarationAccepted is false", async () => {
        const invalidDsar = {
          ...dsarInput,
          dsarDetails: {
            requesterType: "DATA_SUBJECT",
            declarationAccepted: false,
          },
        };
        await expect(ContactService.createRequest(invalidDsar)).rejects.toThrow(
          "DSAR declaration must be accepted",
        );
      });

      it("should auto-populate declarationAcceptedAt if missing", async () => {
        (ContactRequestModel.create as jest.Mock).mockResolvedValue({
          ...dsarInput,
          status: "OPEN",
        });

        await ContactService.createRequest(dsarInput);

        expect(ContactRequestModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            dsarDetails: expect.objectContaining({
              declarationAcceptedAt: expect.any(Date),
            }),
          }),
        );
      });

      it("should respect provided declarationAcceptedAt", async () => {
        const date = new Date("2023-01-01");
        const input = {
          ...dsarInput,
          dsarDetails: {
            ...dsarInput.dsarDetails,
            declarationAcceptedAt: date,
          },
        };
        (ContactRequestModel.create as jest.Mock).mockResolvedValue(input);

        await ContactService.createRequest(input);

        expect(ContactRequestModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            dsarDetails: expect.objectContaining({
              declarationAcceptedAt: date,
            }),
          }),
        );
      });
    });
  });

  describe("createWebRequest", () => {
    const baseWebInput: any = {
      type: "GENERAL_ENQUIRY",
      source: "PMS_WEB",
      message: "Need help",
      fullName: "Web User",
      email: "web@user.com",
    };

    it("should require message, fullName, and email", async () => {
      await expect(
        ContactService.createWebRequest({ ...baseWebInput, message: "" }),
      ).rejects.toThrow("message is required");

      await expect(
        ContactService.createWebRequest({ ...baseWebInput, fullName: "" }),
      ).rejects.toThrow("fullName is required");

      await expect(
        ContactService.createWebRequest({ ...baseWebInput, email: "" }),
      ).rejects.toThrow("email is required");
    });

    it("should set subject from type and create the request", async () => {
      (ContactRequestModel.create as jest.Mock).mockResolvedValue({
        ...baseWebInput,
        subject: "GENERAL_ENQUIRY",
        status: "OPEN",
        _id: "web-1",
      });

      const result = await ContactService.createWebRequest(baseWebInput);

      expect(ContactRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "GENERAL_ENQUIRY",
          fullName: "Web User",
          email: "web@user.com",
          status: "OPEN",
        }),
      );
      expect(result).toEqual(expect.objectContaining({ _id: "web-1" }));
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await ContactService.createWebRequest(baseWebInput);

      expect(prisma.contactRequest.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1" });
    });
  });

  // 2. listRequests
  describe("listRequests", () => {
    it("should build query based on filters", async () => {
      const mockChain = {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(["doc1", "doc2"]),
        }),
      };
      (ContactRequestModel.find as jest.Mock).mockReturnValue(mockChain);

      const filter = {
        status: "OPEN" as const,
        type: "DSAR" as const,
        organisationId: "org1",
      };
      const result = await ContactService.listRequests(filter);

      expect(ContactRequestModel.find).toHaveBeenCalledWith({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org1",
      });
      expect(result).toEqual(["doc1", "doc2"]);
    });

    it("should handle empty filters", async () => {
      const mockChain = {
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      };
      (ContactRequestModel.find as jest.Mock).mockReturnValue(mockChain);

      await ContactService.listRequests({});

      expect(ContactRequestModel.find).toHaveBeenCalledWith({});
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.contactRequest.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const result = await ContactService.listRequests({
        status: "OPEN",
      });

      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: { status: "OPEN", type: undefined, organisationId: undefined },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  // 3. getById
  describe("getById", () => {
    it("should return document by ID", async () => {
      (ContactRequestModel.findById as jest.Mock).mockResolvedValue({
        _id: "123",
      });
      const res = await ContactService.getById("123");
      expect(res).toEqual({ _id: "123" });
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.contactRequest.findUnique as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const res = await ContactService.getById("pg-1");
      expect(res).toEqual({ id: "pg-1" });
    });
  });

  // 4. updateStatus
  describe("updateStatus", () => {
    it("should update status and return new doc", async () => {
      (ContactRequestModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        _id: "123",
        status: "CLOSED",
      });

      const res = await ContactService.updateStatus("123", "CLOSED");

      expect(ContactRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "123",
        { status: "CLOSED" },
        { new: true },
      );
      expect(res).toEqual({ _id: "123", status: "CLOSED" });
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.contactRequest.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        status: "CLOSED",
      });

      const res = await ContactService.updateStatus("pg-1", "CLOSED");
      expect(res).toEqual({ id: "pg-1", status: "CLOSED" });
      expect(prisma.contactRequest.update).toHaveBeenCalledWith({
        where: { id: "pg-1" },
        data: { status: "CLOSED" },
      });
    });

    it("handles dual-write errors", async () => {
      (ContactRequestModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        _id: "123",
        status: "OPEN",
      });
      (prisma.contactRequest.updateMany as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await ContactService.updateStatus("123", "CLOSED");

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ContactRequest",
        expect.any(Error),
      );
    });
  });

  // 5. Error Class
  describe("ContactServiceError", () => {
    it("should default status code to 400", () => {
      const err = new ContactServiceError("msg");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("ContactServiceError");
    });
  });
});
