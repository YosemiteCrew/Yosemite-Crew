jest.mock("src/services/task-recommendation.service", () => ({
  TaskRecommendationService: { forCompanion: jest.fn() },
  TaskRecommendationError: class extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import type { Request, Response } from "express";
import { TaskRecommendationController } from "src/controllers/app/task-recommendation.controller";
import {
  TaskRecommendationError,
  TaskRecommendationService,
} from "src/services/task-recommendation.service";

const forCompanion = TaskRecommendationService.forCompanion as jest.Mock;

const run = async (patientId = "pat-1") => {
  const req = { params: { patientId } } as unknown as Request;
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) } as unknown as Response;
  await TaskRecommendationController.listForCompanion(req, res);
  return { res, json };
};

beforeEach(() => jest.clearAllMocks());

describe("TaskRecommendationController.listForCompanion", () => {
  it("returns the recommendations with a disclaimer alongside them", async () => {
    forCompanion.mockResolvedValue([{ ruleId: "r1" }]);

    const { res, json } = await run();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = json.mock.calls[0][0];
    expect(payload.recommendations).toEqual([{ ruleId: "r1" }]);
    expect(typeof payload.disclaimer).toBe("string");
  });

  it("sends the disclaimer from the server, not from the app bundle", async () => {
    // The wording is the part most likely to need correcting - by counsel, or
    // after a vet reads it. Shipping it in the response means that correction
    // does not wait out mobile adoption, which is the same reason the rules
    // themselves are server-side.
    forCompanion.mockResolvedValue([]);

    const { json } = await run();
    const { disclaimer } = json.mock.calls[0][0];

    expect(disclaimer).toMatch(/not a diagnosis/i);
    expect(disclaimer).toMatch(/ask them/i);
  });

  it("still returns the disclaimer when there is nothing to recommend", async () => {
    forCompanion.mockResolvedValue([]);

    const { json } = await run();

    expect(json.mock.calls[0][0].recommendations).toEqual([]);
    expect(json.mock.calls[0][0].disclaimer).toBeTruthy();
  });

  it("passes a service error's own status through", async () => {
    forCompanion.mockRejectedValue(
      new TaskRecommendationError("Companion not found.", 404),
    );

    const { res, json } = await run("nope");

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Companion not found." });
  });

  it("does not leak an unexpected error to the caller", async () => {
    forCompanion.mockRejectedValue(
      new Error("connection string: postgres://u:p@h/db"),
    );

    const { res, json } = await run();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: "Unable to load recommendations.",
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain("postgres://");
  });
});
