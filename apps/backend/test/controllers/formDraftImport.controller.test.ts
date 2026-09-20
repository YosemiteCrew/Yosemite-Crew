import { FormDraftImportController } from "../../src/controllers/web/formDraftImport.controller";
import { FormDraftImportService } from "../../src/services/formDraftImport.service";
import { FormServiceError } from "../../src/services/form.service";

jest.mock("../../src/services/formDraftImport.service", () => ({
  FormDraftImportService: {
    create: jest.fn(),
    get: jest.fn(),
    discard: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedService = FormDraftImportService as unknown as {
  create: jest.Mock;
  get: jest.Mock;
  discard: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe("FormDraftImportController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("400s when the organisation cannot be resolved", async () => {
      const req = { body: {}, params: {} } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("401s when there is no authenticated user", async () => {
      const req = { organisationId: "org-1", body: {}, params: {} } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("400s on a body that fails schema validation", async () => {
      const req = {
        organisationId: "org-1",
        userId: "user-1",
        body: { suppliedText: "" },
        params: {},
      } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("creates a draft import for the authorized organisation and user", async () => {
      mockedService.create.mockResolvedValueOnce({ id: "import-1" });
      const req = {
        organisationId: "org-1",
        userId: "user-1",
        body: { suppliedText: "Owner Name | input | required" },
        params: {},
      } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(mockedService.create).toHaveBeenCalledWith({
        organisationId: "org-1",
        userId: "user-1",
        suppliedText: "Owner Name | input | required",
        sourceFormId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { id: "import-1" } });
    });

    it("maps a FormServiceError to its declared status code", async () => {
      mockedService.create.mockRejectedValueOnce(
        new FormServiceError("Source form not found", 404),
      );
      const req = {
        organisationId: "org-1",
        userId: "user-1",
        body: { suppliedText: "Owner Name | input | required" },
        params: {},
      } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Source form not found",
      });
    });

    it("500s on an unexpected error", async () => {
      mockedService.create.mockRejectedValueOnce(new Error("boom"));
      const req = {
        organisationId: "org-1",
        userId: "user-1",
        body: { suppliedText: "Owner Name | input | required" },
        params: {},
      } as never;
      const res = createResponse();

      await FormDraftImportController.create(req, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("get", () => {
    it("400s when the organisation cannot be resolved", async () => {
      const req = { params: { id: "import-1" } } as never;
      const res = createResponse();

      await FormDraftImportController.get(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns the draft import for the authorized organisation", async () => {
      mockedService.get.mockResolvedValueOnce({ id: "import-1", stale: false });
      const req = {
        organisationId: "org-1",
        params: { id: "import-1" },
      } as never;
      const res = createResponse();

      await FormDraftImportController.get(req, res as never);

      expect(mockedService.get).toHaveBeenCalledWith("org-1", "import-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { id: "import-1", stale: false },
      });
    });

    it("maps a FormServiceError from the service to its status code", async () => {
      mockedService.get.mockRejectedValueOnce(
        new FormServiceError("Draft import not found", 404),
      );
      const req = {
        organisationId: "org-1",
        params: { id: "missing" },
      } as never;
      const res = createResponse();

      await FormDraftImportController.get(req, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("discard", () => {
    it("400s when the organisation cannot be resolved", async () => {
      const req = { params: { id: "import-1" } } as never;
      const res = createResponse();

      await FormDraftImportController.discard(req, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockedService.discard).not.toHaveBeenCalled();
    });

    it("discards the draft import and returns 204", async () => {
      mockedService.discard.mockResolvedValueOnce(undefined);
      const req = {
        organisationId: "org-1",
        params: { id: "import-1" },
      } as never;
      const res = createResponse();

      await FormDraftImportController.discard(req, res as never);

      expect(mockedService.discard).toHaveBeenCalledWith("org-1", "import-1");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("maps a conflict from the service to 409", async () => {
      mockedService.discard.mockRejectedValueOnce(
        new FormServiceError("already been published", 409),
      );
      const req = {
        organisationId: "org-1",
        params: { id: "import-1" },
      } as never;
      const res = createResponse();

      await FormDraftImportController.discard(req, res as never);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });
});
