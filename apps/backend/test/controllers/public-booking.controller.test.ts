import { PublicBookingController } from "../../src/controllers/app/public-booking.controller";
import {
  PublicBookingError,
  PublicBookingRequestService,
  PublicBookingService,
  resolveSlug,
} from "../../src/services/public-booking.service";

jest.mock("../../src/services/public-booking.service", () => {
  const actual = jest.requireActual(
    "../../src/services/public-booking.service",
  );
  return {
    ...actual,
    resolveSlug: jest.fn(),
    PublicBookingService: { getPractice: jest.fn(), getSlots: jest.fn() },
    PublicBookingRequestService: { submit: jest.fn(), confirm: jest.fn() },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedResolveSlug = resolveSlug as jest.Mock;
const mockedService = PublicBookingService as unknown as {
  getPractice: jest.Mock;
  getSlots: jest.Mock;
};
const mockedRequests = PublicBookingRequestService as unknown as {
  submit: jest.Mock;
  confirm: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const SERVICE_ID = "3f6b1a2c-1111-2222-3333-444455556666";

const validBody = {
  serviceId: SERVICE_ID,
  date: "2026-09-01",
  startTime: "09:00",
  ownerName: "Sam Owner",
  ownerEmail: "sam@example.com",
  ownerPhone: "+49 30 1234",
  petName: "Rex",
  petSpecies: "Dog",
  concern: "Limping",
  consent: true,
};

describe("PublicBookingController", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getPractice", () => {
    it("returns the practice for a current slug", async () => {
      mockedResolveSlug.mockResolvedValueOnce({ kind: "current" });
      mockedService.getPractice.mockResolvedValueOnce({
        name: "Park Veterinary",
      });
      const res = createResponse();

      await PublicBookingController.getPractice(
        { params: { slug: "park-veterinary" } } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { name: "Park Veterinary" },
      });
    });

    it("tells the caller where to go for a retired slug instead of 404ing", async () => {
      mockedResolveSlug.mockResolvedValueOnce({
        kind: "retired",
        slug: "new-name",
      });
      const res = createResponse();

      await PublicBookingController.getPractice(
        { params: { slug: "old-name" } } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { redirectTo: "new-name" },
      });
      expect(mockedService.getPractice).not.toHaveBeenCalled();
    });

    it("passes a service 404 through unchanged", async () => {
      mockedResolveSlug.mockRejectedValueOnce(
        new PublicBookingError("Not found", 404),
      );
      const res = createResponse();

      await PublicBookingController.getPractice(
        { params: { slug: "nope" } } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("never lets an unexpected failure describe the system to the caller", async () => {
      mockedResolveSlug.mockRejectedValueOnce(
        new Error('relation "PublicBookingRequest" violates constraint xyz'),
      );
      const res = createResponse();

      await PublicBookingController.getPractice(
        { params: { slug: "x" } } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Something went wrong",
      });
    });
  });

  describe("getSlots", () => {
    it("returns windows for a valid query", async () => {
      mockedService.getSlots.mockResolvedValueOnce({ windows: [] });
      const res = createResponse();

      await PublicBookingController.getSlots(
        {
          params: { slug: "park-veterinary" },
          query: { serviceId: SERVICE_ID, date: "2026-09-01" },
        } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("passes a service error through and hides an unexpected one", async () => {
      mockedService.getSlots.mockRejectedValueOnce(
        new PublicBookingError("Date outside the booking window", 400),
      );
      const res = createResponse();
      const req = {
        params: { slug: "park-veterinary" },
        query: { serviceId: SERVICE_ID, date: "2026-09-01" },
      } as never;

      await PublicBookingController.getSlots(req, res as never);
      expect(res.status).toHaveBeenCalledWith(400);

      mockedService.getSlots.mockRejectedValueOnce(
        new Error("connection lost"),
      );
      const res2 = createResponse();
      await PublicBookingController.getSlots(req, res2 as never);
      expect(res2.status).toHaveBeenCalledWith(500);
      expect(res2.json).toHaveBeenCalledWith({
        message: "Something went wrong",
      });
    });

    it.each([
      [
        "a non-uuid service id",
        { serviceId: "not-a-uuid", date: "2026-09-01" },
      ],
      ["a malformed date", { serviceId: SERVICE_ID, date: "01/09/2026" }],
      ["a missing date", { serviceId: SERVICE_ID }],
    ])("rejects %s before reaching the service", async (_label, query) => {
      const res = createResponse();

      await PublicBookingController.getSlots(
        { params: { slug: "park-veterinary" }, query } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.getSlots).not.toHaveBeenCalled();
    });
  });

  describe("submitRequest", () => {
    it("accepts a valid request with 202 and no identifier", async () => {
      mockedRequests.submit.mockResolvedValueOnce(undefined);
      const res = createResponse();

      await PublicBookingController.submitRequest(
        { params: { slug: "park-veterinary" }, body: validBody } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(202);
      const payload = res.json.mock.calls[0][0];
      // No id: an anonymous caller must not receive a handle to something they
      // have not proved they own.
      expect(Object.keys(payload)).toEqual(["message"]);
    });

    it("normalises omitted optional fields to null", async () => {
      mockedRequests.submit.mockResolvedValueOnce(undefined);
      const {
        ownerPhone: _phone,
        concern: _concern,
        ...withoutOptionals
      } = validBody;

      await PublicBookingController.submitRequest(
        {
          params: { slug: "park-veterinary" },
          body: withoutOptionals,
        } as never,
        createResponse() as never,
      );

      expect(mockedRequests.submit).toHaveBeenCalledWith(
        "park-veterinary",
        expect.objectContaining({ ownerPhone: null, concern: null }),
      );
    });

    it.each([
      ["a missing consent tick", { consent: undefined }],
      ["a refused consent tick", { consent: false }],
      ["a non-uuid service id", { serviceId: "../../etc" }],
      ["a malformed email", { ownerEmail: "not-an-email" }],
      ["a malformed start time", { startTime: "9am" }],
      ["a 25th hour", { startTime: "25:00" }],
      ["an empty pet name", { petName: "" }],
      ["an over-long concern", { concern: "x".repeat(1001) }],
      ["an over-long owner name", { ownerName: "x".repeat(121) }],
    ])("rejects %s", async (_label, override) => {
      const res = createResponse();

      await PublicBookingController.submitRequest(
        {
          params: { slug: "park-veterinary" },
          body: { ...validBody, ...override },
        } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedRequests.submit).not.toHaveBeenCalled();
    });

    it("passes a taken-slot conflict through", async () => {
      mockedRequests.submit.mockRejectedValueOnce(
        new PublicBookingError("That time is no longer available", 409),
      );
      const res = createResponse();

      await PublicBookingController.submitRequest(
        { params: { slug: "park-veterinary" }, body: validBody } as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("confirmRequest", () => {
    it("confirms and returns the practice", async () => {
      mockedRequests.confirm.mockResolvedValueOnce({
        practiceName: "Park Veterinary",
        slug: "park-veterinary",
      });
      const res = createResponse();

      await PublicBookingController.confirmRequest(
        { body: { token: "abc" } } as never,
        res as never,
      );

      expect(mockedRequests.confirm).toHaveBeenCalledWith("abc");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("treats a non-string token as an empty one and lets the service refuse it", async () => {
      mockedRequests.confirm.mockRejectedValueOnce(
        new PublicBookingError("Not found", 404),
      );
      const res = createResponse();

      await PublicBookingController.confirmRequest(
        { body: { token: { not: "" } } } as never,
        res as never,
      );

      expect(mockedRequests.confirm).toHaveBeenCalledWith("");
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("handles a missing body without throwing", async () => {
      mockedRequests.confirm.mockRejectedValueOnce(
        new PublicBookingError("Not found", 404),
      );
      const res = createResponse();

      await PublicBookingController.confirmRequest({} as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
