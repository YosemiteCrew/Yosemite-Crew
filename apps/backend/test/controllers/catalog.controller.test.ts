import { CatalogController } from "../../src/controllers/web/catalog.controller";
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
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    getProductById: jest.fn(),
    getPackageDetail: jest.fn(),
    listProducts: jest.fn(),
    getSpecialityCatalog: jest.fn(),
    resolveSelection: jest.fn(),
    getOrganisationSummary: jest.fn(),
    listSpecialities: jest.fn(),
    archiveProduct: jest.fn(),
    restoreProduct: jest.fn(),
    deleteProduct: jest.fn(),
    searchItems: jest.fn(),
    getArchiveCatalog: jest.fn(),
    createSpeciality: jest.fn(),
    updateSpeciality: jest.fn(),
    archiveSpeciality: jest.fn(),
    restoreSpeciality: jest.fn(),
    deleteSpeciality: jest.fn(),
    listOrganisationsProvidingServiceNearby: jest.fn(),
    getBookableSlotsService: jest.fn(),
    getCalendarPrefillMatches: jest.fn(),
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

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };

  return res;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const noIfMatch = () => undefined;

const healthcareServiceBody = {
  resourceType: "HealthcareService",
  id: "prod_1",
  providedBy: { reference: "Organization/org_1" },
  name: "Consultation",
  active: true,
  type: [{ coding: [{ code: "CONSULTATION" }] }],
};

