import { describe, expect, it } from "@jest/globals";
import {
  calendarPrefillBaseSchema,
  parseTristateFlag,
  utcDateStringSchema,
} from "../../../../src/controllers/web/shared/catalog-service.schemas";

describe("catalog-service shared schemas", () => {
  describe("utcDateStringSchema", () => {
    it("accepts a strict YYYY-MM-DD date and trims surrounding whitespace", () => {
      expect(utcDateStringSchema.parse(" 2026-04-01 ")).toBe("2026-04-01");
    });

    it("rejects unparseable date strings", () => {
      // Parity with the controllers' historical inline validation: dayjs
      // without the customParseFormat plugin parses leniently, so only
      // strings dayjs cannot parse at all are rejected here.
      expect(utcDateStringSchema.safeParse("not-a-date").success).toBe(false);
      expect(utcDateStringSchema.safeParse("").success).toBe(false);
    });
  });

  describe("calendarPrefillBaseSchema", () => {
    const validPayload = {
      organisationId: "org-1",
      date: "2026-04-01",
      minuteOfDay: 540,
    };

    it("accepts a valid payload with an optional leadId", () => {
      expect(calendarPrefillBaseSchema.parse(validPayload)).toEqual(
        validPayload,
      );
      expect(
        calendarPrefillBaseSchema.parse({ ...validPayload, leadId: "lead-1" }),
      ).toEqual({ ...validPayload, leadId: "lead-1" });
    });

    it("rejects out-of-range minuteOfDay values", () => {
      expect(
        calendarPrefillBaseSchema.safeParse({
          ...validPayload,
          minuteOfDay: 24 * 60,
        }).success,
      ).toBe(false);
      expect(
        calendarPrefillBaseSchema.safeParse({
          ...validPayload,
          minuteOfDay: -1,
        }).success,
      ).toBe(false);
    });

    it("rejects a missing organisationId or invalid date", () => {
      expect(
        calendarPrefillBaseSchema.safeParse({
          date: "2026-04-01",
          minuteOfDay: 0,
        }).success,
      ).toBe(false);
      expect(
        calendarPrefillBaseSchema.safeParse({
          ...validPayload,
          date: "yesterday",
        }).success,
      ).toBe(false);
    });
  });

  describe("parseTristateFlag", () => {
    it("maps the query tri-state onto boolean | undefined", () => {
      expect(parseTristateFlag("true")).toBe(true);
      expect(parseTristateFlag("false")).toBe(false);
      expect(parseTristateFlag(undefined)).toBeUndefined();
    });
  });
});
