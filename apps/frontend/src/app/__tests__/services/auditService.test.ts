import {
  getAppointmentAuditTrail,
  getCompanionAuditTrail,
} from "@/app/features/audit/services/auditService";

import { http } from "@/app/services/http";
import { logger } from "@/app/lib/logger";

jest.mock("@/app/services/http", () => ({
  http: {
    get: jest.fn(),
  },
}));

jest.mock("@/app/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const getMock = http.get as jest.Mock;

describe("audit service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAppointmentAuditTrail", () => {
    it("fetches audit trail for appointment", async () => {
      const mockEntries = [
        { id: "1", action: "created", timestamp: "2024-01-01" },
        { id: "2", action: "updated", timestamp: "2024-01-02" },
      ];
      getMock.mockResolvedValue({
        data: { entries: mockEntries },
      });

      const result = await getAppointmentAuditTrail("appt-123");

      expect(getMock).toHaveBeenCalledWith(
        "/v1/audit-trail/appointment/appt-123"
      );
      expect(result).toEqual(mockEntries);
    });

    it("throws error when appointment ID is missing", async () => {
      await expect(getAppointmentAuditTrail("")).rejects.toThrow(
        "Appointment ID missing"
      );
    });

    it("throws error when API call fails", async () => {
      getMock.mockRejectedValue(new Error("API error"));

      await expect(getAppointmentAuditTrail("appt-123")).rejects.toThrow(
        "API error"
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getCompanionAuditTrail", () => {
    it("fetches audit trail for companion", async () => {
      const mockEntries = [
        { id: "1", action: "created", timestamp: "2024-01-01" },
      ];
      getMock.mockResolvedValue({
        data: { entries: mockEntries },
      });

      const result = await getCompanionAuditTrail("companion-456");

      expect(getMock).toHaveBeenCalledWith(
        "/v1/audit-trail/companion/companion-456"
      );
      expect(result).toEqual(mockEntries);
    });

    it("throws error when companion ID is missing", async () => {
      await expect(getCompanionAuditTrail("")).rejects.toThrow(
        "CompanionId ID missing"
      );
    });

    it("throws error when API call fails", async () => {
      getMock.mockRejectedValue(new Error("API error"));

      await expect(getCompanionAuditTrail("companion-456")).rejects.toThrow(
        "API error"
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
