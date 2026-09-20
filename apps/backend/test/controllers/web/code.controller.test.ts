import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { CodeController } from "../../../src/controllers/web/code.controller";
import {
  CodeService,
  CodeServiceError,
} from "../../../src/services/code.service";
import { ClinicalTermsService } from "../../../src/services/clinical-terms.service";
import { AtcvetService } from "../../../src/services/atcvet.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/config/prisma", () => ({ prisma: {} }));

jest.mock("../../../src/services/code.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/code.service")
  >("../../../src/services/code.service");
  return {
    ...actual,
    CodeService: {
      ...actual.CodeService,
      listEntries: jest.fn(),
      listMappings: jest.fn(),
    },
  };
});

jest.mock("../../../src/services/atcvet.service", () => ({
  AtcvetService: {
    suggestMedications: jest.fn(),
  },
}));

jest.mock("../../../src/services/clinical-terms.service", () => ({
  ClinicalTermsService: {
    suggestTerms: jest.fn(),
  },
}));

jest.mock("../../../src/utils/logger");

const mockedCodeService = jest.mocked(CodeService);
const mockedClinicalTermsService = jest.mocked(ClinicalTermsService);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

const buildRequest = (query: Record<string, unknown> = {}) =>
  ({ query }) as unknown as Request;

