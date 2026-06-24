import { CatalogController } from "../../src/controllers/web/catalog.controller";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";

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
      params: { organisationId: "unused" },
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
});
