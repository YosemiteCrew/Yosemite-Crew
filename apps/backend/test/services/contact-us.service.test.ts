import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("ContactService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it("should successfully create a general request via prisma", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
        subject: "Help",
        status: "OPEN",
      });

      const result = await ContactService.createRequest(baseInput);

      expect(prisma.contactRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "OPEN",
            subject: "Help",
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: "pg-1", subject: "Help" }),
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
        (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
          id: "dsar-1",
          status: "OPEN",
        });

        await ContactService.createRequest(dsarInput);

        expect(prisma.contactRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              dsarDetails: expect.objectContaining({
                declarationAcceptedAt: expect.any(Date),
              }),
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
        (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
          id: "dsar-2",
          status: "OPEN",
        });

        await ContactService.createRequest(input);

        expect(prisma.contactRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              dsarDetails: expect.objectContaining({
                declarationAcceptedAt: date,
              }),
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
      phone: " 1234567890 ",
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

    it("should set subject from type and create the request via prisma", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "web-1",
        subject: "GENERAL_ENQUIRY",
        status: "OPEN",
      });

      const result = await ContactService.createWebRequest(baseWebInput);

      expect(prisma.contactRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: "GENERAL_ENQUIRY",
            email: "web@user.com",
            complaintContext: {
              fullName: "Web User",
              phone: "1234567890",
            },
            status: "OPEN",
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: "web-1", subject: "GENERAL_ENQUIRY" }),
      );
    });
  });

  // 2. listRequests
  describe("listRequests", () => {
    it("should build query based on filters", async () => {
      (prisma.contactRequest.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const filter = {
        status: "OPEN" as const,
        type: "DSAR" as const,
        organisationId: "org1",
      };
      const result = await ContactService.listRequests(filter);

      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: { status: "OPEN", type: "DSAR", organisationId: "org1" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });

    it("should handle empty filters", async () => {
      (prisma.contactRequest.findMany as jest.Mock).mockResolvedValue([]);

      await ContactService.listRequests({});

      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: undefined,
          type: undefined,
          organisationId: undefined,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
  });

  // 3. getById
  describe("getById", () => {
    it("should return document by ID via prisma", async () => {
      (prisma.contactRequest.findUnique as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const res = await ContactService.getById("pg-1");

      expect(prisma.contactRequest.findUnique).toHaveBeenCalledWith({
        where: { id: "pg-1" },
      });
      expect(res).toEqual({ id: "pg-1" });
    });
  });

  // 4. updateStatus
  describe("updateStatus", () => {
    it("should update status and return new doc via prisma", async () => {
      (prisma.contactRequest.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        status: "CLOSED",
      });

      const res = await ContactService.updateStatus("pg-1", "CLOSED");

      expect(prisma.contactRequest.update).toHaveBeenCalledWith({
        where: { id: "pg-1" },
        data: { status: "CLOSED" },
      });
      expect(res).toEqual({ id: "pg-1", status: "CLOSED" });
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
