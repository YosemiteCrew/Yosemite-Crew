import { SpecialityController } from "../../src/controllers/web/speciality.controller";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";

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
});
