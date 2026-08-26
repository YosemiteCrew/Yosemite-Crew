import { BookingPageController } from "../../src/controllers/web/booking-page.controller";
import {
  BookingPageService,
  BookingPageServiceError,
} from "../../src/services/booking-page.service";

jest.mock("../../src/services/booking-page.service", () => {
  const actual = jest.requireActual("../../src/services/booking-page.service");
  return {
    ...actual,
    BookingPageService: {
      getConfig: jest.fn(),
      saveConfig: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedService = BookingPageService as unknown as {
  getConfig: jest.Mock;
  saveConfig: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const validBody = {
  serviceIds: ["3f6b1a2c-1111-2222-3333-444455556666"],
  bookingWindowDays: 28,
  bufferMinutes: 10,
  autoConfirm: false,
  welcomeMessage: "Book a visit.",
  replyToEmail: "front@example.com",
};

describe("BookingPageController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getConfig", () => {
    it("returns the configuration for the authorized organisation", async () => {
      mockedService.getConfig.mockResolvedValueOnce({ slug: "park-vets" });
      const req = { organisationId: "org-1", params: {} } as never;
      const res = createResponse();

      await BookingPageController.getConfig(req, res as never);

      expect(mockedService.getConfig).toHaveBeenCalledWith("org-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: { slug: "park-vets" } });
    });

    it("scopes on the authorized organisation, not the route param", async () => {
      mockedService.getConfig.mockResolvedValueOnce({});
      const req = {
        organisationId: "org-authorized",
        params: { organisationId: "org-someone-else" },
      } as never;

      await BookingPageController.getConfig(req, createResponse() as never);

      expect(mockedService.getConfig).toHaveBeenCalledWith("org-authorized");
    });

    it("400s when the middleware resolved no organisation", async () => {
      const req = { params: {} } as never;
      const res = createResponse();

      await BookingPageController.getConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.getConfig).not.toHaveBeenCalled();
    });

    it("passes a service error status through", async () => {
      mockedService.getConfig.mockRejectedValueOnce(
        new BookingPageServiceError("Organisation not found", 404),
      );
      const req = { organisationId: "org-1", params: {} } as never;
      const res = createResponse();

      await BookingPageController.getConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("does not leak an unexpected failure to the caller", async () => {
      mockedService.getConfig.mockRejectedValueOnce(
        new Error("internal detail that must not reach the caller"),
      );
      const req = { organisationId: "org-1", params: {} } as never;
      const res = createResponse();

      await BookingPageController.getConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Something went wrong",
      });
    });
  });

  describe("saveConfig", () => {
    it("persists a valid payload and returns the stored configuration", async () => {
      mockedService.saveConfig.mockResolvedValueOnce({ slug: "park-vets" });
      const req = {
        organisationId: "org-1",
        params: {},
        body: validBody,
      } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(mockedService.saveConfig).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ bookingWindowDays: 28, autoConfirm: false }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("normalises omitted optional text to null", async () => {
      mockedService.saveConfig.mockResolvedValueOnce({});
      const req = {
        organisationId: "org-1",
        params: {},
        body: {
          serviceIds: [],
          bookingWindowDays: 14,
          bufferMinutes: 0,
          autoConfirm: true,
        },
      } as never;

      await BookingPageController.saveConfig(req, createResponse() as never);

      expect(mockedService.saveConfig).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ welcomeMessage: null, replyToEmail: null }),
      );
    });

    it.each([
      ["a booking window beyond the ceiling", { bookingWindowDays: 365 }],
      ["a zero-day booking window", { bookingWindowDays: 0 }],
      ["a buffer beyond the ceiling", { bufferMinutes: 999 }],
      ["a negative buffer", { bufferMinutes: -1 }],
      ["a non-uuid service id", { serviceIds: ["not-a-uuid"] }],
      ["a malformed reply-to address", { replyToEmail: "not-an-email" }],
      ["an over-long welcome message", { welcomeMessage: "x".repeat(501) }],
      ["a missing autoConfirm flag", { autoConfirm: undefined }],
    ])("rejects %s", async (_label, override) => {
      const req = {
        organisationId: "org-1",
        params: {},
        body: { ...validBody, ...override },
      } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.saveConfig).not.toHaveBeenCalled();
    });

    it("400s when the middleware resolved no organisation", async () => {
      const req = { params: {}, body: validBody } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.saveConfig).not.toHaveBeenCalled();
    });

    it("passes a cross-tenant service rejection through as 400", async () => {
      mockedService.saveConfig.mockRejectedValueOnce(
        new BookingPageServiceError("not bookable services", 400),
      );
      const req = {
        organisationId: "org-1",
        params: {},
        body: validBody,
      } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "not bookable services",
      });
    });

    it("does not leak an unexpected failure to the caller", async () => {
      mockedService.saveConfig.mockRejectedValueOnce(new Error("boom"));
      const req = {
        organisationId: "org-1",
        params: {},
        body: validBody,
      } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Something went wrong",
      });
    });
  });
});