describe("CodeController", () => {
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildResponse();
  });

  describe("listEntries", () => {
    it("forwards normalized filters and returns the service payload", async () => {
      const rows = [{ id: "entry-1", code: "YSPEC:CANINE" }];
      mockedCodeService.listEntries.mockResolvedValue(rows as never);

      const req = buildRequest({
        system: "YOSEMITECODE",
        type: "SPECIES",
        active: "true",
        q: "canine",
        limit: "12",
      });

      await CodeController.listEntries(req, res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith({
        system: "YOSEMITECODE",
        type: "SPECIES",
        active: true,
        query: "canine",
        limit: 12,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it("passes every filter through as undefined when the query is empty", async () => {
      mockedCodeService.listEntries.mockResolvedValue([] as never);

      await CodeController.listEntries(buildRequest(), res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith({
        system: undefined,
        type: undefined,
        active: undefined,
        query: undefined,
        limit: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it.each([
      ["the string 'true'", "true", true],
      ["the string 'false'", "false", false],
      ["the boolean true", true, true],
      ["the boolean false", false, false],
      ["an unrecognised string", "yes", undefined],
      ["an empty string", "", undefined],
      ["a numeric value", 1, undefined],
      ["null", null, undefined],
    ])("maps active=%s to %s", async (_label, raw, expected) => {
      mockedCodeService.listEntries.mockResolvedValue([] as never);

      await CodeController.listEntries(buildRequest({ active: raw }), res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith(
        expect.objectContaining({ active: expected }),
      );
    });

    it.each([
      ["a numeric string", "25", 25],
      ["a decimal string", "7.5", 7.5],
      ["zero", "0", 0],
    ])("forwards limit=%s as %s", async (_label, raw, expected) => {
      mockedCodeService.listEntries.mockResolvedValue([] as never);

      await CodeController.listEntries(buildRequest({ limit: raw }), res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith(
        expect.objectContaining({ limit: expected }),
      );
    });

    it("drops a non-numeric limit rather than forwarding NaN", async () => {
      mockedCodeService.listEntries.mockResolvedValue([] as never);

      await CodeController.listEntries(buildRequest({ limit: "abc" }), res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith(
        expect.objectContaining({ limit: undefined }),
      );
    });

    it("drops an empty limit string before it reaches Number()", async () => {
      mockedCodeService.listEntries.mockResolvedValue([] as never);

      await CodeController.listEntries(buildRequest({ limit: "" }), res);

      expect(mockedCodeService.listEntries).toHaveBeenCalledWith(
        expect.objectContaining({ limit: undefined }),
      );
    });

    it("maps a CodeServiceError to its own status code and message", async () => {
      mockedCodeService.listEntries.mockRejectedValue(
        new CodeServiceError("Invalid query", 400),
      );

      await CodeController.listEntries(buildRequest({ q: "x" }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid query" });
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("preserves a non-400 CodeServiceError status", async () => {
      mockedCodeService.listEntries.mockRejectedValue(
        new CodeServiceError("Upstream unavailable", 503),
      );

      await CodeController.listEntries(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        message: "Upstream unavailable",
      });
    });

    it("logs and returns 500 for an unexpected failure", async () => {
      const failure = new Error("connection reset");
      mockedCodeService.listEntries.mockRejectedValue(failure);

      await CodeController.listEntries(buildRequest(), res);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to list code entries",
        failure,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to list code entries.",
      });
    });

    it("returns 500 for a non-Error rejection", async () => {
      mockedCodeService.listEntries.mockRejectedValue("boom");

      await CodeController.listEntries(buildRequest(), res);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to list code entries",
        "boom",
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listMappings", () => {
    it("forwards every mapping filter and returns the rows", async () => {
      const rows = [{ id: "mapping-1" }];
      mockedCodeService.listMappings.mockResolvedValue(rows as never);

      const req = buildRequest({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        active: "false",
      });

      await CodeController.listMappings(req, res);

      expect(mockedCodeService.listMappings).toHaveBeenCalledWith({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        active: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it("forwards undefined filters for an empty query", async () => {
      mockedCodeService.listMappings.mockResolvedValue([] as never);

      await CodeController.listMappings(buildRequest(), res);

      expect(mockedCodeService.listMappings).toHaveBeenCalledWith({
        sourceSystem: undefined,
        sourceCode: undefined,
        targetSystem: undefined,
        targetCode: undefined,
        active: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("ignores an unparseable active flag", async () => {
      mockedCodeService.listMappings.mockResolvedValue([] as never);

      await CodeController.listMappings(buildRequest({ active: "maybe" }), res);

      expect(mockedCodeService.listMappings).toHaveBeenCalledWith(
        expect.objectContaining({ active: undefined }),
      );
    });

    it("maps a CodeServiceError to its own status code and message", async () => {
      mockedCodeService.listMappings.mockRejectedValue(
        new CodeServiceError("Unknown system", 422),
      );

      await CodeController.listMappings(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "Unknown system" });
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("logs and returns 500 for an unexpected failure", async () => {
      const failure = new Error("pool exhausted");
      mockedCodeService.listMappings.mockRejectedValue(failure);

      await CodeController.listMappings(buildRequest(), res);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to list code mappings",
        failure,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to list code mappings.",
      });
    });
  });

  describe("suggestMedications", () => {
    const mockedAtcvetService = AtcvetService as jest.Mocked<
      typeof AtcvetService
    >;

    it("parses a full query and returns the suggestions under items", async () => {
      const items = [{ atcCode: "QJ01AA02", label: "doxycycline" }];
      mockedAtcvetService.suggestMedications.mockResolvedValue(items as never);

      const req = buildRequest({
        q: "  doxy  ",
        group: "qj",
        species: "SA",
        limit: "10",
      });

      await CodeController.suggestMedications(req, res);

      // The group is normalised to the upper-case form the codes use.
      expect(mockedAtcvetService.suggestMedications).toHaveBeenCalledWith({
        q: "doxy",
        group: "QJ",
        species: "SA",
        limit: 10,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items });
    });

    it("rejects a group that is not an ATCvet main group", async () => {
      await CodeController.suggestMedications(
        buildRequest({ group: "J01" }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedAtcvetService.suggestMedications).not.toHaveBeenCalled();
    });

    it("rejects a limit beyond the page cap", async () => {
      await CodeController.suggestMedications(
        buildRequest({ limit: "500" }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedAtcvetService.suggestMedications).not.toHaveBeenCalled();
    });

    it("returns 500 and logs when the service throws", async () => {
      mockedAtcvetService.suggestMedications.mockRejectedValue(
        new Error("boom") as never,
      );

      await CodeController.suggestMedications(buildRequest({ q: "doxy" }), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("suggestTerms", () => {
    it("parses a full query and returns the suggestions under items", async () => {
      const items = [{ ycCode: "YC:1", label: "Vomiting" }];
      mockedClinicalTermsService.suggestTerms.mockResolvedValue(items as never);

      const req = buildRequest({
        q: "  vomit  ",
        domain: "PresentingComplaint",
        species: "SA,EQUINE",
        limit: "25",
      });

      await CodeController.suggestTerms(req, res);

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith({
        q: "vomit",
        domain: "PresentingComplaint",
        species: ["SA", "EQUINE"],
        limit: 25,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items });
    });

    it("accepts an empty query and forwards all-undefined filters", async () => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(buildRequest(), res);

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith({
        q: undefined,
        domain: undefined,
        species: undefined,
        limit: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items: [] });
    });

    it("collapses a whitespace-only q to undefined", async () => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(buildRequest({ q: "   " }), res);

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined }),
      );
    });

    it("flattens a repeated species parameter, splitting embedded commas", async () => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(
        buildRequest({ species: ["SA", " LA , FARM "] }),
        res,
      );

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith(
        expect.objectContaining({ species: ["SA", "LA", "FARM"] }),
      );
    });

    it.each([
      ["an empty species string", ""],
      ["a comma-only species string", " , , "],
    ])("treats %s as no species filter", async (_label, species) => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(buildRequest({ species }), res);

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith(
        expect.objectContaining({ species: undefined }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("accepts every supported species code", async () => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(
        buildRequest({ species: "SA,LA,FARM,EXOTICS,EQUINE,AVIAN" }),
        res,
      );

      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenCalledWith(
        expect.objectContaining({
          species: ["SA", "LA", "FARM", "EXOTICS", "EQUINE", "AVIAN"],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects an unsupported species code with a 400 and the flattened issues", async () => {
      await CodeController.suggestTerms(
        buildRequest({ species: "SA,DOG" }),
        res,
      );

      expect(mockedClinicalTermsService.suggestTerms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);

      const payload = res.json.mock.calls[0][0] as {
        message: string;
        error: { fieldErrors: Record<string, string[]> };
      };
      expect(payload.message).toBe("Invalid term suggestion query.");
      expect(payload.error.fieldErrors.species).toEqual([
        "Invalid species filter.",
      ]);
    });

    it("rejects an unknown domain with a 400", async () => {
      await CodeController.suggestTerms(
        buildRequest({ domain: "NotADomain" }),
        res,
      );

      expect(mockedClinicalTermsService.suggestTerms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);

      const payload = res.json.mock.calls[0][0] as {
        error: { fieldErrors: Record<string, string[]> };
      };
      expect(payload.error.fieldErrors.domain).toBeDefined();
    });

    it.each([
      ["below the minimum", "0"],
      ["above the maximum", "51"],
      ["not a number", "abc"],
      ["not an integer", "4.5"],
    ])("rejects a limit that is %s", async (_label, limit) => {
      await CodeController.suggestTerms(buildRequest({ limit }), res);

      expect(mockedClinicalTermsService.suggestTerms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);

      const payload = res.json.mock.calls[0][0] as {
        error: { fieldErrors: Record<string, string[]> };
      };
      expect(payload.error.fieldErrors.limit).toBeDefined();
    });

    it("accepts the boundary limits 1 and 50", async () => {
      mockedClinicalTermsService.suggestTerms.mockResolvedValue([] as never);

      await CodeController.suggestTerms(buildRequest({ limit: "1" }), res);
      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 1 }),
      );

      await CodeController.suggestTerms(buildRequest({ limit: "50" }), res);
      expect(mockedClinicalTermsService.suggestTerms).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it("rejects a non-string q with a 400", async () => {
      await CodeController.suggestTerms(buildRequest({ q: 42 }), res);

      expect(mockedClinicalTermsService.suggestTerms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("maps a CodeServiceError thrown by the terms service to its status", async () => {
      mockedClinicalTermsService.suggestTerms.mockRejectedValue(
        new CodeServiceError("Terminology unavailable", 502),
      );

      await CodeController.suggestTerms(buildRequest({ q: "vomit" }), res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        message: "Terminology unavailable",
      });
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("logs and returns 500 for an unexpected failure", async () => {
      const failure = new Error("index missing");
      mockedClinicalTermsService.suggestTerms.mockRejectedValue(failure);

      await CodeController.suggestTerms(buildRequest(), res);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to suggest clinical terms",
        failure,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to suggest clinical terms.",
      });
    });
  });
});
