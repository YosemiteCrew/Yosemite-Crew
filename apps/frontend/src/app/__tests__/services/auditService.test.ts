import {
  getAppointmentAuditTrail,
  getCompanionAuditTrail,
} from "@/app/services/audit";

const getDataMock = jest.fn();

jest.mock("@/app/services/axios", () => ({
  getData: (...args: any[]) => getDataMock(...args),
}));

describe("audit service", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("getAppointmentAuditTrail", () => {
    it("fetches audit trail for appointment", async () => {
      const mockEntries = [
        { id: "1", action: "created", timestamp: "2024-01-01" },
        { id: "2", action: "updated", timestamp: "2024-01-02" },
      ];
      getDataMock.mockResolvedValue({
        data: { entries: mockEntries },
      });

      const result = await getAppointmentAuditTrail("appt-123");

      expect(getDataMock).toHaveBeenCalledWith(
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
      getDataMock.mockRejectedValue(new Error("API error"));

      await expect(getAppointmentAuditTrail("appt-123")).rejects.toThrow(
        "API error"
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("getCompanionAuditTrail", () => {
    it("fetches audit trail for companion", async () => {
      const mockEntries = [
        { id: "1", action: "created", timestamp: "2024-01-01" },
      ];
      getDataMock.mockResolvedValue({
        data: { entries: mockEntries },
      });

      const result = await getCompanionAuditTrail("companion-456");

      expect(getDataMock).toHaveBeenCalledWith(
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
      getDataMock.mockRejectedValue(new Error("API error"));

      await expect(getCompanionAuditTrail("companion-456")).rejects.toThrow(
        "API error"
      );
      expect(console.error).toHaveBeenCalled();
    });
  });
});
