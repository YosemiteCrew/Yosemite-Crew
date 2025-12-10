import crypto from "node:crypto";
import helpers from "../../src/utils/helper";

describe("helpers utilities", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calculates age based on the current date", () => {
    const mockNow = new Date("2024-01-01T00:00:00Z").getTime();
    jest.spyOn(Date, "now").mockReturnValue(mockNow);

    const age = helpers.calculateAge("1994-01-01");

    expect(age).toBe(30);
  });

  it("converts 12 hour time to 24 hour string", () => {
    expect(helpers.convertTo24Hour("02:30 PM")).toBe("14:30");
    expect(helpers.convertTo24Hour("12:05 AM")).toBe("00:05");
  });

  it("builds operation outcome payload", () => {
    expect(
      helpers.operationOutcome("200", "information", "ok", "processed"),
    ).toEqual({
      resourceType: "OperationOutcome",
      issue: [
        {
          status: "200",
          severity: "information",
          code: "ok",
          diagnostics: "processed",
        },
      ],
    });
  });

  it("formats appointment date times for 12h and 24h clocks", () => {
    const result = helpers.formatAppointmentDateTime(
      "2024-09-24T15:30:00+05:30",
    );

    expect(result).toEqual({
      appointmentDate: "2024-09-24",
      appointmentTime: "3:30 PM",
      appointmentTime24: "15:30",
    });
  });
});
