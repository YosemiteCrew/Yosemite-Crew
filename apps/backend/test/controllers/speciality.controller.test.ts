import { SpecialityController } from "../../src/controllers/web/speciality.controller";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../src/services/catalog.service", () => ({
  CatalogService: {
    createSpeciality: jest.fn(),
    updateSpeciality: jest.fn(),
    getSpecialityById: jest.fn(),
    listSpecialities: jest.fn(),
    deleteSpeciality: jest.fn(),
  },
  CatalogServiceError: class CatalogServiceError extends Error {
    statusCode: number;
    code?: string;
    details?: Record<string, unknown>;

    constructor(
      message: string,
      statusCode: number,
      code?: string,
      details?: Record<string, unknown>,
    ) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    }
  },
}));

jest.mock("../../src/services/speciality.service", () => ({
  SpecialityService: {
    createMany: jest.fn(),
  },
  SpecialityServiceError: class SpecialityServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn().mockReturnThis(),
  };

  return res;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const fhirSpecialityPayload = {
  resourceType: "Organization",
  id: "spec_1",
  name: "Cardiology",
  active: true,
  partOf: { reference: "Organization/org_1" },
};

const specialitySummary = (overrides: Record<string, unknown> = {}) => ({
  id: "spec_1",
  organisationId: "org_1",
  name: "Cardiology",
  status: "ACTIVE",
  headUserId: "user_1",
  headName: "Dr. Lee",
  headProfilePicUrl: "https://example.com/avatar.png",
  teamMemberIds: ["user_1"],
  activeServiceCount: 1,
  activePackageCount: 0,
  archivedServiceCount: 0,
  archivedPackageCount: 0,
  createdAt: new Date("2026-06-09T00:00:00.000Z"),
  updatedAt: new Date("2026-06-09T00:00:00.000Z"),
  ...overrides,
});

describe("SpecialityController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a FHIR bundle for speciality search", async () => {
    (CatalogService.listSpecialities as jest.Mock).mockResolvedValue({
      organisationId: "org_1",
      page: 1,
      pageSize: 50,
      total: 1,
      items: [
        {
          id: "spec_1",
          organisationId: "org_1",
          name: "Cardiology",
          status: "ACTIVE",
          headUserId: "user_1",
          headName: "Dr. Lee",
          headProfilePicUrl: "https://example.com/avatar.png",
          teamMemberIds: ["user_1"],
          activeServiceCount: 4,
          activePackageCount: 2,
          archivedServiceCount: 0,
          archivedPackageCount: 0,
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
          updatedAt: new Date("2026-06-09T00:00:00.000Z"),
        },
      ],
    });

    const req = {
      params: {},
      query: {
        organization: "Organization/org_1",
        active: "true",
        name: "Cardio",
      },
      baseUrl: "/fhir/v1/speciality",
    };
    const res = createResponse();

    await SpecialityController.getAllByOrganizationId(
      req as never,
      res as never,
    );

    expect(CatalogService.listSpecialities).toHaveBeenCalledWith("org_1", {
      search: "Cardio",
      status: "ACTIVE",
      page: undefined,
      pageSize: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Bundle",
        total: 1,
      }),
    );
  });

  it("falls back to the organisationId route param and maps active=false to the archived filter", async () => {
    (CatalogService.listSpecialities as jest.Mock).mockResolvedValue({
      organisationId: "org_2",
      page: 1,
      pageSize: 50,
      total: 0,
      items: [],
    });

    const req = {
      params: { organisationId: "org_2" },
      query: { active: "false" },
      baseUrl: "/fhir/v1/speciality",
    };
    const res = createResponse();

    await SpecialityController.getAllByOrganizationId(
      req as never,
      res as never,
    );

    expect(CatalogService.listSpecialities).toHaveBeenCalledWith("org_2", {
      search: undefined,
      status: "ARCHIVED",
      page: undefined,
      pageSize: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("omits the status filter when active is not supplied", async () => {
    (CatalogService.listSpecialities as jest.Mock).mockResolvedValue({
      organisationId: "org_3",
      page: 1,
      pageSize: 50,
      total: 0,
      items: [],
    });

    const req = {
      params: { organisationId: "org_3" },
      query: {},
      baseUrl: "/fhir/v1/speciality",
    };
    const res = createResponse();

    await SpecialityController.getAllByOrganizationId(
      req as never,
      res as never,
    );

    expect(CatalogService.listSpecialities).toHaveBeenCalledWith("org_3", {
      search: undefined,
      status: undefined,
      page: undefined,
      pageSize: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a speciality search without any organisation identifier", async () => {
    const req = {
      params: {},
      query: {},
      baseUrl: "/fhir/v1/speciality",
    };
    const res = createResponse();

    await SpecialityController.getAllByOrganizationId(
      req as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Organization identifier is required.",
    });
    expect(CatalogService.listSpecialities).not.toHaveBeenCalled();
  });

  it("returns a FHIR speciality resource by id", async () => {
    (CatalogService.getSpecialityById as jest.Mock).mockResolvedValue({
      id: "spec_1",
      organisationId: "org_1",
      name: "Cardiology",
      status: "ACTIVE",
      headUserId: "user_1",
      headName: "Dr. Lee",
      headProfilePicUrl: null,
      teamMemberIds: ["user_1"],
      activeServiceCount: 1,
      activePackageCount: 1,
      archivedServiceCount: 0,
      archivedPackageCount: 0,
      createdAt: new Date("2026-06-09T00:00:00.000Z"),
      updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    });

    const req = {
      params: { id: "spec_1" },
      query: { organization: "Organization/org_1" },
      organisationId: "org_1",
    };
    const res = createResponse();

    await SpecialityController.getSpecialityById(req as never, res as never);

    expect(CatalogService.getSpecialityById).toHaveBeenCalledWith(
      "spec_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Organization",
        id: "spec_1",
        active: true,
      }),
    );
  });

  it("rejects a speciality read whose organization query names a different organisation than the caller was authorized for", async () => {
    const req = {
      params: { id: "spec_1" },
      query: { organization: "Organization/org_victim" },
      organisationId: "org_1",
    };
    const res = createResponse();

    await SpecialityController.getSpecialityById(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(CatalogService.getSpecialityById).not.toHaveBeenCalled();
  });

  it("maps dependency conflicts on speciality delete", async () => {
    (CatalogService.deleteSpeciality as jest.Mock).mockRejectedValue(
      new CatalogServiceError(
        "Speciality cannot be permanently deleted because it has catalog items or historical usage.",
        409,
        "SPECIALITY_HAS_DEPENDENCIES",
        { activeServices: 2 },
      ),
    );

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
    };
    const res = createResponse();

    await SpecialityController.deleteSpeciality(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "SPECIALITY_HAS_DEPENDENCIES",
        message:
          "Speciality cannot be permanently deleted because it has catalog items or historical usage.",
        details: { activeServices: 2 },
      },
    });
  });

  describe("create", () => {
    it("rejects a body that is not a FHIR Organization resource", async () => {
      const req = { body: { resourceType: "Patient", name: "Cardiology" } };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(CatalogService.createSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Organization resource.",
      });
    });

    it("rejects a missing body", async () => {
      const req = { body: undefined };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(CatalogService.createSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("creates the speciality and echoes back the stored resource", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockResolvedValue({
        id: "spec_1",
        organisationId: "org_1",
      });
      (CatalogService.getSpecialityById as jest.Mock).mockResolvedValue(
        specialitySummary(),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(CatalogService.createSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_1",
          name: "Cardiology",
          isActive: true,
        }),
      );
      expect(CatalogService.getSpecialityById).toHaveBeenCalledWith(
        "spec_1",
        "org_1",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: "Organization",
          id: "spec_1",
          name: "Cardiology",
          active: true,
        }),
      );
    });

    it("omits head details the stored speciality does not carry", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockResolvedValue({
        id: "spec_1",
        organisationId: "org_1",
      });
      (CatalogService.getSpecialityById as jest.Mock).mockResolvedValue(
        specialitySummary({
          headUserId: null,
          headName: null,
          headProfilePicUrl: null,
        }),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(201);
      const [resource] = (res.json as jest.Mock).mock.calls[0] as [
        { extension?: Array<{ url: string }> },
      ];
      expect(
        resource.extension?.some((item) =>
          item.url.endsWith("speciality-head"),
        ),
      ).toBeFalsy();
    });

    it("labels a catalog conflict carrying only details as CONFLICT", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockRejectedValue(
        new CatalogServiceError("Duplicate speciality.", 409, undefined, {
          existingId: "spec_9",
        }),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "CONFLICT",
          message: "Duplicate speciality.",
          details: { existingId: "spec_9" },
        },
      });
    });

    it("omits the details key when the catalog error carries only a code", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockRejectedValue(
        new CatalogServiceError("Name already used.", 422, "NAME_TAKEN"),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: { code: "NAME_TAKEN", message: "Name already used." },
      });
    });

    it("maps a bare catalog error to a plain message body", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockRejectedValue(
        new CatalogServiceError("Organisation not found.", 404),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation not found.",
      });
    });

    it("falls back to 500 on an unknown failure", async () => {
      (CatalogService.createSpeciality as jest.Mock).mockRejectedValue(
        new Error("boom"),
      );

      const req = { body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.create(req as never, res as never);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to create speciality",
        expect.any(Error),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to create speciality.",
      });
    });
  });

  describe("update", () => {
    it("rejects a request without a speciality identifier", async () => {
      const req = { params: {}, body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.update(req as never, res as never);

      expect(CatalogService.updateSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Speciality identifier is required.",
      });
    });

    it("rejects a body that is not a FHIR Organization resource", async () => {
      const req = {
        params: { id: "spec_1" },
        body: { resourceType: "Patient" },
      };
      const res = createResponse();

      await SpecialityController.update(req as never, res as never);

      expect(CatalogService.updateSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Organization resource.",
      });
    });

    it("updates the speciality and returns the refreshed resource", async () => {
      (CatalogService.updateSpeciality as jest.Mock).mockResolvedValue({
        id: "spec_1",
        organisationId: "org_1",
      });
      (CatalogService.getSpecialityById as jest.Mock).mockResolvedValue(
        specialitySummary({ status: "ARCHIVED", name: "Cardio" }),
      );

      const req = {
        params: { id: "spec_1" },
        body: { ...fhirSpecialityPayload, name: "Cardio" },
      };
      const res = createResponse();

      await SpecialityController.update(req as never, res as never);

      expect(CatalogService.updateSpeciality).toHaveBeenCalledWith(
        "spec_1",
        expect.objectContaining({ organisationId: "org_1", name: "Cardio" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: "Organization",
          name: "Cardio",
          active: false,
        }),
      );
    });

    it("falls back to 500 on an unknown failure", async () => {
      (CatalogService.updateSpeciality as jest.Mock).mockRejectedValue(
        new Error("boom"),
      );

      const req = { params: { id: "spec_1" }, body: fhirSpecialityPayload };
      const res = createResponse();

      await SpecialityController.update(req as never, res as never);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to update speciality",
        expect.any(Error),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to update speciality.",
      });
    });
  });

  describe("getSpecialityById", () => {
    it("rejects a request without a speciality identifier", async () => {
      const req = { params: {}, query: {}, organisationId: "org_1" };
      const res = createResponse();

      await SpecialityController.getSpecialityById(req as never, res as never);

      expect(CatalogService.getSpecialityById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Speciality identifier is required.",
      });
    });

    it("rejects a request the RBAC layer never scoped to an organisation", async () => {
      const req = { params: { id: "spec_1" }, query: {} };
      const res = createResponse();

      await SpecialityController.getSpecialityById(req as never, res as never);

      expect(CatalogService.getSpecialityById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation identifier is required.",
      });
    });

    it("accepts an organisationId query that agrees with the authorized organisation", async () => {
      (CatalogService.getSpecialityById as jest.Mock).mockResolvedValue(
        specialitySummary(),
      );

      const req = {
        params: { id: "spec_1" },
        query: { organisationId: "org_1" },
        organisationId: "org_1",
      };
      const res = createResponse();

      await SpecialityController.getSpecialityById(req as never, res as never);

      expect(CatalogService.getSpecialityById).toHaveBeenCalledWith(
        "spec_1",
        "org_1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("falls back to 500 on an unknown failure", async () => {
      (CatalogService.getSpecialityById as jest.Mock).mockRejectedValue(
        new Error("boom"),
      );

      const req = {
        params: { id: "spec_1" },
        query: {},
        organisationId: "org_1",
      };
      const res = createResponse();

      await SpecialityController.getSpecialityById(req as never, res as never);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to retrieve speciality",
        expect.any(Error),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to retrieve speciality.",
      });
    });
  });

  describe("getAllByOrganizationId", () => {
    it("parses page and pageSize from the query string", async () => {
      (CatalogService.listSpecialities as jest.Mock).mockResolvedValue({
        organisationId: "org_1",
        page: 3,
        pageSize: 25,
        total: 0,
        items: [],
      });

      const req = {
        params: { organisationId: "org_1" },
        query: { page: "3", pageSize: "25" },
        baseUrl: "/fhir/v1/speciality",
      };
      const res = createResponse();

      await SpecialityController.getAllByOrganizationId(
        req as never,
        res as never,
      );

      expect(CatalogService.listSpecialities).toHaveBeenCalledWith("org_1", {
        search: undefined,
        status: undefined,
        page: 3,
        pageSize: 25,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("falls back to 500 on an unknown failure", async () => {
      (CatalogService.listSpecialities as jest.Mock).mockRejectedValue(
        new Error("boom"),
      );

      const req = {
        params: { organisationId: "org_1" },
        query: {},
        baseUrl: "/fhir/v1/speciality",
      };
      const res = createResponse();

      await SpecialityController.getAllByOrganizationId(
        req as never,
        res as never,
      );

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to retrieve specialities",
        expect.any(Error),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to retrieve specialities.",
      });
    });
  });

  describe("deleteSpeciality", () => {
    it.each([
      ["organisation", { specialityId: "spec_1" }],
      ["speciality", { organisationId: "org_1" }],
    ])("rejects a delete missing the %s identifier", async (_label, params) => {
      const res = createResponse();

      await SpecialityController.deleteSpeciality(
        { params } as never,
        res as never,
      );

      expect(CatalogService.deleteSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Organization identifier and Speciality identifier is required.",
      });
    });

    it("returns 204 with an empty body once the speciality is gone", async () => {
      (CatalogService.deleteSpeciality as jest.Mock).mockResolvedValue(
        undefined,
      );

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
      };
      const res = createResponse();

      await SpecialityController.deleteSpeciality(req as never, res as never);

      expect(CatalogService.deleteSpeciality).toHaveBeenCalledWith(
        "spec_1",
        "org_1",
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("falls back to 500 on an unknown failure", async () => {
      (CatalogService.deleteSpeciality as jest.Mock).mockRejectedValue(
        new Error("boom"),
      );

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
      };
      const res = createResponse();

      await SpecialityController.deleteSpeciality(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to delete speciality.",
      });
    });
  });
});
