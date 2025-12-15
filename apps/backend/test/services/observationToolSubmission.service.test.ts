import {
  ObservationToolDefinitionModel,
  ObservationToolSubmissionModel,
} from "../../src/models/observationToolDefinition";
import {
  ObservationToolSubmissionService,
  ObservationToolSubmissionServiceError,
} from "../../src/services/observationToolSubmission.service";

jest.mock("../../src/models/observationToolDefinition", () => {
  const actual = jest.requireActual(
    "../../src/models/observationToolDefinition",
  );
  return {
    ...actual,
    ObservationToolDefinitionModel: {
      findById: jest.fn(),
    },
    ObservationToolSubmissionModel: {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
    },
  };
});

const mockedDefinitionModel = ObservationToolDefinitionModel as unknown as {
  findById: jest.Mock;
};

const mockedSubmissionModel = ObservationToolSubmissionModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

describe("ObservationToolSubmissionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSubmission", () => {
    it("validates required identifiers", async () => {
      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId: "",
          companionId: "",
          filledBy: "",
          answers: {},
        } as any),
      ).rejects.toBeInstanceOf(ObservationToolSubmissionServiceError);
    });

    it("throws when tool is inactive", async () => {
      mockedDefinitionModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ isActive: false }),
      });

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId: "tool-1",
          companionId: "comp-1",
          filledBy: "parent-1",
          answers: {},
        }),
      ).rejects.toBeInstanceOf(ObservationToolSubmissionServiceError);
    });

    it("calculates score using map and points", async () => {
      mockedDefinitionModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          isActive: true,
          fields: [
            { key: "choice", scoring: { map: { yes: 3 } } },
            { key: "flag", scoring: { points: 2 } },
          ],
        }),
      });
      const doc = { _id: "sub-1" };
      mockedSubmissionModel.create.mockResolvedValueOnce(doc);

      const result = await ObservationToolSubmissionService.createSubmission({
        toolId: "tool-1",
        companionId: "comp-1",
        filledBy: "parent-1",
        answers: { choice: "yes", flag: true },
        summary: "Summary",
      });

      expect(mockedSubmissionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 5,
          summary: "Summary",
        }),
      );
      expect(result).toBe(doc);
    });
  });

  describe("linkToAppointment", () => {
    it("throws when submission is missing", async () => {
      mockedSubmissionModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          submissionId: "missing",
          appointmentId: "apt-1",
        }),
      ).rejects.toBeInstanceOf(ObservationToolSubmissionServiceError);
    });

    it("sets evaluation appointment id", async () => {
      const save = jest.fn();
      const doc = { evaluationAppointmentId: undefined, save } as any;
      mockedSubmissionModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const updated =
        await ObservationToolSubmissionService.linkToAppointment({
          submissionId: "sub-1",
          appointmentId: "apt-1",
        });

      expect(doc.evaluationAppointmentId).toBe("apt-1");
      expect(save).toHaveBeenCalled();
      expect(updated).toBe(doc);
    });
  });

  describe("getById", () => {
    it("delegates to model", async () => {
      mockedSubmissionModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ id: "1" }),
      });

      const result = await ObservationToolSubmissionService.getById("1");
      expect(result).toEqual({ id: "1" });
    });
  });

  describe("listSubmissions", () => {
    it("builds query with date range", async () => {
      const exec = jest.fn().mockResolvedValueOnce([]);
      const sort = jest.fn().mockReturnValue({ exec });
      mockedSubmissionModel.find.mockReturnValue({ sort } as any);

      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-02-01");

      await ObservationToolSubmissionService.listSubmissions({
        companionId: "comp-1",
        toolId: "tool-1",
        fromDate,
        toDate,
      });

      expect(mockedSubmissionModel.find).toHaveBeenCalledWith({
        companionId: "comp-1",
        toolId: "tool-1",
        createdAt: { $gte: fromDate, $lte: toDate },
      });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe("listForAppointment", () => {
    it("filters by evaluation appointment id", async () => {
      const exec = jest.fn().mockResolvedValueOnce([]);
      const sort = jest.fn().mockReturnValue({ exec });
      mockedSubmissionModel.find.mockReturnValueOnce({ sort } as any);

      await ObservationToolSubmissionService.listForAppointment("apt-1");

      expect(mockedSubmissionModel.find).toHaveBeenCalledWith({
        evaluationAppointmentId: "apt-1",
      });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