describe("CatalogController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns speciality catalog view for screen queries", async () => {
    (CatalogService.getSpecialityCatalog as jest.Mock).mockResolvedValue({
      specialityId: "spec_1",
      organisationId: "org_1",
      activeTab: "services",
      search: null,
      services: [],
      packages: [],
    });

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { tab: "services" },
    };
    const res = createResponse();

    await CatalogController.getSpecialityCatalog(req as never, res as never);

    expect(CatalogService.getSpecialityCatalog).toHaveBeenCalledWith({
      organisationId: "org_1",
      specialityId: "spec_1",
      tab: "services",
      search: undefined,
      includeInactive: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns package detail by id", async () => {
    (CatalogService.getPackageDetail as jest.Mock).mockResolvedValue({
      id: "pkg_1",
      version: 3,
      items: [],
    });

    const req = {
      organisationId: "org_1",
      params: { id: "pkg_1" },
      query: { organisationId: "org_1" },
    };
    const res = createResponse();

    await CatalogController.getPackageDetail(req as never, res as never);

    expect(CatalogService.getPackageDetail).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"3"');
  });

  it("passes If-Match through for service updates and returns the next version", async () => {
    (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
      id: "prod_1",
      version: 8,
      name: "Updated Consult",
    });

    const req = {
      params: { organisationId: "org_1", id: "prod_1" },
      body: { name: "Updated Consult" },
      header: jest.fn().mockReturnValue('W/"7"'),
    };
    const res = createResponse();

    await CatalogController.updateService(req as never, res as never);

    expect(CatalogService.updateProduct).toHaveBeenCalledWith("prod_1", {
      organisationId: "org_1",
      specialityId: undefined,
      name: "Updated Consult",
      description: null,
      code: null,
      kind: "CONSULTATION",
      isActive: undefined,
      price: undefined,
      bookable: undefined,
      expectedVersion: 7,
    });
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"8"');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps catalog service errors to status codes", async () => {
    (CatalogService.getPackageDetail as jest.Mock).mockRejectedValue(
      new CatalogServiceError("Package not found.", 404),
    );

    const req = {
      organisationId: "org_1",
      params: { id: "pkg_missing" },
      query: {},
    };
    const res = createResponse();

    await CatalogController.getPackageDetail(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Package not found.",
    });
  });

  it("returns organisation catalog summary", async () => {
    (CatalogService.getOrganisationSummary as jest.Mock).mockResolvedValue({
      organisationId: "org_1",
      items: [],
    });

    const req = {
      params: { organisationId: "org_1" },
      query: { search: "cardio", includeArchived: "true" },
    };
    const res = createResponse();

    await CatalogController.getOrganisationSummary(req as never, res as never);

    expect(CatalogService.getOrganisationSummary).toHaveBeenCalledWith(
      "org_1",
      {
        search: "cardio",
        includeArchived: true,
      },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns dependency-shaped catalog errors for delete flows", async () => {
    (CatalogService.deleteProduct as jest.Mock).mockRejectedValue(
      new CatalogServiceError(
        "Catalog item cannot be permanently deleted because it has dependencies.",
        409,
        "CATALOG_ITEM_HAS_DEPENDENCIES",
        { appointments: 2 },
      ),
    );

    const req = {
      params: { organisationId: "org_1", id: "prod_1" },
    };
    const res = createResponse();

    await CatalogController.deleteService(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "CATALOG_ITEM_HAS_DEPENDENCIES",
        message:
          "Catalog item cannot be permanently deleted because it has dependencies.",
        details: { appointments: 2 },
      },
    });
  });

  it("returns nearby organisations for catalog service search", async () => {
    (
      CatalogService.listOrganisationsProvidingServiceNearby as jest.Mock
    ).mockResolvedValue([{ id: "org_1", name: "Clinic" }]);

    const req = {
      params: { organisationId: "org_1" },
      query: { lat: "12.97", lng: "77.59" },
    };
    const res = createResponse();

    await CatalogController.getCatalogNearbyOrganisations(
      req as never,
      res as never,
    );

    expect(
      CatalogService.listOrganisationsProvidingServiceNearby,
    ).toHaveBeenCalledWith(12.97, 77.59, 5000);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "org_1", name: "Clinic" }]);
  });

  it("allows nearby organisation requests without coordinates", async () => {
    (
      CatalogService.listOrganisationsProvidingServiceNearby as jest.Mock
    ).mockResolvedValue([{ id: "org_1", name: "Clinic" }]);

    const req = {
      params: { organisationId: "org_1" },
      query: {},
    };
    const res = createResponse();

    await CatalogController.getCatalogNearbyOrganisations(
      req as never,
      res as never,
    );

    expect(
      CatalogService.listOrganisationsProvidingServiceNearby,
    ).toHaveBeenCalledWith(undefined, undefined, 5000);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "org_1", name: "Clinic" }]);
  });

  it("returns catalog bookable slots", async () => {
    (CatalogService.getBookableSlotsService as jest.Mock).mockResolvedValue({
      date: "2026-01-01",
      windows: [],
    });

    const req = {
      params: { organisationId: "org_1" },
      body: {
        productItemId: "prod_1",
        date: "2026-01-01",
      },
    };
    const res = createResponse();

    await CatalogController.getCatalogBookableSlots(req as never, res as never);

    expect(CatalogService.getBookableSlotsService).toHaveBeenCalledWith(
      "prod_1",
      "org_1",
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { date: "2026-01-01", windows: [] },
    });
  });

  it("returns catalog calendar prefill matches", async () => {
    (CatalogService.getCalendarPrefillMatches as jest.Mock).mockResolvedValue([
      {
        serviceId: "prod_1",
        slot: {
          startTime: "10:00",
          endTime: "10:30",
          vetIds: ["vet_1"],
        },
        meta: {
          localStartMinute: 600,
          localEndMinute: 630,
        },
      },
    ]);

    const req = {
      organisationId: "org_1",
      params: { organisationId: "org_1" },
      body: {
        organisationId: "org_1",
        date: "2026-01-01",
        minuteOfDay: 600,
        productItemIds: ["prod_1"],
      },
    };
    const res = createResponse();

    await CatalogController.getCatalogCalendarPrefill(
      req as never,
      res as never,
    );

    expect(CatalogService.getCalendarPrefillMatches).toHaveBeenCalledWith({
      organisationId: "org_1",
      date: new Date("2026-01-01T00:00:00.000Z"),
      minuteOfDay: 600,
      leadId: undefined,
      serviceIds: ["prod_1"],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        matches: [
          {
            serviceId: "prod_1",
            slot: {
              startTime: "10:00",
              endTime: "10:30",
              vetIds: ["vet_1"],
            },
            meta: {
              localStartMinute: 600,
              localEndMinute: 630,
            },
          },
        ],
      },
    });
  });

  it("creates a speciality from the catalog contract", async () => {
    (CatalogService.createSpeciality as jest.Mock).mockResolvedValue({
      id: "spec_1",
      name: "Cardiology",
    });

    const req = {
      params: { organisationId: "org_1" },
      body: {
        name: "Cardiology",
        headUserId: "user_1",
        teamMemberIds: ["user_1", "user_2"],
      },
    };
    const res = createResponse();

    await CatalogController.createSpeciality(req as never, res as never);

    expect(CatalogService.createSpeciality).toHaveBeenCalledWith({
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      headName: undefined,
      headProfilePicUrl: undefined,
      teamMemberIds: ["user_1", "user_2"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns FHIR Parameters for resolve operation", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Cardio Package",
      code: "PK-1",
      currency: "USD",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      leadCount: 1,
      supportCount: 0,
      additionalDiscountPercent: 0,
      grossAmount: 100,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 100,
      breakdownItemCount: 1,
      templateKinds: ["SOAP_NOTE"],
      templateBindings: [],
      billingItems: [
        {
          productItemId: "pkg_1",
          code: "PK-1",
          name: "Cardio Package",
          kind: "PACKAGE",
          quantity: 1,
          currency: "USD",
          unitPrice: 100,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 100,
          discountAmount: 0,
          finalAmount: 100,
          isPackageComponent: false,
          packageProductItemId: null,
        },
      ],
      includedItems: [],
    });

    const req = {
      organisationId: "org_1",
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "productItemId", valueString: "pkg_1" },
          { name: "organization", valueString: "Organization/org_1" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.resolveProductOperation(req as never, res as never);

    expect(CatalogService.resolveSelection).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
      }),
    );
  });

  it("returns FHIR Parameters for component search operation", async () => {
    (CatalogService.searchItems as jest.Mock).mockResolvedValue({
      query: "cbc",
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_1",
          code: "LB-0001",
          name: "CBC - Canine",
          description: "Blood test",
          kind: "LAB_TEST",
          source: "CATALOG",
          status: "ACTIVE",
          isBookable: false,
          durationMinutes: 20,
          unitPrice: 800,
          currency: "USD",
          defaultDiscountPercent: 2,
          maxDiscountPercent: 10,
          totalAmount: 784,
          canBeAddedToPackage: true,
          blockReason: null,
          nestedBreakdown: null,
        },
      ],
    });

    const req = {
      organisationId: "org_1",
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "q", valueString: "cbc" },
          { name: "kinds", valueString: "LAB,PACKAGE" },
          { name: "page", valueInteger: 1 },
          { name: "pageSize", valueInteger: 20 },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).toHaveBeenCalledWith({
      organisationId: "org_1",
      q: "cbc",
      specialityId: undefined,
      kinds: ["LAB", "PACKAGE"],
      includeArchived: false,
      excludePackageId: undefined,
      includeNestedBreakdown: false,
      page: 1,
      pageSize: 20,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
      }),
    );
  });

  it("accepts canonical specialty in component search operation", async () => {
    (CatalogService.searchItems as jest.Mock).mockResolvedValue({
      query: null,
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
    });

    const req = {
      organisationId: "org_1",
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "specialty", valueString: "spec_1" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).toHaveBeenCalledWith({
      organisationId: "org_1",
      q: undefined,
      specialityId: "spec_1",
      kinds: undefined,
      includeArchived: false,
      excludePackageId: undefined,
      includeNestedBreakdown: false,
      page: undefined,
      pageSize: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects unsupported FHIR component search kinds", async () => {
    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
          { name: "kinds", valueString: "LAB_TEST" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.searchCatalogOperation(req as never, res as never);

    expect(CatalogService.searchItems).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unsupported catalog search kind: LAB_TEST",
    });
  });

  it("rejects invalid healthcare service payloads on create", async () => {
    const req = {
      body: { resourceType: "Patient" },
    };
    const res = createResponse();

    await CatalogController.createProduct(req as never, res as never);

    expect(CatalogService.createProduct).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid payload. Expected FHIR HealthcareService resource.",
      }),
    );
  });

  it("creates a product from a FHIR HealthcareService payload", async () => {
    (CatalogService.createProduct as jest.Mock).mockResolvedValue({
      id: "prod_1",
      version: 4,
      organisationId: "org_1",
    });

    const req = {
      body: {
        resourceType: "HealthcareService",
        id: "prod_1",
        providedBy: { reference: "Organization/org_1" },
        name: "Consultation",
        active: true,
        type: [{ coding: [{ code: "CONSULTATION" }] }],
      },
    };
    const res = createResponse();

    await CatalogController.createProduct(req as never, res as never);

    expect(CatalogService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        name: "Consultation",
        kind: "CONSULTATION",
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"4"');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("fetches a product by id with an optional organisation filter", async () => {
    (CatalogService.getProductById as jest.Mock).mockResolvedValue({
      id: "prod_1",
      version: 6,
      organisationId: "org_1",
    });

    const req = {
      organisationId: "org_1",
      params: { id: "prod_1" },
      query: { organisationId: "org_1" },
    };
    const res = createResponse();

    await CatalogController.getProductById(req as never, res as never);

    expect(CatalogService.getProductById).toHaveBeenCalledWith(
      "prod_1",
      "org_1",
    );
    expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"6"');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("lists products from FHIR query aliases", async () => {
    (CatalogService.listProducts as jest.Mock).mockResolvedValue([]);

    const req = {
      organisationId: "org_1",
      params: { organisationId: "org_1" },
      query: {
        organization: "org_1",
        specialty: "spec_1",
        kind: "CONSULTATION,PACKAGE",
        active: "false",
      },
      baseUrl: "/fhir/R4/HealthcareService",
    };
    const res = createResponse();

    await CatalogController.listProducts(req as never, res as never);

    expect(CatalogService.listProducts).toHaveBeenCalledWith({
      organisationId: "org_1",
      specialityId: "spec_1",
      kinds: ["CONSULTATION", "PACKAGE"],
      active: false,
      includeInactive: false,
      search: undefined,
      supportsInpatient: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid product list queries", async () => {
    const req = {
      params: { organisationId: "org_1" },
      query: { active: "sometimes" },
      baseUrl: "/web/catalog",
    };
    const res = createResponse();

    await CatalogController.listProducts(req as never, res as never);

    expect(CatalogService.listProducts).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("resolves a direct product selection payload", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "prod_1",
    });

    const req = {
      organisationId: "org_1",
      body: {
        productItemId: "prod_1",
        organisationId: "org_1",
      },
    };
    const res = createResponse();

    await CatalogController.resolveProduct(req as never, res as never);

    expect(CatalogService.resolveSelection).toHaveBeenCalledWith(
      "prod_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid direct resolve payloads", async () => {
    const req = {
      body: {
        organisationId: "org_1",
      },
    };
    const res = createResponse();

    await CatalogController.resolveProduct(req as never, res as never);

    expect(CatalogService.resolveSelection).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("maps operation parameter parsing failures to 400 for resolve", async () => {
    const req = {
      body: {
        resourceType: "Parameters",
        parameter: [
          { name: "organization", valueString: "Organization/org_1" },
        ],
      },
    };
    const res = createResponse();

    await CatalogController.resolveProductOperation(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Parameters.productItemId is required.",
    });
  });

  it("lists specialities with parsed paging filters", async () => {
    (CatalogService.listSpecialities as jest.Mock).mockResolvedValue({
      organisationId: "org_1",
      page: 2,
      pageSize: 10,
      total: 1,
      items: [],
    });

    const req = {
      params: { organisationId: "org_1" },
      query: { page: "2", pageSize: "10", status: "ARCHIVED" },
    };
    const res = createResponse();

    await CatalogController.listSpecialities(req as never, res as never);

    expect(CatalogService.listSpecialities).toHaveBeenCalledWith("org_1", {
      page: 2,
      pageSize: 10,
      status: "ARCHIVED",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updates a speciality", async () => {
    (CatalogService.updateSpeciality as jest.Mock).mockResolvedValue({
      id: "spec_1",
      name: "Updated",
    });

    const req = {
      organisationId: "org_1",
      params: { organisationId: "org_1", specialityId: "spec_1" },
      body: {
        name: "Updated",
        headProfilePicUrl: "https://example.com/avatar.png",
      },
    };
    const res = createResponse();

    await CatalogController.updateSpeciality(req as never, res as never);

    expect(CatalogService.updateSpeciality).toHaveBeenCalledWith("spec_1", {
      organisationId: "org_1",
      name: "Updated",
      headUserId: undefined,
      headName: undefined,
      headProfilePicUrl: "https://example.com/avatar.png",
      teamMemberIds: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("archives, restores, and deletes specialities", async () => {
    (CatalogService.archiveSpeciality as jest.Mock).mockResolvedValue({
      id: "spec_1",
    });
    (CatalogService.restoreSpeciality as jest.Mock).mockResolvedValue({
      id: "spec_1",
    });
    (CatalogService.deleteSpeciality as jest.Mock).mockResolvedValue(undefined);

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
    };

    await CatalogController.archiveSpeciality(
      req as never,
      createResponse() as never,
    );
    await CatalogController.restoreSpeciality(
      req as never,
      createResponse() as never,
    );

    const deleteRes = createResponse();
    await CatalogController.deleteSpeciality(req as never, deleteRes as never);

    expect(CatalogService.archiveSpeciality).toHaveBeenCalledWith(
      "spec_1",
      "org_1",
    );
    expect(CatalogService.restoreSpeciality).toHaveBeenCalledWith(
      "spec_1",
      "org_1",
    );
    expect(CatalogService.deleteSpeciality).toHaveBeenCalledWith(
      "spec_1",
      "org_1",
    );
    expect(deleteRes.status).toHaveBeenCalledWith(204);
  });

  it("lists speciality services and filters archived non-bookable items", async () => {
    (CatalogService.listProducts as jest.Mock).mockResolvedValue([
      { id: "svc_1", kind: "CONSULTATION", isActive: false, bookable: null },
      { id: "pkg_1", kind: "PACKAGE", isActive: false, bookable: null },
    ]);

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { status: "ARCHIVED", isBookable: "false" },
    };
    const res = createResponse();

    await CatalogController.listServicesBySpeciality(
      req as never,
      res as never,
    );

    expect(CatalogService.listProducts).toHaveBeenCalledWith({
      organisationId: "org_1",
      specialityId: "spec_1",
      kinds: undefined,
      includeInactive: true,
      search: undefined,
      supportsInpatient: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({
      items: [
        { id: "svc_1", kind: "CONSULTATION", isActive: false, bookable: null },
      ],
    });
  });

  it("creates and archives services", async () => {
    (CatalogService.createProduct as jest.Mock).mockResolvedValue({
      id: "svc_1",
      version: 2,
    });
    (CatalogService.archiveProduct as jest.Mock).mockResolvedValue({
      id: "svc_1",
      version: 3,
    });

    const createReq = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      body: { name: "X-Ray", kind: "DIAGNOSTIC", unitPrice: 50 },
    };
    const archiveReq = {
      params: { organisationId: "org_1", id: "svc_1" },
      header: jest.fn().mockReturnValue('W/"2"'),
    };

    await CatalogController.createService(
      createReq as never,
      createResponse() as never,
    );
    const archiveRes = createResponse();
    await CatalogController.archiveService(
      archiveReq as never,
      archiveRes as never,
    );

    expect(CatalogService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        specialityId: "spec_1",
        kind: "DIAGNOSTIC",
      }),
    );
    expect(CatalogService.archiveProduct).toHaveBeenCalledWith(
      "svc_1",
      "org_1",
      2,
    );
    expect(archiveRes.setHeader).toHaveBeenCalledWith("ETag", 'W/"3"');
  });

  it("rejects invalid service payloads", async () => {
    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      body: { name: "" },
    };
    const res = createResponse();

    await CatalogController.createService(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CatalogService.createProduct).not.toHaveBeenCalled();
  });

  it("lists packages for a speciality", async () => {
    (CatalogService.listProducts as jest.Mock).mockResolvedValue([
      { id: "pkg_1", kind: "PACKAGE", isActive: true },
      { id: "pkg_2", kind: "PACKAGE", isActive: false },
    ]);

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { status: "ACTIVE" },
    };
    const res = createResponse();

    await CatalogController.listPackagesBySpeciality(
      req as never,
      res as never,
    );

    expect(res.json).toHaveBeenCalledWith({
      items: [{ id: "pkg_1", kind: "PACKAGE", isActive: true }],
    });
  });

  it("rejects an invalid speciality services list query", async () => {
    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { status: "BOGUS" },
    };
    const res = createResponse();

    await CatalogController.listServicesBySpeciality(
      req as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CatalogService.listProducts).not.toHaveBeenCalled();
  });

  it("rejects an invalid speciality packages list query", async () => {
    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { supportsInpatient: "maybe" },
    };
    const res = createResponse();

    await CatalogController.listPackagesBySpeciality(
      req as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CatalogService.listProducts).not.toHaveBeenCalled();
  });

  it("maps the supportsInpatient tri-state onto a boolean and keeps every package when no status is given", async () => {
    (CatalogService.listProducts as jest.Mock).mockResolvedValue([
      { id: "pkg_1", kind: "PACKAGE", isActive: true },
      { id: "pkg_2", kind: "PACKAGE", isActive: false },
    ]);

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { supportsInpatient: "true" },
    };
    const res = createResponse();

    await CatalogController.listPackagesBySpeciality(
      req as never,
      res as never,
    );

    expect(CatalogService.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ supportsInpatient: true }),
    );
    expect(res.json).toHaveBeenCalledWith({
      items: [
        { id: "pkg_1", kind: "PACKAGE", isActive: true },
        { id: "pkg_2", kind: "PACKAGE", isActive: false },
      ],
    });
  });

  it("creates, updates, restores, and deletes packages", async () => {
    (CatalogService.createProduct as jest.Mock).mockResolvedValue({
      id: "pkg_1",
      version: 1,
    });
    (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
      id: "pkg_1",
      version: 2,
    });
    (CatalogService.restoreProduct as jest.Mock).mockResolvedValue({
      id: "pkg_1",
      version: 3,
    });
    (CatalogService.deleteProduct as jest.Mock).mockResolvedValue(undefined);

    const createReq = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      body: { name: "Wellness", leadCount: 1 },
    };
    const updateReq = {
      params: { organisationId: "org_1", id: "pkg_1" },
      body: { name: "Wellness+" },
      header: jest.fn().mockReturnValue('W/"1"'),
    };
    const restoreReq = {
      params: { organisationId: "org_1", id: "pkg_1" },
      header: jest.fn().mockReturnValue('W/"2"'),
    };
    const deleteReq = {
      params: { organisationId: "org_1", id: "pkg_1" },
      header: jest.fn().mockReturnValue('W/"3"'),
    };

    await CatalogController.createPackage(
      createReq as never,
      createResponse() as never,
    );
    await CatalogController.updatePackage(
      updateReq as never,
      createResponse() as never,
    );
    await CatalogController.restorePackage(
      restoreReq as never,
      createResponse() as never,
    );
    const deleteRes = createResponse();
    await CatalogController.deletePackage(
      deleteReq as never,
      deleteRes as never,
    );

    expect(CatalogService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        specialityId: "spec_1",
        kind: "PACKAGE",
      }),
    );
    expect(CatalogService.updateProduct).toHaveBeenCalledWith(
      "pkg_1",
      expect.objectContaining({ expectedVersion: 1 }),
    );
    expect(CatalogService.restoreProduct).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
      2,
    );
    expect(CatalogService.deleteProduct).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
      3,
    );
    expect(deleteRes.status).toHaveBeenCalledWith(204);
  });

  it("searches catalog items from query parameters", async () => {
    (CatalogService.searchItems as jest.Mock).mockResolvedValue({
      query: "kit",
      page: 2,
      pageSize: 5,
      total: 0,
      items: [],
    });

    const req = {
      params: { organisationId: "org_1" },
      query: {
        q: "kit",
        kinds: "INVENTORY,PACKAGE",
        includeArchived: "true",
        includeNestedBreakdown: "true",
        page: "2",
        pageSize: "5",
      },
    };
    const res = createResponse();

    await CatalogController.searchItems(req as never, res as never);

    expect(CatalogService.searchItems).toHaveBeenCalledWith({
      organisationId: "org_1",
      q: "kit",
      specialityId: undefined,
      kinds: ["INVENTORY", "PACKAGE"],
      includeArchived: true,
      excludePackageId: undefined,
      includeNestedBreakdown: true,
      page: 2,
      pageSize: 5,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns the archived catalog for a speciality", async () => {
    (CatalogService.getArchiveCatalog as jest.Mock).mockResolvedValue({
      services: [],
      packages: [],
    });

    const req = {
      params: { organisationId: "org_1", specialityId: "spec_1" },
      query: { search: "archived" },
    };
    const res = createResponse();

    await CatalogController.getArchiveCatalog(req as never, res as never);

    expect(CatalogService.getArchiveCatalog).toHaveBeenCalledWith(
      "org_1",
      "spec_1",
      "archived",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
  describe("organisation scoping", () => {
    it("ignores a query organisation that outranks the authorized one", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([]);

      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_1" },
        query: { organization: "org_victim" },
        baseUrl: "/fhir/R4/HealthcareService",
      };
      const res = createResponse();

      await CatalogController.listProducts(req as never, res as never);

      expect(CatalogService.listProducts).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("falls back to the authorized organisation when the query omits one", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([]);

      const req = {
        organisationId: "org_1",
        params: {},
        query: {},
        baseUrl: "/fhir/R4/HealthcareService",
      };
      const res = createResponse();

      await CatalogController.listProducts(req as never, res as never);

      expect(CatalogService.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: "org_1" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects an update payload that names another organisation", async () => {
      const req = {
        organisationId: "org_1",
        params: { id: "prod_victim" },
        body: {
          resourceType: "HealthcareService",
          id: "prod_victim",
          providedBy: { reference: "Organization/org_victim" },
          name: "Consultation",
          active: true,
          type: [{ coding: [{ code: "CONSULTATION" }] }],
        },
        header: jest.fn().mockReturnValue(undefined),
      };
      const res = createResponse();

      await CatalogController.updateProduct(req as never, res as never);

      expect(CatalogService.updateProduct).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("passes the authorized organisation to updateProduct", async () => {
      (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
        id: "prod_1",
        version: 2,
      });

      const req = {
        organisationId: "org_1",
        params: { id: "prod_1" },
        body: {
          resourceType: "HealthcareService",
          id: "prod_1",
          providedBy: { reference: "Organization/org_1" },
          name: "Consultation",
          active: true,
          type: [{ coding: [{ code: "CONSULTATION" }] }],
        },
        header: jest.fn().mockReturnValue(undefined),
      };
      const res = createResponse();

      await CatalogController.updateProduct(req as never, res as never);

      expect(CatalogService.updateProduct).toHaveBeenCalledWith(
        "prod_1",
        expect.objectContaining({ organisationId: "org_1" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects a query organisation that differs on single-product reads", async () => {
      const req = {
        organisationId: "org_1",
        params: { id: "prod_victim" },
        query: { organisationId: "org_victim" },
      };
      const res = createResponse();

      await CatalogController.getProductById(req as never, res as never);

      expect(CatalogService.getProductById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("does not resolve a selection against a body-supplied organisation", async () => {
      const req = {
        organisationId: "org_1",
        body: { productItemId: "prod_victim", organisationId: "org_victim" },
      };
      const res = createResponse();

      await CatalogController.resolveProduct(req as never, res as never);

      expect(CatalogService.resolveSelection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("does not prefill the calendar against a body-supplied organisation", async () => {
      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_1" },
        body: {
          organisationId: "org_victim",
          date: "2026-01-01",
          minuteOfDay: 600,
          productItemIds: ["prod_1"],
        },
      };
      const res = createResponse();

      await CatalogController.getCatalogCalendarPrefill(
        req as never,
        res as never,
      );

      expect(CatalogService.getCalendarPrefillMatches).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("does not run a FHIR search operation against another organisation", async () => {
      const req = {
        organisationId: "org_1",
        body: {
          resourceType: "Parameters",
          parameter: [
            { name: "organization", valueString: "Organization/org_victim" },
          ],
        },
      };
      const res = createResponse();

      await CatalogController.searchCatalogOperation(
        req as never,
        res as never,
      );

      expect(CatalogService.searchItems).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("requires an authorized organisation to be present", async () => {
      const req = { params: { id: "prod_1" }, query: {} };
      const res = createResponse();

      await CatalogController.getProductById(req as never, res as never);

      expect(CatalogService.getProductById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("refuses to read a package for an unscoped request", async () => {
      const req = { params: { id: "pkg_1" }, query: {} };
      const res = createResponse();

      await CatalogController.getPackageDetail(req as never, res as never);

      expect(CatalogService.getPackageDetail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation identifier is required.",
      });
    });

    it("refuses a FHIR resolve operation for an unscoped request", async () => {
      const req = {
        body: {
          resourceType: "Parameters",
          parameter: [{ name: "productItemId", valueString: "prod_1" }],
        },
      };
      const res = createResponse();

      await CatalogController.resolveProductOperation(
        req as never,
        res as never,
      );

      expect(CatalogService.resolveSelection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation identifier is required.",
      });
    });

    it("refuses to update a speciality routed through another organisation", async () => {
      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_victim", specialityId: "spec_1" },
        body: { name: "Cardio" },
      };
      const res = createResponse();

      await CatalogController.updateSpeciality(req as never, res as never);

      expect(CatalogService.updateSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation does not match the authorized organisation.",
      });
    });
  });

  describe("If-Match handling", () => {
    it("rejects an If-Match header without a version number", async () => {
      const req = {
        params: { organisationId: "org_1", id: "prod_1" },
        body: {},
        header: () => 'W/"not-a-version"',
      };
      const res = createResponse();

      await CatalogController.updateService(req as never, res as never);

      expect(CatalogService.updateProduct).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid If-Match header.",
      });
    });
  });

  describe("catalog error shapes", () => {
    it("defaults a detail-only catalog error to the CONFLICT code", async () => {
      (CatalogService.getPackageDetail as jest.Mock).mockRejectedValue(
        new CatalogServiceError("Package is locked.", 409, undefined, {
          lockedBy: "user_1",
        }),
      );

      const req = {
        organisationId: "org_1",
        params: { id: "pkg_1" },
        query: {},
      };
      const res = createResponse();

      await CatalogController.getPackageDetail(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "CONFLICT",
          message: "Package is locked.",
          details: { lockedBy: "user_1" },
        },
      });
    });

    it("omits the details key for a code-only catalog error", async () => {
      (CatalogService.getPackageDetail as jest.Mock).mockRejectedValue(
        new CatalogServiceError("Package is archived.", 410, "PACKAGE_GONE"),
      );

      const req = {
        organisationId: "org_1",
        params: { id: "pkg_1" },
        query: {},
      };
      const res = createResponse();

      await CatalogController.getPackageDetail(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith({
        error: { code: "PACKAGE_GONE", message: "Package is archived." },
      });
    });
  });

  describe("query and payload mapping", () => {
    it("drops an all-empty kinds filter instead of sending it to the service", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([]);

      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_1" },
        query: { kinds: " , , " },
        baseUrl: "/web/catalog",
      };
      const res = createResponse();

      await CatalogController.listProducts(req as never, res as never);

      expect(CatalogService.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({ kinds: undefined }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("fails the list when the kinds filter names an unknown product kind", async () => {
      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_1" },
        query: { kinds: "TELEPORTATION" },
        baseUrl: "/web/catalog",
      };
      const res = createResponse();

      await CatalogController.listProducts(req as never, res as never);

      expect(CatalogService.listProducts).not.toHaveBeenCalled();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Unable to list catalog products.",
        expect.anything(),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to list catalog products.",
      });
    });

    it("clears the bookable profile when a service is marked non-bookable", async () => {
      (CatalogService.createProduct as jest.Mock).mockResolvedValue({
        id: "svc_1",
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        body: { name: "Lab Panel", kind: "LAB_TEST", isBookable: false },
      };
      const res = createResponse();

      await CatalogController.createService(req as never, res as never);

      expect(CatalogService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ bookable: null }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("derives the bookable profile from appointment modes and duration", async () => {
      (CatalogService.createProduct as jest.Mock).mockResolvedValue({
        id: "svc_1",
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        body: {
          name: "Surgery",
          kind: "PROCEDURE",
          durationMinutes: 45,
          appointmentModes: ["INPATIENT"],
        },
      };
      const res = createResponse();

      await CatalogController.createService(req as never, res as never);

      expect(CatalogService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          bookable: {
            durationMinutes: 45,
            supportsOutpatient: false,
            supportsInpatient: true,
          },
        }),
      );
    });

    it("defaults duration and outpatient support when only isBookable is set", async () => {
      (CatalogService.createProduct as jest.Mock).mockResolvedValue({
        id: "svc_1",
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        body: { name: "Consult", kind: "CONSULTATION", isBookable: true },
      };
      const res = createResponse();

      await CatalogController.createService(req as never, res as never);

      expect(CatalogService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          bookable: {
            durationMinutes: 30,
            supportsOutpatient: true,
            supportsInpatient: false,
          },
        }),
      );
    });

    it("builds a zero-priced policy when only a currency is supplied", async () => {
      (CatalogService.createProduct as jest.Mock).mockResolvedValue({
        id: "svc_1",
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        body: { name: "Consult", kind: "CONSULTATION", currency: "USD" },
      };
      const res = createResponse();

      await CatalogController.createService(req as never, res as never);

      expect(CatalogService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          price: {
            unitPrice: 0,
            currency: "USD",
            defaultDiscountPercent: null,
            maxDiscountPercent: null,
          },
        }),
      );
    });

    it("sends an empty name when a service update omits it", async () => {
      (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
        id: "prod_1",
        version: 2,
      });

      const req = {
        params: { organisationId: "org_1", id: "prod_1" },
        body: { isActive: false },
        header: noIfMatch,
      };
      const res = createResponse();

      await CatalogController.updateService(req as never, res as never);

      expect(CatalogService.updateProduct).toHaveBeenCalledWith("prod_1", {
        organisationId: "org_1",
        specialityId: undefined,
        name: "",
        description: null,
        code: null,
        kind: "CONSULTATION",
        isActive: false,
        price: undefined,
        bookable: undefined,
        expectedVersion: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("sends an empty name when a package update omits it", async () => {
      (CatalogService.updateProduct as jest.Mock).mockResolvedValue({
        id: "pkg_1",
        version: 5,
      });

      const req = {
        params: { organisationId: "org_1", id: "pkg_1" },
        body: { isActive: false },
        header: noIfMatch,
      };
      const res = createResponse();

      await CatalogController.updatePackage(req as never, res as never);

      expect(CatalogService.updateProduct).toHaveBeenCalledWith(
        "pkg_1",
        expect.objectContaining({
          name: "",
          kind: "PACKAGE",
          packageItems: [],
          package: undefined,
        }),
      );
      expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"5"');
    });

    it("maps a package breakdown and defaults the lead count", async () => {
      (CatalogService.createProduct as jest.Mock).mockResolvedValue({
        id: "pkg_1",
        version: 1,
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        body: {
          name: "Wellness",
          supportCount: 2,
          breakdown: [
            {
              childItemId: "svc_1",
              quantity: 2,
              pricingMode: "OVERRIDE_PRICE",
              overridePrice: 40,
              discountPercent: 5,
              sortOrder: 1,
              isOptional: true,
            },
            {
              childItemId: "svc_2",
              quantity: 1,
              pricingMode: "INCLUDED",
            },
          ],
        },
      };
      const res = createResponse();

      await CatalogController.createPackage(req as never, res as never);

      expect(CatalogService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          packageItems: [
            {
              childProductItemId: "svc_1",
              quantity: 2,
              pricingMode: "OVERRIDE_PRICE",
              overridePrice: 40,
              discountPercent: 5,
              sortOrder: 1,
              isOptional: true,
            },
            {
              childProductItemId: "svc_2",
              quantity: 1,
              pricingMode: "INCLUDED",
              overridePrice: null,
              discountPercent: null,
              sortOrder: undefined,
              isOptional: undefined,
            },
          ],
          package: {
            leadCount: 1,
            supportCount: 2,
            additionalDiscountPercent: 0,
            grossAmount: 0,
            itemDiscountAmount: 0,
            additionalDiscountAmount: 0,
            breakdownItemCount: 2,
          },
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("narrows the speciality service list to a single kind and keeps every match", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([
        { id: "svc_1", kind: "PROCEDURE", isActive: true },
        { id: "svc_2", kind: "PROCEDURE", isActive: false },
        { id: "pkg_1", kind: "PACKAGE", isActive: true },
      ]);

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: { kind: "PROCEDURE" },
      };
      const res = createResponse();

      await CatalogController.listServicesBySpeciality(
        req as never,
        res as never,
      );

      expect(CatalogService.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          kinds: ["PROCEDURE"],
          includeInactive: false,
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        items: [
          { id: "svc_1", kind: "PROCEDURE", isActive: true },
          { id: "svc_2", kind: "PROCEDURE", isActive: false },
        ],
      });
    });

    it("keeps only non-bookable services when isBookable=false", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([
        {
          id: "svc_1",
          kind: "CONSULTATION",
          isActive: true,
          bookable: { durationMinutes: 30 },
        },
        { id: "svc_2", kind: "CONSULTATION", isActive: true, bookable: null },
      ]);

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: { isBookable: "false" },
      };
      const res = createResponse();

      await CatalogController.listServicesBySpeciality(
        req as never,
        res as never,
      );

      expect(res.json).toHaveBeenCalledWith({
        items: [
          { id: "svc_2", kind: "CONSULTATION", isActive: true, bookable: null },
        ],
      });
    });

    it("keeps only active services when status=ACTIVE", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([
        { id: "svc_1", kind: "CONSULTATION", isActive: true },
        { id: "svc_2", kind: "CONSULTATION", isActive: false },
      ]);

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: { status: "ACTIVE" },
      };
      const res = createResponse();

      await CatalogController.listServicesBySpeciality(
        req as never,
        res as never,
      );

      expect(res.json).toHaveBeenCalledWith({
        items: [{ id: "svc_1", kind: "CONSULTATION", isActive: true }],
      });
    });

    it("keeps only bookable services when isBookable=true", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([
        {
          id: "svc_1",
          kind: "CONSULTATION",
          isActive: true,
          bookable: { durationMinutes: 30 },
        },
        { id: "svc_2", kind: "CONSULTATION", isActive: true, bookable: null },
      ]);

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: { isBookable: "true" },
      };
      const res = createResponse();

      await CatalogController.listServicesBySpeciality(
        req as never,
        res as never,
      );

      expect(res.json).toHaveBeenCalledWith({
        items: [
          {
            id: "svc_1",
            kind: "CONSULTATION",
            isActive: true,
            bookable: { durationMinutes: 30 },
          },
        ],
      });
    });

    it("keeps only archived packages when status=ARCHIVED", async () => {
      (CatalogService.listProducts as jest.Mock).mockResolvedValue([
        { id: "pkg_1", kind: "PACKAGE", isActive: true },
        { id: "pkg_2", kind: "PACKAGE", isActive: false },
      ]);

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: { status: "ARCHIVED" },
      };
      const res = createResponse();

      await CatalogController.listPackagesBySpeciality(
        req as never,
        res as never,
      );

      expect(res.json).toHaveBeenCalledWith({
        items: [{ id: "pkg_2", kind: "PACKAGE", isActive: false }],
      });
    });

    it("omits the archive search filter when the query has none", async () => {
      (CatalogService.getArchiveCatalog as jest.Mock).mockResolvedValue({
        services: [],
        packages: [],
      });

      const req = {
        params: { organisationId: "org_1", specialityId: "spec_1" },
        query: {},
      };
      const res = createResponse();

      await CatalogController.getArchiveCatalog(req as never, res as never);

      expect(CatalogService.getArchiveCatalog).toHaveBeenCalledWith(
        "org_1",
        "spec_1",
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("accepts the legacy serviceId alias for bookable slots", async () => {
      (CatalogService.getBookableSlotsService as jest.Mock).mockResolvedValue({
        windows: [],
      });

      const req = {
        params: { organisationId: "org_1" },
        body: { serviceId: "prod_legacy", date: "2026-03-04" },
      };
      const res = createResponse();

      await CatalogController.getCatalogBookableSlots(
        req as never,
        res as never,
      );

      expect(CatalogService.getBookableSlotsService).toHaveBeenCalledWith(
        "prod_legacy",
        "org_1",
        new Date("2026-03-04T00:00:00.000Z"),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("accepts the legacy serviceIds alias for calendar prefill", async () => {
      (CatalogService.getCalendarPrefillMatches as jest.Mock).mockResolvedValue(
        [],
      );

      const req = {
        organisationId: "org_1",
        params: { organisationId: "org_1" },
        body: {
          organisationId: "org_1",
          date: "2026-03-04",
          minuteOfDay: 480,
          serviceIds: ["prod_legacy"],
          leadId: "vet_1",
        },
      };
      const res = createResponse();

      await CatalogController.getCatalogCalendarPrefill(
        req as never,
        res as never,
      );

      expect(CatalogService.getCalendarPrefillMatches).toHaveBeenCalledWith({
        organisationId: "org_1",
        date: new Date("2026-03-04T00:00:00.000Z"),
        minuteOfDay: 480,
        leadId: "vet_1",
        serviceIds: ["prod_legacy"],
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { matches: [] },
      });
    });
  });

  describe("restore and delete flows", () => {
    it("restores a service and publishes the new version", async () => {
      (CatalogService.restoreProduct as jest.Mock).mockResolvedValue({
        id: "svc_1",
        version: 9,
      });

      const req = {
        params: { organisationId: "org_1", id: "svc_1" },
        header: () => 'W/"8"',
      };
      const res = createResponse();

      await CatalogController.restoreService(req as never, res as never);

      expect(CatalogService.restoreProduct).toHaveBeenCalledWith(
        "svc_1",
        "org_1",
        8,
      );
      expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"9"');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "svc_1", version: 9 });
    });

    it("archives a package and publishes the new version", async () => {
      (CatalogService.archiveProduct as jest.Mock).mockResolvedValue({
        id: "pkg_1",
        version: 4,
      });

      const req = {
        params: { organisationId: "org_1", id: "pkg_1" },
        header: () => 'W/"3"',
      };
      const res = createResponse();

      await CatalogController.archivePackage(req as never, res as never);

      expect(CatalogService.archiveProduct).toHaveBeenCalledWith(
        "pkg_1",
        "org_1",
        3,
      );
      expect(res.setHeader).toHaveBeenCalledWith("ETag", 'W/"4"');
      expect(res.json).toHaveBeenCalledWith({ id: "pkg_1", version: 4 });
    });

    it("returns 204 once a service is permanently deleted", async () => {
      (CatalogService.deleteProduct as jest.Mock).mockResolvedValue(undefined);

      const req = {
        params: { organisationId: "org_1", id: "svc_1" },
        header: noIfMatch,
      };
      const res = createResponse();

      await CatalogController.deleteService(req as never, res as never);

      expect(CatalogService.deleteProduct).toHaveBeenCalledWith(
        "svc_1",
        "org_1",
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith({});
    });
  });

  describe("payload and query validation", () => {
    const validationCases = [
      {
        name: "updateProduct rejects a non-HealthcareService body",
        run: CatalogController.updateProduct,
        req: {
          organisationId: "org_1",
          params: { id: "prod_1" },
          body: { resourceType: "Patient" },
          header: noIfMatch,
        },
        service: () => CatalogService.updateProduct as jest.Mock,
        message: "Invalid payload. Expected FHIR HealthcareService resource.",
      },
      {
        name: "getSpecialityCatalog rejects an unknown tab",
        run: CatalogController.getSpecialityCatalog,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          query: { tab: "bogus" },
        },
        service: () => CatalogService.getSpecialityCatalog as jest.Mock,
        message: "Invalid speciality catalog query.",
      },
      {
        name: "resolveProductOperation rejects a non-Parameters body",
        run: CatalogController.resolveProductOperation,
        req: { organisationId: "org_1", body: { resourceType: "Bundle" } },
        service: () => CatalogService.resolveSelection as jest.Mock,
        message: "Invalid FHIR Parameters payload.",
      },
      {
        name: "searchCatalogOperation rejects a non-Parameters body",
        run: CatalogController.searchCatalogOperation,
        req: { organisationId: "org_1", body: { resourceType: "Bundle" } },
        service: () => CatalogService.searchItems as jest.Mock,
        message: "Invalid FHIR Parameters payload.",
      },
      {
        name: "getOrganisationSummary rejects a tri-state flag it cannot parse",
        run: CatalogController.getOrganisationSummary,
        req: {
          params: { organisationId: "org_1" },
          query: { includeArchived: "maybe" },
        },
        service: () => CatalogService.getOrganisationSummary as jest.Mock,
        message: "Invalid organisation catalog summary query.",
      },
      {
        name: "listSpecialities rejects a non-positive page",
        run: CatalogController.listSpecialities,
        req: { params: { organisationId: "org_1" }, query: { page: "0" } },
        service: () => CatalogService.listSpecialities as jest.Mock,
        message: "Invalid specialities list query.",
      },
      {
        name: "createSpeciality rejects a blank name",
        run: CatalogController.createSpeciality,
        req: { params: { organisationId: "org_1" }, body: { name: "" } },
        service: () => CatalogService.createSpeciality as jest.Mock,
        message: "Invalid speciality payload.",
      },
      {
        name: "updateSpeciality rejects a malformed head avatar URL",
        run: CatalogController.updateSpeciality,
        req: {
          organisationId: "org_1",
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { headProfilePicUrl: "not-a-url" },
        },
        service: () => CatalogService.updateSpeciality as jest.Mock,
        message: "Invalid speciality payload.",
      },
      {
        name: "updateService rejects an unknown service kind",
        run: CatalogController.updateService,
        req: {
          params: { organisationId: "org_1", id: "prod_1" },
          body: { kind: "TELEPORTATION" },
          header: noIfMatch,
        },
        service: () => CatalogService.updateProduct as jest.Mock,
        message: "Invalid service payload.",
      },
      {
        name: "createService rejects a negative unit price",
        run: CatalogController.createService,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { name: "Consult", kind: "CONSULTATION", unitPrice: -1 },
        },
        service: () => CatalogService.createProduct as jest.Mock,
        message: "Invalid service payload.",
      },
      {
        name: "createService rejects an empty appointment mode list",
        run: CatalogController.createService,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: {
            name: "Consult",
            kind: "CONSULTATION",
            appointmentModes: [],
          },
        },
        service: () => CatalogService.createProduct as jest.Mock,
        message: "Invalid service payload.",
      },
      {
        name: "createPackage rejects a blank name",
        run: CatalogController.createPackage,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { name: "" },
        },
        service: () => CatalogService.createProduct as jest.Mock,
        message: "Invalid package payload.",
      },
      {
        name: "updatePackage rejects a breakdown row without a child item",
        run: CatalogController.updatePackage,
        req: {
          params: { organisationId: "org_1", id: "pkg_1" },
          body: {
            breakdown: [
              { childItemId: "", quantity: 1, pricingMode: "INCLUDED" },
            ],
          },
          header: noIfMatch,
        },
        service: () => CatalogService.updateProduct as jest.Mock,
        message: "Invalid package payload.",
      },
      {
        name: "searchItems rejects a non-positive page size",
        run: CatalogController.searchItems,
        req: { params: { organisationId: "org_1" }, query: { pageSize: "0" } },
        service: () => CatalogService.searchItems as jest.Mock,
        message: "Invalid catalog search query.",
      },
      {
        name: "getCatalogNearbyOrganisations rejects a non-numeric latitude",
        run: CatalogController.getCatalogNearbyOrganisations,
        req: { params: { organisationId: "org_1" }, query: { lat: "north" } },
        service: () =>
          CatalogService.listOrganisationsProvidingServiceNearby as jest.Mock,
        message: "Invalid catalog nearby search query.",
      },
      {
        name: "getCatalogBookableSlots rejects a date it cannot parse",
        run: CatalogController.getCatalogBookableSlots,
        req: {
          params: { organisationId: "org_1" },
          body: { productItemId: "prod_1", date: "not-a-date" },
        },
        service: () => CatalogService.getBookableSlotsService as jest.Mock,
        message: "Invalid catalog bookable slots payload.",
      },
      {
        name: "getCatalogCalendarPrefill rejects an out-of-range minute",
        run: CatalogController.getCatalogCalendarPrefill,
        req: {
          organisationId: "org_1",
          params: { organisationId: "org_1" },
          body: {
            organisationId: "org_1",
            date: "2026-03-04",
            minuteOfDay: 2000,
            productItemIds: ["prod_1"],
          },
        },
        service: () => CatalogService.getCalendarPrefillMatches as jest.Mock,
        message: "Invalid catalog calendar prefill payload.",
      },
    ];

    it.each(validationCases)(
      "$name",
      async ({ run, req, service, message }) => {
        const res = createResponse();

        await run(req as never, res as never);

        expect(service()).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message, errors: expect.anything() }),
        );
      },
    );

    it("reports the missing name when a speciality payload parses but is empty", async () => {
      const res = createResponse();

      await CatalogController.createSpeciality(
        { params: { organisationId: "org_1" }, body: {} } as never,
        res as never,
      );

      expect(CatalogService.createSpeciality).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid speciality payload.",
        errors: { fieldErrors: { name: ["Name is required."] } },
      });
    });

    it("reports the missing name when a package payload parses but is empty", async () => {
      const res = createResponse();

      await CatalogController.createPackage(
        {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: {},
        } as never,
        res as never,
      );

      expect(CatalogService.createProduct).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid package payload.",
        errors: { fieldErrors: { name: ["Name is required."] } },
      });
    });

    it.each([
      [{}, { name: ["Name is required."], kind: ["Kind is required."] }],
      [{ name: "Consult" }, { kind: ["Kind is required."] }],
      [{ kind: "PROCEDURE" }, { name: ["Name is required."] }],
    ])(
      "reports the missing service fields for %p",
      async (body, fieldErrors) => {
        const res = createResponse();

        await CatalogController.createService(
          {
            params: { organisationId: "org_1", specialityId: "spec_1" },
            body,
          } as never,
          res as never,
        );

        expect(CatalogService.createProduct).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Invalid service payload.",
          errors: { fieldErrors },
        });
      },
    );

    it("rejects bookable slots that name neither a product nor a service", async () => {
      const res = createResponse();

      await CatalogController.getCatalogBookableSlots(
        {
          params: { organisationId: "org_1" },
          body: { date: "2026-03-04" },
        } as never,
        res as never,
      );

      expect(CatalogService.getBookableSlotsService).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "productItemId is required.",
      });
    });

    it("rejects calendar prefill that names no catalog items", async () => {
      const res = createResponse();

      await CatalogController.getCatalogCalendarPrefill(
        {
          organisationId: "org_1",
          params: { organisationId: "org_1" },
          body: {
            organisationId: "org_1",
            date: "2026-03-04",
            minuteOfDay: 600,
          },
        } as never,
        res as never,
      );

      expect(CatalogService.getCalendarPrefillMatches).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "productItemIds is required.",
      });
    });
  });

  describe("service failures", () => {
    const failureCases = [
      {
        name: "createProduct",
        run: CatalogController.createProduct,
        service: () => CatalogService.createProduct as jest.Mock,
        req: { body: healthcareServiceBody },
        message: "Unable to create catalog product.",
      },
      {
        name: "updateProduct",
        run: CatalogController.updateProduct,
        service: () => CatalogService.updateProduct as jest.Mock,
        req: {
          organisationId: "org_1",
          params: { id: "prod_1" },
          body: healthcareServiceBody,
          header: noIfMatch,
        },
        message: "Unable to update catalog product.",
      },
      {
        name: "getProductById",
        run: CatalogController.getProductById,
        service: () => CatalogService.getProductById as jest.Mock,
        req: {
          organisationId: "org_1",
          params: { id: "prod_1" },
          query: {},
        },
        message: "Unable to fetch catalog product.",
      },
      {
        name: "getPackageDetail",
        run: CatalogController.getPackageDetail,
        service: () => CatalogService.getPackageDetail as jest.Mock,
        req: { organisationId: "org_1", params: { id: "pkg_1" }, query: {} },
        message: "Unable to fetch catalog package.",
      },
      {
        name: "listProducts",
        run: CatalogController.listProducts,
        service: () => CatalogService.listProducts as jest.Mock,
        req: {
          organisationId: "org_1",
          params: { organisationId: "org_1" },
          query: {},
          baseUrl: "/web/catalog",
        },
        message: "Unable to list catalog products.",
      },
      {
        name: "getSpecialityCatalog",
        run: CatalogController.getSpecialityCatalog,
        service: () => CatalogService.getSpecialityCatalog as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          query: {},
        },
        message: "Unable to fetch speciality catalog.",
      },
      {
        name: "resolveProduct",
        run: CatalogController.resolveProduct,
        service: () => CatalogService.resolveSelection as jest.Mock,
        req: { organisationId: "org_1", body: { productItemId: "prod_1" } },
        message: "Unable to resolve catalog product.",
      },
      {
        name: "resolveProductOperation",
        run: CatalogController.resolveProductOperation,
        service: () => CatalogService.resolveSelection as jest.Mock,
        req: {
          organisationId: "org_1",
          body: {
            resourceType: "Parameters",
            parameter: [{ name: "productItemId", valueString: "prod_1" }],
          },
        },
        message: "Unable to resolve healthcare service operation.",
      },
      {
        name: "searchCatalogOperation",
        run: CatalogController.searchCatalogOperation,
        service: () => CatalogService.searchItems as jest.Mock,
        req: {
          organisationId: "org_1",
          body: {
            resourceType: "Parameters",
            parameter: [
              { name: "organization", valueString: "Organization/org_1" },
            ],
          },
        },
        message: "Unable to execute healthcare service search operation.",
      },
      {
        name: "getOrganisationSummary",
        run: CatalogController.getOrganisationSummary,
        service: () => CatalogService.getOrganisationSummary as jest.Mock,
        req: { params: { organisationId: "org_1" }, query: {} },
        message: "Unable to fetch organisation catalog summary.",
      },
      {
        name: "listSpecialities",
        run: CatalogController.listSpecialities,
        service: () => CatalogService.listSpecialities as jest.Mock,
        req: { params: { organisationId: "org_1" }, query: {} },
        message: "Unable to list catalog specialities.",
      },
      {
        name: "createSpeciality",
        run: CatalogController.createSpeciality,
        service: () => CatalogService.createSpeciality as jest.Mock,
        req: { params: { organisationId: "org_1" }, body: { name: "Cardio" } },
        message: "Unable to create catalog speciality.",
      },
      {
        name: "updateSpeciality",
        run: CatalogController.updateSpeciality,
        service: () => CatalogService.updateSpeciality as jest.Mock,
        req: {
          organisationId: "org_1",
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { name: "Cardio" },
        },
        message: "Unable to update catalog speciality.",
      },
      {
        name: "archiveSpeciality",
        run: CatalogController.archiveSpeciality,
        service: () => CatalogService.archiveSpeciality as jest.Mock,
        req: { params: { organisationId: "org_1", specialityId: "spec_1" } },
        message: "Unable to archive catalog speciality.",
      },
      {
        name: "restoreSpeciality",
        run: CatalogController.restoreSpeciality,
        service: () => CatalogService.restoreSpeciality as jest.Mock,
        req: { params: { organisationId: "org_1", specialityId: "spec_1" } },
        message: "Unable to restore catalog speciality.",
      },
      {
        name: "deleteSpeciality",
        run: CatalogController.deleteSpeciality,
        service: () => CatalogService.deleteSpeciality as jest.Mock,
        req: { params: { organisationId: "org_1", specialityId: "spec_1" } },
        message: "Unable to delete catalog speciality.",
      },
      {
        name: "listServicesBySpeciality",
        run: CatalogController.listServicesBySpeciality,
        service: () => CatalogService.listProducts as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          query: {},
        },
        message: "Unable to list speciality services.",
      },
      {
        name: "createService",
        run: CatalogController.createService,
        service: () => CatalogService.createProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { name: "X-Ray", kind: "DIAGNOSTIC" },
        },
        message: "Unable to create service.",
      },
      {
        name: "updateService",
        run: CatalogController.updateService,
        service: () => CatalogService.updateProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "prod_1" },
          body: {},
          header: noIfMatch,
        },
        message: "Unable to update service.",
      },
      {
        name: "archiveService",
        run: CatalogController.archiveService,
        service: () => CatalogService.archiveProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "prod_1" },
          header: noIfMatch,
        },
        message: "Unable to archive service.",
      },
      {
        name: "restoreService",
        run: CatalogController.restoreService,
        service: () => CatalogService.restoreProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "prod_1" },
          header: noIfMatch,
        },
        message: "Unable to restore service.",
      },
      {
        name: "deleteService",
        run: CatalogController.deleteService,
        service: () => CatalogService.deleteProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "prod_1" },
          header: noIfMatch,
        },
        message: "Unable to delete service.",
      },
      {
        name: "listPackagesBySpeciality",
        run: CatalogController.listPackagesBySpeciality,
        service: () => CatalogService.listProducts as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          query: {},
        },
        message: "Unable to list speciality packages.",
      },
      {
        name: "createPackage",
        run: CatalogController.createPackage,
        service: () => CatalogService.createProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          body: { name: "Wellness" },
        },
        message: "Unable to create package.",
      },
      {
        name: "updatePackage",
        run: CatalogController.updatePackage,
        service: () => CatalogService.updateProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "pkg_1" },
          body: {},
          header: noIfMatch,
        },
        message: "Unable to update package.",
      },
      {
        name: "archivePackage",
        run: CatalogController.archivePackage,
        service: () => CatalogService.archiveProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "pkg_1" },
          header: noIfMatch,
        },
        message: "Unable to archive package.",
      },
      {
        name: "restorePackage",
        run: CatalogController.restorePackage,
        service: () => CatalogService.restoreProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "pkg_1" },
          header: noIfMatch,
        },
        message: "Unable to restore package.",
      },
      {
        name: "deletePackage",
        run: CatalogController.deletePackage,
        service: () => CatalogService.deleteProduct as jest.Mock,
        req: {
          params: { organisationId: "org_1", id: "pkg_1" },
          header: noIfMatch,
        },
        message: "Unable to delete package.",
      },
      {
        name: "searchItems",
        run: CatalogController.searchItems,
        service: () => CatalogService.searchItems as jest.Mock,
        req: { params: { organisationId: "org_1" }, query: {} },
        message: "Unable to search catalog items.",
      },
      {
        name: "getArchiveCatalog",
        run: CatalogController.getArchiveCatalog,
        service: () => CatalogService.getArchiveCatalog as jest.Mock,
        req: {
          params: { organisationId: "org_1", specialityId: "spec_1" },
          query: {},
        },
        message: "Unable to fetch archived catalog items.",
      },
      {
        name: "getCatalogNearbyOrganisations",
        run: CatalogController.getCatalogNearbyOrganisations,
        service: () =>
          CatalogService.listOrganisationsProvidingServiceNearby as jest.Mock,
        req: { params: { organisationId: "org_1" }, query: {} },
        message: "Unable to fetch nearby catalog organisations.",
      },
      {
        name: "getCatalogBookableSlots",
        run: CatalogController.getCatalogBookableSlots,
        service: () => CatalogService.getBookableSlotsService as jest.Mock,
        req: {
          params: { organisationId: "org_1" },
          body: { productItemId: "prod_1", date: "2026-03-04" },
        },
        message: "Unable to fetch catalog bookable slots.",
      },
      {
        name: "getCatalogCalendarPrefill",
        run: CatalogController.getCatalogCalendarPrefill,
        service: () => CatalogService.getCalendarPrefillMatches as jest.Mock,
        req: {
          organisationId: "org_1",
          params: { organisationId: "org_1" },
          body: {
            organisationId: "org_1",
            date: "2026-03-04",
            minuteOfDay: 600,
            productItemIds: ["prod_1"],
          },
        },
        message: "Unable to fetch catalog calendar prefill.",
      },
    ];

    it.each(failureCases)(
      "$name logs and answers 500 when the service throws",
      async ({ run, req, service, message }) => {
        const failure = new Error("boom");
        service().mockRejectedValueOnce(failure);
        const res = createResponse();

        await run(req as never, res as never);

        expect(mockedLogger.error).toHaveBeenCalledWith(message, failure);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message });
      },
    );
  });
});
