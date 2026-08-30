import { BookingPageController } from "../../src/controllers/web/booking-page.controller";
import {
  BookingPageService,
  BookingPageServiceError,
} from "../../src/services/booking-page.service";
import {
  PublicBookingError,
  PublicBookingRequestService,
} from "../../src/services/public-booking.service";

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

jest.mock("../../src/services/public-booking.service", () => {
  const actual = jest.requireActual(
    "../../src/services/public-booking.service",
  );
  return {
    ...actual,
    PublicBookingRequestService: {
      listForOrganisation: jest.fn(),
      setStatus: jest.fn(),
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

const mockedRequests = PublicBookingRequestService as unknown as {
  listForOrganisation: jest.Mock;
  setStatus: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const validBody = {
  serviceIds: ["3f6b1a2c-1111-4222-8333-444455556666"],
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

    it("passes the publish flag through when present", async () => {
      mockedService.saveConfig.mockResolvedValueOnce({});
      const req = {
        organisationId: "org-1",
        params: {},
        body: { ...validBody, publicBookingEnabled: true },
      } as never;

      await BookingPageController.saveConfig(req, createResponse() as never);

      expect(mockedService.saveConfig).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ publicBookingEnabled: true }),
      );
    });

    it("leaves publication untouched when the flag is omitted", async () => {
      mockedService.saveConfig.mockResolvedValueOnce({});
      const req = {
        organisationId: "org-1",
        params: {},
        body: validBody,
      } as never;

      await BookingPageController.saveConfig(req, createResponse() as never);

      // Saving settings must never publish a practice as a side effect.
      expect(
        mockedService.saveConfig.mock.calls[0][1].publicBookingEnabled,
      ).toBeUndefined();
    });

    it("rejects a non-boolean publish flag", async () => {
      const req = {
        organisationId: "org-1",
        params: {},
        body: { ...validBody, publicBookingEnabled: "yes" },
      } as never;
      const res = createResponse();

      await BookingPageController.saveConfig(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.saveConfig).not.toHaveBeenCalled();
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

  describe("listRequests", () => {
    it("lists the authorized organisation's requests", async () => {
      mockedRequests.listForOrganisation.mockResolvedValueOnce([]);
      const res = createResponse();

      await BookingPageController.listRequests(
        { organisationId: "org-1", params: {}, query: {} } as never,
        res as never,
      );

      expect(mockedRequests.listForOrganisation).toHaveBeenCalledWith(
        "org-1",
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("scopes on the authorized organisation, not the route param", async () => {
      mockedRequests.listForOrganisation.mockResolvedValueOnce([]);

      await BookingPageController.listRequests(
        {
          organisationId: "org-authorized",
          params: { organisationId: "org-someone-else" },
          query: {},
        } as never,
        createResponse() as never,
      );

      expect(mockedRequests.listForOrganisation).toHaveBeenCalledWith(
        "org-authorized",
        undefined,
      );
    });

    it("rejects an unknown status filter", async () => {
      const res = createResponse();

      await BookingPageController.listRequests(
        {
          organisationId: "org-1",
          params: {},
          query: { status: "PENDING_CONFIRMATION" },
        } as never,
        res as never,
      );

      // PENDING is never listable: it is an unverified claim by an anonymous
      // caller, so it must not be reachable even by asking for it.
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedRequests.listForOrganisation).not.toHaveBeenCalled();
    });

    it("400s when the middleware resolved no organisation", async () => {
      const res = createResponse();

      await BookingPageController.listRequests(
        { params: {}, query: {} } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("does not leak an unexpected failure", async () => {
      mockedRequests.listForOrganisation.mockRejectedValueOnce(
        new Error("boom"),
      );
      const res = createResponse();

      await BookingPageController.listRequests(
        { organisationId: "org-1", params: {}, query: {} } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateRequestStatus", () => {
    it("marks a request declined", async () => {
      mockedRequests.setStatus.mockResolvedValueOnce(undefined);
      const res = createResponse();

      await BookingPageController.updateRequestStatus(
        {
          organisationId: "org-1",
          params: { organisationId: "org-1", requestId: "req-1" },
          body: { status: "DECLINED" },
        } as never,
        res as never,
      );

      expect(mockedRequests.setStatus).toHaveBeenCalledWith(
        "org-1",
        "req-1",
        "DECLINED",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it.each([
      ["CONFIRMED", "a status only the public flow may set"],
      [
        "PENDING_CONFIRMATION",
        "a status that would resurrect an unconfirmed request",
      ],
      ["nonsense", "an unknown status"],
    ])("rejects %s (%s)", async (status) => {
      const res = createResponse();

      await BookingPageController.updateRequestStatus(
        {
          organisationId: "org-1",
          params: { organisationId: "org-1", requestId: "req-1" },
          body: { status },
        } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedRequests.setStatus).not.toHaveBeenCalled();
    });

    it("400s when the middleware resolved no organisation", async () => {
      const res = createResponse();

      await BookingPageController.updateRequestStatus(
        { params: { requestId: "req-1" }, body: { status: "BOOKED" } } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedRequests.setStatus).not.toHaveBeenCalled();
    });

    it("passes a cross-tenant 404 through", async () => {
      mockedRequests.setStatus.mockRejectedValueOnce(
        new PublicBookingError("Booking request not found", 404),
      );
      const res = createResponse();

      await BookingPageController.updateRequestStatus(
        {
          organisationId: "org-1",
          params: { organisationId: "org-1", requestId: "req-of-another-org" },
          body: { status: "BOOKED" },
        } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("does not leak an unexpected failure", async () => {
      mockedRequests.setStatus.mockRejectedValueOnce(new Error("boom"));
      const res = createResponse();

      await BookingPageController.updateRequestStatus(
        {
          organisationId: "org-1",
          params: { organisationId: "org-1", requestId: "req-1" },
          body: { status: "BOOKED" },
        } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
