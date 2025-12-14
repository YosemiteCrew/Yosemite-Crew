import {
  ObservationToolDefinitionController,
  ObservationToolSubmissionController,
} from "../../src/controllers/web/observationTool.controller";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";
import {
  ObservationToolSubmissionService,
  ObservationToolSubmissionServiceError,
} from "../../src/services/observationToolSubmission.service";

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/observationToolDefinition.service", () => {
  const actual = jest.requireActual(
    "../../src/services/observationToolDefinition.service",
  );
  return {
    ...actual,
    ObservationToolDefinitionService: {
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
    },
  };
});

jest.mock("../../src/services/observationToolSubmission.service", () => {
  const actual = jest.requireActual(
    "../../src/services/observationToolSubmission.service",
  );
  return {
    ...actual,
    ObservationToolSubmissionService: {
      createSubmission: jest.fn(),
      listSubmissions: jest.fn(),
      getById: jest.fn(),
      linkToAppointment: jest.fn(),
      listForAppointment: jest.fn(),
    },
  };
});

const mockedAuthUser = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};
const mockedDefinitionService = ObservationToolDefinitionService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  archive: jest.Mock;
  list: jest.Mock;
  getById: jest.Mock;
};
const mockedSubmissionService = ObservationToolSubmissionService as unknown as {
  createSubmission: jest.Mock;
  listSubmissions: jest.Mock;
  getById: jest.Mock;
  linkToAppointment: jest.Mock;
  listForAppointment: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("ObservationToolDefinitionController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a tool definition", async () => {
    mockedDefinitionService.create.mockResolvedValueOnce({ id: "tool-1" });
    const req = { body: { name: "Tool" } } as any;
    const res = createResponse();

    await ObservationToolDefinitionController.create(req as any, res as any);

    expect(mockedDefinitionService.create).toHaveBeenCalledWith({ name: "Tool" });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "tool-1" });
  });

  it("handles service errors on update", async () => {
    mockedDefinitionService.update.mockRejectedValueOnce(
      new ObservationToolDefinitionServiceError("bad", 422),
    );
    const res = createResponse();

    await ObservationToolDefinitionController.update(
      { params: { toolId: "tool-1" }, body: {} } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ message: "bad" });
  });

  it("archives definitions", async () => {
    const res = createResponse();

    await ObservationToolDefinitionController.archive(
      { params: { toolId: "tool-1" } } as any,
      res as any,
    );

    expect(mockedDefinitionService.archive).toHaveBeenCalledWith("tool-1");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("lists definitions with filters", async () => {
    const docs = [{ id: "1" }];
    mockedDefinitionService.list.mockResolvedValueOnce(docs);
    const req = {
      query: { category: "cat", onlyActive: "true" },
    } as any;
    const res = createResponse();

    await ObservationToolDefinitionController.list(req as any, res as any);

    expect(mockedDefinitionService.list).toHaveBeenCalledWith({
      category: "cat",
      onlyActive: true,
    });
    expect(res.json).toHaveBeenCalledWith(docs);
  });
});

describe("ObservationToolSubmissionController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects unauthenticated mobile submissions", async () => {
    const res = createResponse();
    await ObservationToolSubmissionController.createFromMobile(
      { headers: {}, params: { toolId: "tool-1" }, body: {} } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthenticated" });
  });

  it("rejects when parent id is missing", async () => {
    mockedAuthUser.getByProviderUserId.mockResolvedValueOnce({});
    const res = createResponse();

    await ObservationToolSubmissionController.createFromMobile(
      {
        headers: { "x-user-id": "provider-1" },
        params: { toolId: "tool-1" },
        body: {},
      } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Parent not found" });
  });

  it("creates submission from mobile", async () => {
    mockedAuthUser.getByProviderUserId.mockResolvedValueOnce({
      parentId: { toString: () => "parent-1" },
    });
    mockedSubmissionService.createSubmission.mockResolvedValueOnce({
      id: "sub-1",
    });
    const req = {
      headers: { "x-user-id": "provider-1" },
      params: { toolId: "tool-1" },
      body: {
        companionId: "comp-1",
        taskId: "task-1",
        answers: { a: 1 },
        summary: "Summary",
      },
    } as any;
    const res = createResponse();

    await ObservationToolSubmissionController.createFromMobile(
      req as any,
      res as any,
    );

    expect(mockedSubmissionService.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "tool-1",
        companionId: "comp-1",
        taskId: "task-1",
        filledBy: "parent-1",
        answers: { a: 1 },
        summary: "Summary",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "sub-1" });
  });

  it("handles service errors from createFromMobile", async () => {
    mockedAuthUser.getByProviderUserId.mockResolvedValueOnce({
      parentId: { toString: () => "parent-1" },
    });
    mockedSubmissionService.createSubmission.mockRejectedValueOnce(
      new ObservationToolSubmissionServiceError("bad", 422),
    );
    const res = createResponse();

    await ObservationToolSubmissionController.createFromMobile(
      {
        headers: { "x-user-id": "provider-1" },
        params: { toolId: "tool-1" },
        body: { companionId: "c1", answers: {} },
      } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ message: "bad" });
  });

  it("lists submissions for PMS", async () => {
    const docs = [{ id: "1" }];
    mockedSubmissionService.listSubmissions.mockResolvedValueOnce(docs);
    const req = {
      query: {
        companionId: "comp-1",
        toolId: "tool-1",
        fromDate: "2024-01-01",
        toDate: "2024-02-01",
      },
    } as any;
    const res = createResponse();

    await ObservationToolSubmissionController.listForPms(
      req as any,
      res as any,
    );

    expect(mockedSubmissionService.listSubmissions).toHaveBeenCalledWith({
      companionId: "comp-1",
      toolId: "tool-1",
      fromDate: new Date("2024-01-01"),
      toDate: new Date("2024-02-01"),
    });
    expect(res.json).toHaveBeenCalledWith(docs);
  });

  it("returns 404 when submission is missing", async () => {
    mockedSubmissionService.getById.mockResolvedValueOnce(null);
    const res = createResponse();

    await ObservationToolSubmissionController.getById(
      { params: { submissionId: "sub-1" } } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Observation submission not found",
    });
  });

  it("links submission to appointment", async () => {
    mockedSubmissionService.linkToAppointment.mockResolvedValueOnce({
      id: "sub-1",
    });
    const res = createResponse();

    await ObservationToolSubmissionController.linkAppointment(
      {
        params: { submissionId: "sub-1" },
        body: { appointmentId: "apt-1" },
      } as any,
      res as any,
    );

    expect(mockedSubmissionService.linkToAppointment).toHaveBeenCalledWith({
      submissionId: "sub-1",
      appointmentId: "apt-1",
    });
    expect(res.json).toHaveBeenCalledWith({ id: "sub-1" });
  });

  it("lists submissions for an appointment", async () => {
    const docs = [{ id: "1" }];
    mockedSubmissionService.listForAppointment.mockResolvedValueOnce(docs);
    const res = createResponse();

    await ObservationToolSubmissionController.listForAppointment(
      { params: { appointmentId: "apt-1" } } as any,
      res as any,
    );

    expect(mockedSubmissionService.listForAppointment).toHaveBeenCalledWith(
      "apt-1",
    );
    expect(res.json).toHaveBeenCalledWith(docs);
  });
});
