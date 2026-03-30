import { normalizeLabStatus } from "src/labs/status";

describe("normalizeLabStatus", () => {
  it("returns nulls for undefined or null", () => {
    expect(normalizeLabStatus(undefined)).toEqual({
      status: null,
      externalStatus: null,
    });
    expect(normalizeLabStatus(null)).toEqual({
      status: null,
      externalStatus: null,
    });
  });

  it("normalizes known status values", () => {
    expect(normalizeLabStatus("at the lab")).toEqual({
      status: "AT_THE_LAB",
      externalStatus: "at the lab",
    });

    expect(normalizeLabStatus("running")).toEqual({
      status: "RUNNING",
      externalStatus: "running",
    });

    expect(normalizeLabStatus("at-the-lab")).toEqual({
      status: "AT_THE_LAB",
      externalStatus: "at-the-lab",
    });
  });

  it("returns unknown status with external status", () => {
    expect(normalizeLabStatus("weird")).toEqual({
      status: null,
      externalStatus: "weird",
    });

    expect(normalizeLabStatus(42)).toEqual({
      status: null,
      externalStatus: "42",
    });

    expect(normalizeLabStatus(true)).toEqual({
      status: null,
      externalStatus: "true",
    });

    expect(normalizeLabStatus(10n)).toEqual({
      status: null,
      externalStatus: "10",
    });
  });

  it("returns nulls for blank strings", () => {
    expect(normalizeLabStatus("  ")).toEqual({
      status: null,
      externalStatus: null,
    });

    expect(normalizeLabStatus({})).toEqual({
      status: null,
      externalStatus: null,
    });
  });
});
