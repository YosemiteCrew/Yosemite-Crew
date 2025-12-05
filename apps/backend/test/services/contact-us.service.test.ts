import ContactRequestModel from "../../src/models/contect-us";
import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";

jest.mock("../../src/models/contect-us", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

const mockedContactModel = ContactRequestModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
  findByIdAndUpdate: jest.Mock;
};

describe("ContactService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createRequest", () => {
    it("requires subject and message", async () => {
      await expect(
        ContactService.createRequest({
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "",
          message: "",
        } as any),
      ).rejects.toThrow(ContactServiceError);

      expect(mockedContactModel.create).not.toHaveBeenCalled();
    });

    it("validates DSAR details", async () => {
      await expect(
        ContactService.createRequest({
          type: "DSAR",
          source: "MOBILE_APP",
          subject: "Need my data",
          message: "Please share",
        } as any),
      ).rejects.toThrow("dsarDetails.requesterType");

      expect(mockedContactModel.create).not.toHaveBeenCalled();
    });

    it("creates DSAR request and sets declaration timestamp", async () => {
      let createdPayload: any;
      mockedContactModel.create.mockImplementationOnce(async (payload) => {
        createdPayload = payload;
        return { _id: "contact-1" } as any;
      });

      const result = await ContactService.createRequest({
        type: "DSAR",
        source: "MOBILE_APP",
        subject: "Need access",
        message: "Share my info",
        dsarDetails: {
          requesterType: "SELF",
          rightsRequested: ["ACCESS_PERSONAL_INFORMATION"],
          declarationAccepted: true,
        },
      });

      expect(mockedContactModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "OPEN",
        }),
      );
      expect(createdPayload.dsarDetails.declarationAcceptedAt).toBeInstanceOf(
        Date,
      );
      expect(result).toEqual({ _id: "contact-1" });
    });
  });

  describe("listRequests", () => {
    it("builds query filters", async () => {
      const mockLimit = jest.fn().mockResolvedValueOnce(["doc"]);
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      mockedContactModel.find.mockReturnValue({ sort: mockSort } as any);

      const result = await ContactService.listRequests({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org-1",
      });

      expect(mockedContactModel.find).toHaveBeenCalledWith({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org-1",
      });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(result).toEqual(["doc"]);
    });
  });

  describe("getById", () => {
    it("returns model find result", async () => {
      const doc = { id: "contact-1" };
      mockedContactModel.findById.mockResolvedValueOnce(doc);

      const result = await ContactService.getById("contact-1");

      expect(mockedContactModel.findById).toHaveBeenCalledWith("contact-1");
      expect(result).toBe(doc);
    });
  });

  describe("updateStatus", () => {
    it("updates status with new document returned", async () => {
      const updated = { id: "contact-1", status: "RESOLVED" };
      mockedContactModel.findByIdAndUpdate.mockResolvedValueOnce(updated);

      const result = await ContactService.updateStatus(
        "contact-1",
        "RESOLVED",
      );

      expect(mockedContactModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "contact-1",
        { status: "RESOLVED" },
        { new: true },
      );
      expect(result).toBe(updated);
    });
  });
});
