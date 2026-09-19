import { CONTACT_MESSAGE_MAX_LENGTH } from "@yosemite-crew/types";
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

    /* #3361: the panel's intake refuses a longer message with a permanent 400,
       so a submission accepted here would be stored and never delivered. The
       assertion that prisma was not called is the point - the row must not
       exist, not merely fail to forward. */
    it("refuses a message longer than the mirror's limit without writing a row", async () => {
      await expect(
        ContactService.createWebRequest({
          ...baseWebInput,
          message: "a".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
        }),
      ).rejects.toThrow(
        `message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer`,
      );
      expect(prisma.contactRequest.create).not.toHaveBeenCalled();
    });

    it("answers 400 rather than 500 for an over-long message", async () => {
      await expect(
        ContactService.createWebRequest({
          ...baseWebInput,
          message: "a".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    /* The boundary is inclusive, and it is the trimmed text that is measured
       because that is what is stored and forwarded. */
    it("accepts a message of exactly the limit, and one that only exceeds it untrimmed", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "web-limit",
      });

      const atLimit = "a".repeat(CONTACT_MESSAGE_MAX_LENGTH);
      await expect(
        ContactService.createWebRequest({ ...baseWebInput, message: atLimit }),
      ).resolves.toEqual(expect.objectContaining({ id: "web-limit" }));

      await expect(
        ContactService.createWebRequest({
          ...baseWebInput,
          message: `  ${atLimit}  `,
        }),
      ).resolves.toEqual(expect.objectContaining({ id: "web-limit" }));

      const stored = (prisma.contactRequest.create as jest.Mock).mock
        .calls[1][0] as { data: { message: string } };
      expect(stored.data.message).toHaveLength(CONTACT_MESSAGE_MAX_LENGTH);
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

    /* #3329: the mirror forward is queued by this same insert rather than sent
       off the request path, so a submission and its forward commit together.
       Dropping the nested create is how history goes missing silently - the
       submission still stores, nothing errors, and the CRM never hears. */
    it("queues the SuperAdmin forward in the same insert as the submission", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "web-2",
      });

      await ContactService.createWebRequest(baseWebInput);

      const args = (prisma.contactRequest.create as jest.Mock).mock
        .calls[0][0] as { data: Record<string, unknown> };
      expect(args.data.superadminForward).toEqual({ create: {} });
    });

    /* The mobile path is authenticated and is not mirrored. It writes no
       complaintContext, which is also what the #3330 backfill selects on, so
       the two paths have to stay distinguishable. */
    it("does not queue a forward for the authenticated non-web path", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValue({
        id: "app-1",
      });

      await ContactService.createRequest({
        type: "GENERAL_ENQUIRY",
        source: "PMS_APP",
        subject: "Help",
        message: "Need help",
      } as any);

      const args = (prisma.contactRequest.create as jest.Mock).mock
        .calls[0][0] as { data: Record<string, unknown> };
      expect(args.data.superadminForward).toBeUndefined();
      expect(args.data.complaintContext).toBeUndefined();
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
