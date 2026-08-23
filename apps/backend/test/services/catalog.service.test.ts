import {
  CatalogService,
  CatalogServiceError,
  assertBookableConfig,
  assertPackageItems,
  assertPriceConfig,
  buildPackageGraph,
  ensureCodeUniqueness,
  ensurePackageItemsValid,
  ensureProductDeletionAllowed,
  ensureSpecialityDeletionAllowed,
  ensureSpecialityExists,
  ensureSpecialityNameUnique,
  generateProductCode,
  getPackageDepth,
  mapSpecialitySummaries,
  packageContainsTarget,
  resolveCatalogSchedulingContext,
  resolveCatalogSelectionFromRecord,
  requireSafeString,
  optionalSafeString,
  sanitizePackageItems,
  sanitizeTeamMemberIds,
} from "../../src/services/catalog.service";
import { AvailabilityService } from "../../src/services/availability.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    productItem: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    productPrice: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    productBookable: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    productPackage: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    productPackageItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    templateCatalogLink: {
      findMany: jest.fn(),
    },
    speciality: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/availability.service", () => ({
  AvailabilityService: {
    getBookableSlotsForDate: jest.fn(),
  },
}));

describe("CatalogService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
      id: "spec_1",
    });
    (prisma.appointment.count as jest.Mock).mockResolvedValue(0);
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.count as jest.Mock).mockResolvedValue(0);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productPackageItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
    (
      AvailabilityService.getBookableSlotsForDate as jest.Mock
    ).mockResolvedValue({ windows: [] });
    (prisma.productItem.findFirst as jest.Mock).mockImplementation(
      (args?: { where?: { code?: string; id?: string } }) => {
        if (args?.where?.code) {
          return Promise.resolve(null);
        }

        return Promise.resolve(null);
      },
    );
  });

  it("resolves a direct bookable product into one billing item", () => {
    const resolved = resolveCatalogSelectionFromRecord(
      {
        id: "prod_consult",
        version: 1,
        organisationId: "org_1",
        name: "General Consultation",
        description: null,
        code: null,
        kind: "CONSULTATION",
        specialityId: null,
        legacyServiceId: "svc_consult",
        isActive: true,
        prices: [
          {
            unitPrice: 80,
            currency: "USD",
            defaultDiscountPercent: 5,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: null,
      },
      [
        {
          templateKind: "SOAP_NOTE",
          templateId: "tmpl_soap",
          templateVersion: 3,
        },
      ],
    );

    expect(resolved).toEqual(
      expect.objectContaining({
        productItemId: "prod_consult",
        productKind: "CONSULTATION",
        name: "General Consultation",
        code: null,
        currency: "USD",
        legacyServiceId: "svc_consult",
        isBookable: true,
        appointmentKinds: ["OUTPATIENT"],
        grossAmount: 80,
        itemDiscountAmount: 4,
        additionalDiscountAmount: 0,
        finalAmount: 76,
        breakdownItemCount: 1,
        templateKinds: ["SOAP_NOTE"],
        templateBindings: [
          {
            templateKind: "SOAP_NOTE",
            templateId: "tmpl_soap",
            templateVersion: 3,
          },
        ],
      }),
    );
    expect(resolved.billingItems).toEqual([
      expect.objectContaining({
        productItemId: "prod_consult",
        code: null,
        name: "General Consultation",
        kind: "CONSULTATION",
        quantity: 1,
        currency: "USD",
        unitPrice: 80,
        referenceUnitPrice: null,
        defaultDiscountPercent: 5,
        maxDiscountPercent: 10,
        discountPercent: 5,
        grossAmount: 80,
        discountAmount: 4,
        finalAmount: 76,
        isPackageComponent: false,
        packageProductItemId: null,
      }),
    ]);
  });

  it("expands a package into parent, included items, and priced child items", () => {
    const resolved = resolveCatalogSelectionFromRecord({
      id: "pkg_dental",
      version: 1,
      organisationId: "org_1",
      name: "Dental Bundle",
      description: null,
      code: null,
      kind: "PACKAGE",
      specialityId: null,
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 15,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 45,
        supportsOutpatient: true,
        supportsInpatient: true,
      },
      package: {
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 10,
        items: [
          {
            id: "pkg_item_exam",
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
            discountPercent: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_exam",
              name: "Dental Exam",
              code: "CS-EXAM",
              kind: "CONSULTATION",
              isActive: true,
              prices: [
                {
                  unitPrice: 90,
                  currency: "USD",
                  defaultDiscountPercent: null,
                  maxDiscountPercent: 10,
                  isDefault: true,
                },
              ],
            },
          },
          {
            id: "pkg_item_xray",
            childProductItemId: "prod_xray",
            quantity: 2,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: 40,
            discountPercent: 0,
            sortOrder: 1,
            isOptional: false,
            childProductItem: {
              id: "prod_xray",
              name: "Dental X-Ray",
              code: "DX-XRAY",
              kind: "DIAGNOSTIC",
              isActive: true,
              prices: [
                {
                  unitPrice: 55,
                  currency: "USD",
                  defaultDiscountPercent: null,
                  maxDiscountPercent: 10,
                  isDefault: true,
                },
              ],
            },
          },
        ],
      },
    });

    expect(resolved.appointmentKinds).toEqual(["OUTPATIENT", "INPATIENT"]);
    expect(resolved.templateKinds).toEqual([
      "TASK_ASSIGNMENT",
      "INPATIENT_SCHEDULE",
      "SOAP_NOTE",
      "DISCHARGE_SUMMARY",
    ]);
    // The package's own price (250) is its LIST price - what its components add
    // up to. Billing it alongside the components charged the package twice, so
    // only the priced components are billable here: 2 x 40 = 80 gross.
    expect(resolved).toEqual(
      expect.objectContaining({
        name: "Dental Bundle",
        currency: "USD",
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 10,
        grossAmount: 80,
        itemDiscountAmount: 0,
        additionalDiscountAmount: 8,
        finalAmount: 72,
      }),
    );
    expect(resolved.billingItems).toEqual([
      expect.objectContaining({
        productItemId: "prod_xray",
        code: "DX-XRAY",
        name: "Dental X-Ray",
        kind: "DIAGNOSTIC",
        quantity: 2,
        currency: "USD",
        unitPrice: 40,
        referenceUnitPrice: 55,
        defaultDiscountPercent: null,
        maxDiscountPercent: 10,
        discountPercent: 0,
        grossAmount: 80,
        discountAmount: 0,
        finalAmount: 80,
        isPackageComponent: true,
        packageProductItemId: "pkg_dental",
      }),
    ]);
    expect(resolved.includedItems).toEqual([
      expect.objectContaining({
        productItemId: "prod_exam",
        code: "CS-EXAM",
        name: "Dental Exam",
        kind: "CONSULTATION",
        quantity: 1,
        currency: "USD",
        unitPrice: 0,
        referenceUnitPrice: 90,
        defaultDiscountPercent: null,
        maxDiscountPercent: 10,
        discountPercent: 0,
        grossAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
        isPackageComponent: true,
        packageProductItemId: "pkg_dental",
      }),
    ]);
  });

  it("bills the package price itself when every component is included", () => {
    // With nothing else billable, the package price IS the charge - dropping it
    // here would make an all-inclusive package free.
    const resolved = resolveCatalogSelectionFromRecord({
      id: "pkg_wellness",
      version: 1,
      organisationId: "org_1",
      name: "Wellness Bundle",
      description: null,
      code: null,
      kind: "PACKAGE",
      specialityId: null,
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 150,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 20,
          isDefault: true,
        },
      ],
      bookable: null,
      package: {
        leadCount: 1,
        supportCount: 0,
        additionalDiscountPercent: 0,
        items: [
          {
            id: "pkg_item_exam",
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
            discountPercent: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_exam",
              name: "Wellness Exam",
              code: "WE-EXAM",
              kind: "CONSULTATION",
              isActive: true,
              prices: [
                {
                  unitPrice: 150,
                  currency: "USD",
                  defaultDiscountPercent: null,
                  maxDiscountPercent: 10,
                  isDefault: true,
                },
              ],
            },
          },
        ],
      },
    });

    expect(resolved.billingItems).toHaveLength(1);
    expect(resolved.billingItems[0]).toEqual(
      expect.objectContaining({
        productItemId: "pkg_wellness",
        unitPrice: 150,
        isPackageComponent: false,
      }),
    );
    expect(resolved.finalAmount).toBe(150);
    expect(resolved.includedItems).toHaveLength(1);
  });

  it("builds organisation speciality summary counts from product items", async () => {
    (prisma.speciality.findMany as jest.Mock).mockResolvedValue([
      {
        id: "spec_1",
        organisationId: "org_1",
        name: "Cardiology",
        headUserId: "user_1",
        headName: "Dr. Lee",
        headProfilePicUrl: null,
        memberUserIds: ["user_2"],
        createdAt: new Date("2026-06-09T00:00:00.000Z"),
        updatedAt: new Date("2026-06-09T00:00:00.000Z"),
      },
    ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        specialityId: "spec_1",
        isActive: true,
        kind: "CONSULTATION",
        name: "Consult",
        code: "CS-0001",
        description: null,
      },
      {
        specialityId: "spec_1",
        isActive: false,
        kind: "PACKAGE",
        name: "Bundle",
        code: "PK-0001",
        description: null,
      },
    ]);

    const result = await CatalogService.getOrganisationSummary("org_1");

    expect(result).toEqual({
      organisationId: "org_1",
      items: [
        expect.objectContaining({
          id: "spec_1",
          activeServiceCount: 1,
          activePackageCount: 0,
          archivedServiceCount: 0,
          archivedPackageCount: 1,
          teamMemberIds: ["user_2", "user_1"],
        }),
      ],
    });
  });

  it("blocks permanent delete when a product has dependent appointments", async () => {
    (prisma.appointment.count as jest.Mock).mockResolvedValue(3);
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "prod_1",
    });

    await expect(
      CatalogService.deleteProduct("prod_1", "org_1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CATALOG_ITEM_HAS_DEPENDENCIES",
      details: expect.objectContaining({
        appointments: 3,
      }),
    });
  });

  it("creates a catalogue speciality with deduped team members", async () => {
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.speciality.create as jest.Mock).mockResolvedValue({
      id: "spec_1",
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      memberUserIds: ["user_2", "user_1"],
      isActive: true,
    });

    const created = await CatalogService.createSpeciality({
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: "user_1",
      teamMemberIds: ["user_2", "user_1"],
    });

    expect(prisma.speciality.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberUserIds: ["user_2", "user_1"],
        }),
      }),
    );
    expect(created.id).toBe("spec_1");
  });

  it("rejects package updates that would create a cycle", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pkg_parent",
      version: 1,
      organisationId: "org_1",
      kind: "PACKAGE",
      code: "PK-0001",
      specialityId: "spec_1",
      prices: [],
      bookable: null,
      package: { items: [] },
    });
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "pkg_child",
          version: 1,
          organisationId: "org_1",
          name: "Child Package",
          description: null,
          code: "PK-0002",
          kind: "PACKAGE",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          package: { items: [{ childProductItemId: "pkg_parent" }] },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pkg_parent",
          version: 1,
          package: { items: [] },
        },
        {
          id: "pkg_child",
          version: 1,
          package: { items: [{ childProductItemId: "pkg_parent" }] },
        },
      ]);

    await expect(
      CatalogService.updateProduct("pkg_parent", {
        organisationId: "org_1",
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "pkg_child",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PACKAGE_HAS_CYCLE",
    });
  });

  it("throws when an override-priced package item has no override price", () => {
    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_invalid",
        version: 1,
        organisationId: "org_1",
        name: "Invalid Bundle",
        description: null,
        code: null,
        kind: "PACKAGE",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [
            {
              id: "pkg_item_lab",
              childProductItemId: "prod_lab",
              quantity: 1,
              pricingMode: "OVERRIDE_PRICE",
              overridePrice: null,
              discountPercent: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_lab",
                name: "CBC",
                code: null,
                kind: "LAB_TEST",
                isActive: true,
                prices: [],
              },
            },
          ],
        },
      }),
    ).toThrow(
      new CatalogServiceError(
        "Package component CBC is missing override price.",
        500,
      ),
    );
  });

  it("covers low-level string and config validation helpers", async () => {
    expect(() => requireSafeString(42, "name")).toThrow(
      new CatalogServiceError("name is required.", 400),
    );
    expect(() => requireSafeString("  ", "name")).toThrow(
      new CatalogServiceError("name is required.", 400),
    );
    expect(() => requireSafeString("bad$input", "name")).toThrow(
      new CatalogServiceError("Invalid name.", 400),
    );

    expect(optionalSafeString(null)).toBeNull();
    expect(optionalSafeString("  text  ")).toBe("text");
    expect(() => optionalSafeString(42)).toThrow(
      new CatalogServiceError("Invalid string value.", 400),
    );

    expect(() =>
      assertPackageItems("CONSULTATION", [
        { childProductItemId: "child", quantity: 1, pricingMode: "INCLUDED" },
      ]),
    ).toThrow(
      new CatalogServiceError(
        "Only products with kind PACKAGE can define package items.",
        400,
      ),
    );
    expect(() => assertPackageItems("PACKAGE", null)).toThrow(
      new CatalogServiceError(
        "Package products must include packageItems.",
        400,
      ),
    );

    expect(() =>
      assertBookableConfig({
        durationMinutes: 0,
        supportsOutpatient: false,
        supportsInpatient: false,
      }),
    ).toThrow(
      new CatalogServiceError(
        "Bookable durationMinutes must be a positive integer.",
        400,
      ),
    );
    expect(() =>
      assertBookableConfig({
        durationMinutes: 15,
        supportsOutpatient: false,
        supportsInpatient: false,
      }),
    ).toThrow(
      new CatalogServiceError(
        "Bookable products must support at least one appointment kind.",
        400,
      ),
    );

    expect(() => assertPriceConfig({ unitPrice: -1 } as any)).toThrow(
      new CatalogServiceError("Price unitPrice cannot be negative.", 400),
    );
    expect(() =>
      assertPriceConfig({
        unitPrice: 10,
        defaultDiscountPercent: 101,
      } as any),
    ).toThrow(
      new CatalogServiceError(
        "defaultDiscountPercent must be between 0 and 100.",
        400,
      ),
    );
    expect(() =>
      assertPriceConfig({
        unitPrice: 10,
        maxDiscountPercent: 101,
      } as any),
    ).toThrow(
      new CatalogServiceError(
        "maxDiscountPercent must be between 0 and 100.",
        400,
      ),
    );
    expect(() =>
      assertPriceConfig({
        unitPrice: 10,
        defaultDiscountPercent: 20,
        maxDiscountPercent: 10,
      } as any),
    ).toThrow(
      new CatalogServiceError(
        "defaultDiscountPercent cannot exceed maxDiscountPercent.",
        400,
      ),
    );

    expect(() =>
      sanitizePackageItems([
        {
          childProductItemId: "child",
          quantity: 0,
          pricingMode: "INCLUDED",
        },
      ]),
    ).toThrow(
      new CatalogServiceError(
        "packageItems[0].quantity must be a positive integer.",
        400,
      ),
    );
    expect(() =>
      sanitizePackageItems([
        {
          childProductItemId: "child",
          quantity: 1,
          pricingMode: "OVERRIDE_PRICE",
          overridePrice: null,
        },
      ]),
    ).toThrow(
      new CatalogServiceError(
        "packageItems[0].overridePrice is required for OVERRIDE_PRICE.",
        400,
      ),
    );
    expect(() =>
      sanitizePackageItems([
        {
          childProductItemId: "child",
          quantity: 1,
          pricingMode: "INCLUDED",
          discountPercent: 101,
        },
      ]),
    ).toThrow(
      new CatalogServiceError(
        "packageItems[0].discountPercent must be between 0 and 100.",
        400,
      ),
    );

    expect(() => sanitizeTeamMemberIds("bad" as any)).toThrow(
      new CatalogServiceError("teamMemberIds must be an array.", 400),
    );
  });

  it("covers package graph and dependency helpers", async () => {
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "pkg_1",
          package: {
            items: [{ childProductItemId: "pkg_2" }],
          },
        },
        {
          id: "pkg_2",
          package: {
            items: [{ childProductItemId: "pkg_1" }],
          },
        },
      ])
      .mockResolvedValueOnce([
        { code: "CS-0003" },
        { code: "CS-0007" },
        { code: "CS-ABCD" },
      ]);
    (prisma.productPackageItem.findFirst as jest.Mock).mockResolvedValue({
      id: "ppi_1",
      packageId: "pkg_1",
    });
    (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(2);
    (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "appt_1" },
    ]);
    (prisma.invoice.count as jest.Mock).mockResolvedValueOnce(1);

    const graph = await buildPackageGraph("org_1");
    expect(graph.get("pkg_1")).toEqual(["pkg_2"]);
    expect(getPackageDepth(graph, "pkg_1")).toBeGreaterThan(1);
    expect(packageContainsTarget(graph, "pkg_1", "pkg_missing")).toBe(false);
    expect(packageContainsTarget(graph, "pkg_1", "pkg_2")).toBe(true);

    await expect(generateProductCode("org_1", "CONSULTATION")).resolves.toBe(
      "CS-0008",
    );

    (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      ensureSpecialityExists("org_1", "spec_missing"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "dup_1",
    });
    await expect(
      ensureCodeUniqueness({
        organisationId: "org_1",
        code: "CS-0007",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_CATALOG_CODE",
    });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        packageItems: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });

    await expect(
      ensureSpecialityDeletionAllowed("spec_1", "org_1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SPECIALITY_HAS_DEPENDENCIES",
    });
  });

  it("covers speciality summary and package item validation branches", async () => {
    const summaries = mapSpecialitySummaries({
      specialities: [
        {
          id: "spec_2",
          organisationId: "org_1",
          name: "Cardiology",
          headUserId: "user_2",
          headName: "Dr. Heart",
          headProfilePicUrl: null,
          memberUserIds: ["user_3"],
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      products: [
        {
          specialityId: "spec_2",
          isActive: true,
          kind: "CONSULTATION",
          name: "Heart check",
          code: "CS-1",
          description: "Cardiology consult",
        },
      ],
      search: "heart",
    });
    expect(summaries).toEqual([
      expect.objectContaining({
        id: "spec_2",
        activeServiceCount: 1,
        teamMemberIds: ["user_3", "user_2"],
      }),
    ]);

    (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      ensureSpecialityNameUnique({
        organisationId: "org_1",
        name: "Cardiology",
      }),
    ).resolves.toBeUndefined();

    (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "spec_2",
    });
    await expect(
      ensureSpecialityNameUnique({
        organisationId: "org_1",
        name: "Cardiology",
        excludeId: "spec_1",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_SPECIALITY_NAME",
    });

    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "child_1",
          isActive: false,
          prices: [],
          package: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "child_1",
          isActive: true,
          prices: [],
          package: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "child_1",
          isActive: true,
          prices: [{ maxDiscountPercent: 5 }],
          package: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pkg_1",
          isActive: true,
          prices: [],
          package: { items: [{ childProductItemId: "child_1" }] },
        },
        {
          id: "child_1",
          isActive: true,
          prices: [],
          package: { items: [{ childProductItemId: "pkg_1" }] },
        },
      ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "child_1",
        isActive: true,
        prices: [{ maxDiscountPercent: 5 }],
        package: null,
      },
    ]);

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        packageItems: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        packageItems: [
          {
            childProductItemId: "missing_child",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_CHILD_UNAVAILABLE" });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        currentProductId: "pkg_1",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "PACKAGE_CHILD_UNAVAILABLE",
      details: { childProductItemId: "child_1" },
    });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        currentProductId: "child_1",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_HAS_CYCLE" });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        currentProductId: "pkg_1",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_HAS_CYCLE" });

    await expect(
      ensurePackageItemsValid({
        organisationId: "org_1",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
            discountPercent: 10,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_ITEM_DISCOUNT_TOO_HIGH" });
  });

  it("rejects inactive selections and package records with missing config", () => {
    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "prod_inactive",
        version: 1,
        organisationId: "org_1",
        name: "Inactive Consult",
        description: null,
        code: null,
        kind: "CONSULTATION",
        specialityId: null,
        legacyServiceId: null,
        isActive: false,
        prices: [],
        bookable: null,
        package: null,
      }),
    ).toThrow(new CatalogServiceError("Selected product is inactive.", 400));

    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_missing",
        version: 1,
        organisationId: "org_1",
        name: "Missing Package",
        description: null,
        code: null,
        kind: "PACKAGE",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: null,
      }),
    ).toThrow(
      new CatalogServiceError(
        "Package product is missing package configuration.",
        500,
      ),
    );
  });

  it("covers medication and package child validation branches", () => {
    const medication = resolveCatalogSelectionFromRecord({
      id: "med_1",
      version: 1,
      organisationId: "org_1",
      name: "Antibiotic",
      description: null,
      code: "MD-1",
      kind: "MEDICATION",
      specialityId: null,
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 25,
          currency: "USD",
          defaultDiscountPercent: 0,
          maxDiscountPercent: 5,
          isDefault: true,
        },
      ],
      bookable: null,
      package: null,
    });

    expect(medication.templateKinds).toEqual(["PRESCRIPTION"]);

    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_inactive_child",
        version: 1,
        organisationId: "org_1",
        name: "Broken Package",
        description: null,
        code: null,
        kind: "PACKAGE",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 100,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [
            {
              id: "pkg_item_1",
              childProductItemId: "prod_child",
              quantity: 1,
              pricingMode: "INCLUDED",
              overridePrice: null,
              discountPercent: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_child",
                name: "Child",
                code: null,
                kind: "CONSULTATION",
                isActive: false,
                prices: [
                  {
                    unitPrice: 40,
                    currency: "USD",
                    defaultDiscountPercent: null,
                    maxDiscountPercent: 10,
                    isDefault: true,
                  },
                ],
              },
            },
          ],
        },
      }),
    ).toThrow(
      new CatalogServiceError("Package component Child is inactive.", 400),
    );

    expect(() =>
      resolveCatalogSelectionFromRecord({
        id: "pkg_inherited_missing_price",
        version: 1,
        organisationId: "org_1",
        name: "Broken Package 2",
        description: null,
        code: null,
        kind: "PACKAGE",
        specialityId: null,
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [
            {
              id: "pkg_item_2",
              childProductItemId: "prod_child_2",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              overridePrice: null,
              discountPercent: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_child_2",
                name: "Child Two",
                code: null,
                kind: "CONSULTATION",
                isActive: true,
                prices: [],
              },
            },
          ],
        },
      }),
    ).toThrow(
      new CatalogServiceError(
        "Package component Child Two is missing default price.",
        500,
      ),
    );
  });

  it("loads a product from prisma when resolving by id", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "prod_consult",
      version: 1,
      organisationId: "org_1",
      name: "General Consultation",
      description: null,
      code: null,
      kind: "CONSULTATION",
      specialityId: null,
      legacyServiceId: "svc_consult",
      isActive: true,
      prices: [
        {
          unitPrice: 80,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: null,
    });

    const resolved = await CatalogService.resolveSelection(
      "prod_consult",
      "org_1",
    );

    expect(prisma.productItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "prod_consult" }, { legacyServiceId: "prod_consult" }],
          organisationId: "org_1",
        },
      }),
    );
    expect(resolved.productItemId).toBe("prod_consult");
  });

  it("creates a package product with nested price, bookable settings, and package items", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_exam",
        version: 1,
        organisationId: "org_1",
        name: "Exam",
        description: null,
        code: "CS-0002",
        kind: "DIAGNOSTIC",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        package: null,
      },
    ]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.productItem.create as jest.Mock).mockResolvedValue({
      id: "prod_pkg",
      version: 1,
      organisationId: "org_1",
      name: "Dental Bundle",
      description: "desc",
      code: "DENTAL",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: 5,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 45,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: {
        items: [
          {
            id: "pkg_item_1",
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INCLUDED",
            overridePrice: null,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_exam",
              version: 1,
              name: "Exam",
              kind: "DIAGNOSTIC",
              isActive: true,
              prices: [],
            },
          },
        ],
      },
    });

    const created = await CatalogService.createProduct({
      organisationId: "org_1",
      name: "Dental Bundle",
      description: "desc",
      code: "DENTAL",
      kind: "PACKAGE",
      specialityId: "spec_1",
      price: {
        unitPrice: 250,
        currency: "USD",
        defaultDiscountPercent: 5,
        maxDiscountPercent: 10,
      },
      bookable: {
        durationMinutes: 45,
      },
      packageItems: [
        {
          childProductItemId: "prod_exam",
          quantity: 1,
          pricingMode: "INCLUDED",
        },
      ],
    });

    expect(prisma.productItem.create).toHaveBeenCalled();
    expect(created.defaultPrice?.unitPrice).toBe(250);
    expect(created.packageItems).toHaveLength(1);
  });

  it("generates a product code and skips optional pricing fields when omitted", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      { code: "CS-0003" },
    ]);
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.productItem.create as jest.Mock).mockResolvedValue({
      id: "prod_followup",
      version: 1,
      organisationId: "org_1",
      name: "Follow-up",
      description: null,
      code: "CS-0004",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: false,
      prices: [],
      bookable: null,
      package: null,
    });

    const created = await CatalogService.createProduct({
      organisationId: "org_1",
      name: "Follow-up",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      isActive: false,
    });

    expect(prisma.productItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "CS-0004",
          isActive: false,
          prices: undefined,
          bookable: undefined,
          package: undefined,
        }),
      }),
    );
    expect(created.code).toBe("CS-0004");
  });

  it("rejects invalid createProduct payloads before persisting", async () => {
    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Invalid bookable",
        kind: "CONSULTATION",
        bookable: {
          durationMinutes: 0,
          supportsOutpatient: false,
          supportsInpatient: false,
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Bookable durationMinutes must be a positive integer.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Invalid package",
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: null,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "packageItems[0].overridePrice is required for OVERRIDE_PRICE.",
    });
  });

  it("covers catalogue validation branches for strings, prices, team members, and speciality lookups", async () => {
    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "",
        kind: "CONSULTATION",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "name is required.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bad$Name",
        kind: "CONSULTATION",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid name.",
    });

    (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Valid name",
        kind: "CONSULTATION",
        specialityId: "spec_1",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Speciality not found for the organisation.",
      code: "NOT_FOUND",
    });

    await expect(
      CatalogService.createSpeciality({
        organisationId: "org_1",
        name: "Cardiology",
        headUserId: 123 as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid string value.",
    });

    await expect(
      CatalogService.createSpeciality({
        organisationId: "org_1",
        name: "Cardiology",
        teamMemberIds: "bad" as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "teamMemberIds must be an array.",
    });
  });

  it("covers pricing, package, and scheduling error branches", async () => {
    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bad price",
        kind: "CONSULTATION",
        price: {
          unitPrice: -1,
        } as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Price unitPrice cannot be negative.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bad discount",
        kind: "CONSULTATION",
        price: {
          unitPrice: 10,
          defaultDiscountPercent: 101,
        } as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "defaultDiscountPercent must be between 0 and 100.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bad discount 2",
        kind: "CONSULTATION",
        price: {
          unitPrice: 10,
          maxDiscountPercent: 101,
        } as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "maxDiscountPercent must be between 0 and 100.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bad discount 3",
        kind: "CONSULTATION",
        price: {
          unitPrice: 10,
          defaultDiscountPercent: 20,
          maxDiscountPercent: 10,
        } as any,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "defaultDiscountPercent cannot exceed maxDiscountPercent.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Package without items",
        kind: "PACKAGE",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Package products must include packageItems.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Consult with package items",
        kind: "CONSULTATION",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Only products with kind PACKAGE can define package items.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Broken package item",
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 0,
            pricingMode: "INCLUDED",
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "packageItems[0].quantity must be a positive integer.",
    });

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Broken package item 2",
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INCLUDED",
            discountPercent: 101,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "packageItems[0].discountPercent must be between 0 and 100.",
    });

    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      CatalogService.getBookableSlotsService(
        "prod_missing",
        "org_1",
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Product not found.",
    });

    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "prod_not_bookable",
        organisationId: "org_1",
        specialityId: "spec_1",
        bookable: null,
      },
    ]);
    await expect(
      CatalogService.getBookableSlotsService(
        "prod_not_bookable",
        "org_1",
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Product is not bookable.",
    });
  });

  it("lists active products for an organisation", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_1",
        organisationId: "org_1",
        name: "Consult",
        description: null,
        code: null,
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: null,
      },
    ]);

    const results = await CatalogService.listProducts({
      organisationId: "org_1",
    });

    expect(prisma.productItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          isActive: true,
        }),
      }),
    );
    expect(results).toHaveLength(1);
  });

  it("applies speciality, kind, activity, and search filters when listing products", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_1",
        organisationId: "org_1",
        name: "Cardio Consult",
        description: "Heart check",
        code: "CS-1001",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: false,
        prices: [],
        bookable: null,
        package: null,
      },
    ]);

    const results = await CatalogService.listProducts({
      organisationId: "org_1",
      specialityId: "spec_1",
      kinds: ["CONSULTATION", "PACKAGE"],
      active: false,
      search: "cardio",
      supportsInpatient: true,
    });

    expect(prisma.productItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          specialityId: "spec_1",
          kind: { in: ["CONSULTATION", "PACKAGE"] },
          isActive: false,
          bookable: {
            is: {
              supportsInpatient: true,
            },
          },
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({ contains: "cardio" }),
            }),
          ]),
        }),
      }),
    );
    expect(results[0]).toEqual(
      expect.objectContaining({
        id: "prod_1",
        isActive: false,
        code: "CS-1001",
      }),
    );
  });

  it("updates nested pricing and bookable settings", async () => {
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValue({
      id: "prod_1",
      version: 2,
      kind: "CONSULTATION",
      prices: [{ id: "price_1", isDefault: true }],
      bookable: { id: "book_1" },
      package: null,
    });
    (prisma.productPrice.findFirst as jest.Mock).mockResolvedValue({
      id: "price_1",
    });
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});
    (prisma.productBookable.upsert as jest.Mock).mockResolvedValue({});
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      organisationId: "org_1",
      kind: "CONSULTATION",
      prices: [{ id: "price_1", isDefault: true }],
      bookable: { id: "book_1" },
      package: null,
    });
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      organisationId: "org_1",
      name: "Updated Consult",
      description: null,
      code: null,
      kind: "CONSULTATION",
      specialityId: null,
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 99,
          currency: "USD",
          defaultDiscountPercent: 0,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: null,
    });

    const updated = await CatalogService.updateProduct("prod_1", {
      organisationId: "org_1",
      name: "Updated Consult",
      price: {
        unitPrice: 99,
        currency: "USD",
        defaultDiscountPercent: 0,
        maxDiscountPercent: 10,
      },
      bookable: {
        durationMinutes: 30,
      },
    });

    expect(prisma.productPrice.update).toHaveBeenCalled();
    expect(prisma.productBookable.upsert).toHaveBeenCalled();
    expect(updated.name).toBe("Updated Consult");
  });

  it("removes pricing, bookable, and package records when a package becomes a consultation", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pkg_1",
      version: 3,
      organisationId: "org_1",
      name: "Bundle",
      description: null,
      code: "PK-1",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [{ id: "price_1", isDefault: true }],
      bookable: { id: "book_1" },
      package: { items: [{ id: "pkg_item_1" }] },
    });
    (prisma.productPrice.findFirst as jest.Mock).mockResolvedValue({
      id: "price_1",
    });
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});
    (prisma.productPrice.delete as jest.Mock).mockResolvedValue({});
    (prisma.productBookable.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.productPackage.findUnique as jest.Mock).mockResolvedValue({
      id: "package_1",
    });
    (prisma.productPackage.delete as jest.Mock).mockResolvedValue({});
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pkg_1",
      organisationId: "org_1",
      name: "Converted Bundle",
      description: null,
      code: "PK-1",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [],
      bookable: null,
      package: null,
    });

    const updated = await CatalogService.updateProduct("pkg_1", {
      organisationId: "org_1",
      kind: "CONSULTATION",
      price: null,
      bookable: null,
      packageItems: [],
      expectedVersion: 3,
    });

    expect(prisma.productPrice.delete).toHaveBeenCalledWith({
      where: { id: "price_1" },
    });
    expect(prisma.productBookable.deleteMany).toHaveBeenCalledWith({
      where: { productItemId: "pkg_1" },
    });
    expect(prisma.productPackage.delete).toHaveBeenCalledWith({
      where: { id: "package_1" },
    });
    expect(updated.kind).toBe("CONSULTATION");
  });

  it("regenerates the code when the product kind changes and no code is supplied", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      version: 2,
      organisationId: "org_1",
      name: "General Consultation",
      description: null,
      code: "CS-0007",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [],
      bookable: null,
      package: null,
    });
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      organisationId: "org_1",
      name: "General Consultation",
      description: null,
      code: "PR-0008",
      kind: "PROCEDURE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [],
      bookable: null,
      package: null,
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      { code: "PR-0007" },
    ]);
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});

    const updated = await CatalogService.updateProduct("prod_1", {
      organisationId: "org_1",
      kind: "PROCEDURE",
      expectedVersion: 2,
    });

    expect(prisma.productItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "PROCEDURE",
          code: "PR-0008",
        }),
      }),
    );
    expect(updated.code).toBe("PR-0008");
    expect(updated.kind).toBe("PROCEDURE");
  });

  it("creates a default price and rewrites package items when updating a package", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pkg_1",
      version: 1,
      organisationId: "org_1",
      name: "Bundle",
      description: null,
      code: "PK-0001",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [],
      bookable: null,
      package: {
        id: "package_1",
        leadCount: 1,
        supportCount: 0,
        additionalDiscountPercent: 0,
        items: [],
      },
    });
    (prisma.productItem.findMany as jest.Mock)
      // ensurePackageItemsValid child lookup
      .mockResolvedValueOnce([
        {
          id: "child_1",
          isActive: true,
          prices: [{ id: "cp_1", unitPrice: 10, isDefault: true }],
          package: null,
        },
      ])
      // buildPackageGraph package scan
      .mockResolvedValueOnce([])
      // resolvePackageItemPersistenceData child lookup
      .mockResolvedValueOnce([{ id: "child_1" }]);
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});
    (prisma.productPrice.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.productPrice.create as jest.Mock).mockResolvedValue({});
    (prisma.productPackage.upsert as jest.Mock).mockResolvedValue({
      id: "package_1",
    });
    (prisma.productPackageItem.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.productPackageItem.createMany as jest.Mock).mockResolvedValue({});
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pkg_1",
      organisationId: "org_1",
      name: "Bundle",
      description: null,
      code: "PK-0001",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      version: 2,
      prices: [
        {
          unitPrice: 50,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          isDefault: true,
        },
      ],
      bookable: null,
      package: {
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 5,
        items: [],
      },
    });

    const updated = await CatalogService.updateProduct("pkg_1", {
      organisationId: "org_1",
      price: { unitPrice: 50, currency: "USD" },
      package: {
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 5,
        grossAmount: 0,
        itemDiscountAmount: 0,
        additionalDiscountAmount: 0,
        breakdownItemCount: 1,
      },
      packageItems: [
        { childProductItemId: "child_1", quantity: 2, pricingMode: "INCLUDED" },
      ],
    });

    expect(prisma.productPrice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productItemId: "pkg_1",
        unitPrice: 50,
        currency: "USD",
        isDefault: true,
      }),
    });
    expect(prisma.productPackage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productItemId: "pkg_1" },
        update: expect.objectContaining({
          leadCount: 2,
          supportCount: 1,
          additionalDiscountPercent: 5,
        }),
      }),
    );
    expect(prisma.productPackageItem.deleteMany).toHaveBeenCalledWith({
      where: { packageId: "package_1" },
    });
    expect(prisma.productPackageItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          packageId: "package_1",
          childProductItemId: "child_1",
          quantity: 2,
          pricingMode: "INCLUDED",
        }),
      ],
    });
    expect(updated.kind).toBe("PACKAGE");
  });

  it("does not update a product owned by another organisation", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      CatalogService.updateProduct("prod_other", {
        organisationId: "org_1",
        name: "Taken over",
      }),
    ).rejects.toMatchObject({
      message: "Product not found.",
      statusCode: 404,
    });

    expect(prisma.productItem.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "prod_other", organisationId: "org_1" },
      }),
    );
    expect(prisma.productItem.update).not.toHaveBeenCalled();
  });

  it("never reassigns the organisation of an updated product", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      version: 1,
      organisationId: "org_1",
      name: "Consult",
      code: "CS-0001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      isActive: true,
      prices: [],
      bookable: null,
      package: null,
    });
    (prisma.productItem.update as jest.Mock).mockResolvedValue({});
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      organisationId: "org_1",
      name: "Renamed",
      description: null,
      code: "CS-0001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [],
      bookable: null,
      package: null,
    });

    const updated = await CatalogService.updateProduct("prod_1", {
      organisationId: "org_1",
      name: "Renamed",
    });

    expect(prisma.productItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          organisationId: expect.anything(),
        }),
      }),
    );
    expect(updated.organisationId).toBe("org_1");
  });

  it("does not archive, restore, or delete a product owned by another organisation", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      CatalogService.archiveProduct("prod_other", "org_1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      CatalogService.restoreProduct("prod_other", "org_1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      CatalogService.deleteProduct("prod_other", "org_1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.productItem.update).not.toHaveBeenCalled();
    expect(prisma.productItem.delete).not.toHaveBeenCalled();
  });

  it("requires an organisation on every single-product read path", async () => {
    await expect(
      CatalogService.getProductById("prod_1", ""),
    ).rejects.toMatchObject({
      message: "organisationId is required.",
      statusCode: 400,
    });

    await expect(
      CatalogService.getPackageDetail("pkg_1", ""),
    ).rejects.toMatchObject({
      message: "organisationId is required.",
      statusCode: 400,
    });

    await expect(
      CatalogService.resolveSelection("prod_1", undefined as never),
    ).rejects.toMatchObject({
      message: "organisationId is required.",
      statusCode: 400,
    });

    await expect(
      CatalogService.getSpecialityById("spec_1", undefined as never),
    ).rejects.toMatchObject({
      message: "organisationId is required.",
      statusCode: 400,
    });

    expect(prisma.productItem.findFirst).not.toHaveBeenCalled();
    expect(prisma.speciality.findFirst).not.toHaveBeenCalled();
  });

  it("scopes single-product reads to the requested organisation", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      CatalogService.getProductById("prod_other", "org_1"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.productItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod_other", organisationId: "org_1" },
      }),
    );

    await expect(
      CatalogService.resolveSelection("prod_other", "org_1"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.productItem.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId: "org_1" }),
      }),
    );
  });

  it("does not update a speciality owned by another organisation", async () => {
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      CatalogService.updateSpeciality("spec_other", {
        organisationId: "org_1",
        name: "Taken over",
      }),
    ).rejects.toMatchObject({
      message: "Speciality not found.",
      statusCode: 404,
    });

    expect(prisma.speciality.findFirst).toHaveBeenCalledWith({
      where: { id: "spec_other", organisationId: "org_1" },
    });
    expect(prisma.speciality.update).not.toHaveBeenCalled();
  });

  it("rejects stale updates when the expected version is outdated", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "prod_1",
      version: 4,
      organisationId: "org_1",
      kind: "CONSULTATION",
      prices: [],
      bookable: null,
      package: null,
    });

    await expect(
      CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        expectedVersion: 3,
        name: "Updated Consult",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "VERSION_CONFLICT",
      details: {
        expectedVersion: 3,
        currentVersion: 4,
      },
    });
  });

  it("builds a speciality catalog view grouped into services and packages", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_consult",
        version: 1,
        organisationId: "org_1",
        name: "General Consultation",
        description: "Consult",
        code: "CS-1",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 100,
            currency: "USD",
            defaultDiscountPercent: 10,
            maxDiscountPercent: 15,
            isDefault: true,
          },
        ],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: null,
      },
      {
        id: "pkg_bundle",
        version: 1,
        organisationId: "org_1",
        name: "Cardio Bundle",
        description: "Bundle",
        code: "PK-1",
        kind: "PACKAGE",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        package: {
          items: [
            {
              id: "pkgi_1",
              childProductItemId: "prod_consult",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              overridePrice: null,
              sortOrder: 0,
              isOptional: false,
              childProductItem: {
                id: "prod_consult",
                version: 1,
                name: "General Consultation",
                kind: "CONSULTATION",
                isActive: true,
                prices: [
                  {
                    unitPrice: 100,
                    currency: "USD",
                    defaultDiscountPercent: 10,
                    maxDiscountPercent: 15,
                    isDefault: true,
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    const result = await CatalogService.getSpecialityCatalog({
      organisationId: "org_1",
      specialityId: "spec_1",
      tab: "all",
      search: "cardio",
    });

    expect(result).toEqual({
      specialityId: "spec_1",
      organisationId: "org_1",
      activeTab: "all",
      search: "cardio",
      services: [
        expect.objectContaining({
          id: "prod_consult",
          code: "CS-1",
          name: "General Consultation",
          description: "Consult",
          kind: "CONSULTATION",
          isBookable: true,
          isActive: true,
          durationMinutes: 30,
          unitPrice: 100,
          defaultDiscountPercent: 10,
          maxDiscountPercent: 15,
          totalAmount: 90,
          leadCount: null,
          supportCount: null,
          additionalDiscountPercent: null,
          grossAmount: null,
          itemDiscountAmount: null,
          additionalDiscountAmount: null,
          breakdownItemCount: null,
          currency: "USD",
        }),
      ],
      packages: [
        expect.objectContaining({
          id: "pkg_bundle",
          code: "PK-1",
          name: "Cardio Bundle",
          description: "Bundle",
          kind: "PACKAGE",
          isBookable: true,
          isActive: true,
          durationMinutes: 30,
          unitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          totalAmount: 90,
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          grossAmount: 100,
          itemDiscountAmount: 10,
          additionalDiscountAmount: 0,
          breakdownItemCount: 1,
          currency: "USD",
        }),
      ],
    });
  });

  it("returns only packages when the speciality catalog tab is packages", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_consult",
        version: 1,
        organisationId: "org_1",
        name: "General Consultation",
        description: null,
        code: "CS-1",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 100,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: null,
      },
      {
        id: "pkg_bundle",
        version: 1,
        organisationId: "org_1",
        name: "Cardio Bundle",
        description: null,
        code: "PK-1",
        kind: "PACKAGE",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [],
        },
      },
    ]);

    const result = await CatalogService.getSpecialityCatalog({
      organisationId: "org_1",
      specialityId: "spec_1",
      tab: "packages",
      includeInactive: true,
    });

    expect(result.services).toEqual([]);
    expect(result.packages).toHaveLength(1);
  });

  it("returns package detail with breakdown rows", async () => {
    (prisma.productItem.findFirst as jest.Mock).mockResolvedValue({
      id: "pkg_bundle",
      version: 1,
      organisationId: "org_1",
      name: "Cardio Bundle",
      description: "Bundle",
      code: "PK-1",
      kind: "PACKAGE",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      prices: [
        {
          unitPrice: 250,
          currency: "USD",
          defaultDiscountPercent: null,
          maxDiscountPercent: 10,
          isDefault: true,
        },
      ],
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: {
        leadCount: 1,
        supportCount: 0,
        additionalDiscountPercent: 0,
        items: [
          {
            id: "pkgi_1",
            childProductItemId: "prod_consult",
            quantity: 2,
            pricingMode: "INHERITED_PRICE",
            overridePrice: null,
            discountPercent: 10,
            sortOrder: 0,
            isOptional: false,
            childProductItem: {
              id: "prod_consult",
              version: 1,
              name: "General Consultation",
              code: "CS-1",
              kind: "CONSULTATION",
              isActive: true,
              prices: [
                {
                  unitPrice: 100,
                  currency: "USD",
                  defaultDiscountPercent: 10,
                  maxDiscountPercent: 15,
                  isDefault: true,
                },
              ],
            },
          },
        ],
      },
    });

    const result = await CatalogService.getPackageDetail("pkg_bundle", "org_1");

    expect(result).toEqual(
      expect.objectContaining({
        id: "pkg_bundle",
        code: "PK-1",
        name: "Cardio Bundle",
        description: "Bundle",
        isBookable: true,
        isActive: true,
        durationMinutes: 30,
        maxDiscountPercent: 10,
        leadCount: 1,
        supportCount: 0,
        additionalDiscountPercent: 0,
        grossAmount: 200,
        itemDiscountAmount: 20,
        additionalDiscountAmount: 0,
        breakdownItemCount: 1,
        currency: "USD",
        totalAmount: 180,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "pkgi_1",
        type: "CONSULTATION",
        childItemId: "prod_consult",
        childItemKind: "CONSULTATION",
        childItemCode: "CS-1",
        name: "General Consultation",
        childItemName: "General Consultation",
        quantity: 2,
        unitPrice: 100,
        currency: "USD",
        grossAmount: 200,
        discountPercent: 10,
        discountAmount: 20,
        finalAmount: 180,
        pricingMode: "INHERITED_PRICE",
        overridePrice: null,
        isOptional: false,
        sortOrder: 0,
      }),
    ]);
  });

  it("rejects package items whose discount exceeds the child max discount", async () => {
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "prod_exam",
          version: 1,
          organisationId: "org_1",
          name: "Exam",
          description: null,
          code: "CS-1",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          prices: [
            {
              unitPrice: 100,
              currency: "USD",
              defaultDiscountPercent: 0,
              maxDiscountPercent: 5,
              isDefault: true,
            },
          ],
          package: null,
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bundle",
        kind: "PACKAGE",
        packageItems: [
          {
            childProductItemId: "prod_exam",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
            discountPercent: 10,
          },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PACKAGE_ITEM_DISCOUNT_TOO_HIGH",
    });
  });

  it("lists specialities with archived filtering and pagination", async () => {
    const summarySpy = jest
      .spyOn(CatalogService, "getOrganisationSummary")
      .mockResolvedValue({
        organisationId: "org_1",
        items: [
          { id: "spec_active", status: "ACTIVE" },
          { id: "spec_archived", status: "ARCHIVED" },
        ],
      } as never);

    const result = await CatalogService.listSpecialities("org_1", {
      status: "ARCHIVED",
      page: 1,
      pageSize: 10,
      search: "cardio",
    });

    expect(summarySpy).toHaveBeenCalledWith("org_1", {
      search: "cardio",
      includeArchived: true,
    });
    expect(result).toEqual({
      organisationId: "org_1",
      page: 1,
      pageSize: 10,
      total: 1,
      items: [{ id: "spec_archived", status: "ARCHIVED" }],
    });
  });

  it("returns a speciality summary row by id", async () => {
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
      id: "spec_1",
      organisationId: "org_1",
      name: "Cardiology",
      headUserId: null,
      headName: null,
      headProfilePicUrl: null,
      memberUserIds: [],
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
    });

    const summarySpy = jest
      .spyOn(CatalogService, "getOrganisationSummary")
      .mockResolvedValue({
        organisationId: "org_1",
        items: [
          {
            id: "spec_1",
            organisationId: "org_1",
            name: "Cardiology",
            status: "ACTIVE",
          },
        ],
      } as never);

    const result = await CatalogService.getSpecialityById("spec_1", "org_1");

    expect(summarySpy).toHaveBeenCalledWith("org_1", {
      includeArchived: true,
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "spec_1",
        name: "Cardiology",
      }),
    );
  });

  it("throws when speciality summary cannot be resolved after lookup", async () => {
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
      id: "spec_1",
      organisationId: "org_1",
    });
    jest.spyOn(CatalogService, "getOrganisationSummary").mockResolvedValue({
      organisationId: "org_1",
      items: [],
    } as never);

    await expect(
      CatalogService.getSpecialityById("spec_1", "org_1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns archived services and packages for a speciality", async () => {
    (prisma.productItem.findMany as jest.Mock).mockReset().mockResolvedValue([
      {
        id: "svc_1",
        version: 1,
        organisationId: "org_1",
        name: "Archived consult",
        description: null,
        code: "SV-1",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: false,
        prices: [
          {
            unitPrice: 80,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: null,
      },
      {
        id: "pkg_1",
        version: 1,
        organisationId: "org_1",
        name: "Archived package",
        description: null,
        code: "PK-1",
        kind: "PACKAGE",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: false,
        prices: [
          {
            unitPrice: 180,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [],
        },
      },
    ]);

    const result = await CatalogService.getArchiveCatalog(
      "org_1",
      "spec_1",
      "Archived",
    );

    expect(prisma.productItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          specialityId: "spec_1",
          isActive: false,
        }),
      }),
    );
    expect(result.services).toHaveLength(1);
    expect(result.packages).toHaveLength(1);
  });

  it("searches catalog items including inventory rows", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pkg_1",
        version: 1,
        organisationId: "org_1",
        name: "Diagnostics package",
        description: "Panel",
        code: "PK-1",
        kind: "PACKAGE",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 150,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: {
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [],
        },
      },
    ]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "inv_1",
        organisationId: "org_1",
        sku: "INV-1",
        name: "Supply kit",
        description: "Archived kit",
        status: "ARCHIVED",
        sellingPrice: 25,
        currency: "USD",
      },
    ]);

    const result = await CatalogService.searchItems({
      organisationId: "org_1",
      q: "kit",
      kinds: ["INVENTORY", "PACKAGE"],
      includeArchived: true,
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pkg_1",
          source: "CATALOG",
          kind: "PACKAGE",
        }),
        expect.objectContaining({
          id: "inv_1",
          source: "INVENTORY",
          blockReason: "Inventory item is archived.",
        }),
      ]),
    );
  });

  it("resolves lab products and package cycles while skipping inventory lookups when not requested", async () => {
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "pkg_parent",
          version: 1,
          organisationId: "org_1",
          name: "Parent bundle",
          description: "Parent",
          code: "PK-1",
          kind: "PACKAGE",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          prices: [
            {
              unitPrice: 120,
              currency: "USD",
              defaultDiscountPercent: 0,
              maxDiscountPercent: 20,
              isDefault: true,
            },
          ],
          bookable: null,
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [],
          },
        },
        {
          id: "pkg_child",
          version: 1,
          organisationId: "org_1",
          name: "Child bundle",
          description: "Child",
          code: "PK-2",
          kind: "PACKAGE",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          prices: [
            {
              unitPrice: 95,
              currency: "USD",
              defaultDiscountPercent: 0,
              maxDiscountPercent: 20,
              isDefault: true,
            },
          ],
          bookable: null,
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [],
          },
        },
        {
          id: "lab_1",
          version: 1,
          organisationId: "org_1",
          name: "CBC Panel",
          description: "Lab work",
          code: "LB-1",
          kind: "LAB_TEST",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          prices: [
            {
              unitPrice: 45,
              currency: "USD",
              defaultDiscountPercent: 0,
              maxDiscountPercent: 0,
              isDefault: true,
            },
          ],
          bookable: null,
          package: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pkg_parent",
          package: { items: [{ childProductItemId: "pkg_child" }] },
        },
        {
          id: "pkg_child",
          package: { items: [{ childProductItemId: "pkg_parent" }] },
        },
      ]);

    const result = await CatalogService.searchItems({
      organisationId: "org_1",
      q: "bundle",
      kinds: ["LAB", "PACKAGE"],
      includeArchived: false,
      excludePackageId: "pkg_parent",
      includeNestedBreakdown: true,
      page: 1,
      pageSize: 20,
    });

    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(prisma.productItem.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org_1",
          kind: { in: ["LAB_TEST", "DIAGNOSTIC", "PACKAGE"] },
        }),
      }),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pkg_parent",
          blockReason: "Current package cannot include itself.",
          canBeAddedToPackage: false,
          nestedBreakdown: [],
        }),
        expect.objectContaining({
          id: "pkg_child",
          blockReason: "Adding this package would create a cycle.",
          canBeAddedToPackage: false,
        }),
        expect.objectContaining({
          id: "lab_1",
          source: "CATALOG",
          kind: "LAB_TEST",
        }),
      ]),
    );
  });

  it("prefers nearby organisations and filters out those without services", async () => {
    (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "org_near",
        name: "Near Org",
        isVerified: true,
        isActive: true,
        address: { latitude: 12.97, longitude: 77.59 },
      },
      {
        id: "org_empty",
        name: "Empty Org",
        isVerified: true,
        isActive: true,
        address: { latitude: 12.9701, longitude: 77.5901 },
      },
      {
        id: "org_missing",
        name: "No Address",
        isVerified: true,
        isActive: true,
        address: null,
      },
    ]);
    (prisma.speciality.findMany as jest.Mock).mockResolvedValue([
      {
        id: "spec_1",
        name: "Cardiology",
        organisationId: "org_near",
      },
    ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_1",
        name: "Consult",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        organisationId: "org_near",
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        prices: [{ unitPrice: 150 }],
      },
    ]);

    const result = await CatalogService.listOrganisationsProvidingServiceNearby(
      12.97,
      77.59,
      1000,
    );

    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "org_near",
        specialities: [
          expect.objectContaining({
            id: "spec_1",
            services: [
              expect.objectContaining({
                id: "prod_1",
                kind: "CONSULTATION",
                appointmentKinds: ["OUTPATIENT"],
                cost: 150,
              }),
            ],
          }),
        ],
      }),
    );
  });

  it("falls back to all organisations when nearby search finds nothing", async () => {
    (prisma.organization.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "org_far",
          name: "Far Org",
          isVerified: true,
          isActive: true,
          address: { latitude: 0, longitude: 0 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "org_fallback",
          name: "Fallback Org",
          isVerified: true,
          isActive: true,
          address: { latitude: 1, longitude: 1 },
        },
      ]);
    (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "spec_1",
        name: "General",
        organisationId: "org_fallback",
      },
    ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "prod_1",
        name: "Checkup",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        organisationId: "org_fallback",
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        prices: [{ unitPrice: 75 }],
      },
    ]);

    const result = await CatalogService.listOrganisationsProvidingServiceNearby(
      12.97,
      77.59,
      50,
    );

    expect(prisma.organization.findMany).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "org_fallback",
      }),
    );
  });

  it("keeps every nearby organisation lookup verified, active, and bounded", async () => {
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.speciality.findMany as jest.Mock).mockResolvedValue([]);

    await CatalogService.listOrganisationsProvidingServiceNearby(0, 0, 1);
    await CatalogService.listOrganisationsProvidingServiceNearby();

    const calls = (prisma.organization.findMany as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args.where).toEqual(
        expect.objectContaining({ isVerified: true, isActive: true }),
      );
      expect(args.take).toBeGreaterThan(0);
    }
  });

  it("falls back to all organisations when coordinates are omitted", async () => {
    (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "org_1",
        name: "Org",
        imageUrl: null,
        phoneNo: "12345",
        type: "CLINIC",
        appointmentCheckInBufferMinutes: null,
        appointmentCheckInRadiusMeters: null,
        address: {
          addressLine: "1 Main St",
          country: "US",
          city: "Austin",
          state: "TX",
          postalCode: "73301",
          latitude: 40,
          longitude: -74,
        },
      },
    ]);
    (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "spec_1", name: "General", organisationId: "org_1" },
    ]);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "prod_1",
        name: "Checkup",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        organisationId: "org_1",
        bookable: {
          durationMinutes: 30,
          supportsOutpatient: true,
          supportsInpatient: false,
        },
        prices: [{ unitPrice: 50 }],
      },
    ]);

    const result =
      await CatalogService.listOrganisationsProvidingServiceNearby();

    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "org_1",
        specialities: [
          expect.objectContaining({
            id: "spec_1",
            services: [
              expect.objectContaining({
                id: "prod_1",
                kind: "CONSULTATION",
                cost: 50,
              }),
            ],
          }),
        ],
      }),
    );
  });

  it("archives and restores products through updateProduct", async () => {
    const updateSpy = jest
      .spyOn(CatalogService, "updateProduct")
      .mockResolvedValue({ id: "prod_1", version: 3 } as never);
    jest.spyOn(CatalogService, "getProductById").mockResolvedValue({
      id: "pkg_1",
      version: 2,
      kind: "CONSULTATION",
      organisationId: "org_1",
    } as never);
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "prod_1",
        version: 1,
        organisationId: "org_1",
        name: "Exam",
        description: null,
        code: "EX-1",
        kind: "CONSULTATION",
        specialityId: "spec_1",
        legacyServiceId: null,
        isActive: true,
        prices: [
          {
            unitPrice: 50,
            currency: "USD",
            defaultDiscountPercent: 0,
            maxDiscountPercent: 10,
            isDefault: true,
          },
        ],
        bookable: null,
        package: null,
      },
    ]);

    await CatalogService.archiveProduct("prod_1", "org_1", 1);
    await CatalogService.restoreProduct("pkg_1", "org_1", 2);

    expect(updateSpy).toHaveBeenNthCalledWith(1, "prod_1", {
      organisationId: "org_1",
      isActive: false,
      expectedVersion: 1,
    });
    expect(updateSpy).toHaveBeenNthCalledWith(2, "pkg_1", {
      organisationId: "org_1",
      isActive: true,
      expectedVersion: 2,
    });
  });

  it("deletes a product after version and dependency checks pass", async () => {
    (prisma.productItem.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "prod_1",
        version: 4,
      })
      .mockResolvedValueOnce(null);
    (prisma.appointment.count as jest.Mock).mockResolvedValue(0);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productPackageItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.productItem.delete as jest.Mock).mockResolvedValue(undefined);

    await CatalogService.deleteProduct("prod_1", "org_1", 4);

    expect(prisma.productItem.delete).toHaveBeenCalledWith({
      where: { id: "prod_1" },
    });
  });

  it("updates speciality metadata and dedupes head user membership", async () => {
    (prisma.speciality.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "spec_1",
        organisationId: "org_1",
        name: "Old name",
        headUserId: "user_1",
        headName: "Lead",
        headProfilePicUrl: null,
        memberUserIds: ["user_1"],
      })
      .mockResolvedValueOnce(null);
    (prisma.speciality.update as jest.Mock).mockResolvedValue({
      id: "spec_1",
      name: "New name",
      memberUserIds: ["user_1", "user_2"],
    });

    const result = await CatalogService.updateSpeciality("spec_1", {
      organisationId: "org_1",
      name: "New name",
      headUserId: "user_2",
      teamMemberIds: ["user_2", "user_1", "user_2"],
    });

    expect(prisma.speciality.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "spec_1", organisationId: "org_1" },
    });
    expect(prisma.speciality.update).toHaveBeenCalledWith({
      where: { id: "spec_1" },
      data: expect.not.objectContaining({ organisationId: expect.anything() }),
    });
    expect(prisma.speciality.update).toHaveBeenCalledWith({
      where: { id: "spec_1" },
      data: expect.objectContaining({
        name: "New name",
        headUserId: "user_2",
        memberUserIds: ["user_2", "user_1"],
      }),
    });
    expect(result).toEqual({
      id: "spec_1",
      name: "New name",
      memberUserIds: ["user_1", "user_2"],
    });
  });

  it("archives, restores, and deletes specialities", async () => {
    (prisma.speciality.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: "spec_1", organisationId: "org_1" })
      .mockResolvedValueOnce({ id: "spec_1", organisationId: "org_1" })
      .mockResolvedValueOnce({ id: "spec_1", organisationId: "org_1" });
    (prisma.productItem.updateMany as jest.Mock).mockResolvedValue({
      count: 2,
    });
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.appointment.count as jest.Mock).mockResolvedValue(0);
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.count as jest.Mock).mockResolvedValue(0);
    (prisma.speciality.update as jest.Mock)
      .mockResolvedValueOnce({ id: "spec_1", isActive: false })
      .mockResolvedValueOnce({ id: "spec_1", isActive: true });
    (prisma.speciality.delete as jest.Mock).mockResolvedValue({ id: "spec_1" });

    await CatalogService.archiveSpeciality("spec_1", "org_1");
    await CatalogService.restoreSpeciality("spec_1", "org_1");
    await CatalogService.deleteSpeciality("spec_1", "org_1");

    expect(prisma.productItem.updateMany).toHaveBeenCalledWith({
      where: { organisationId: "org_1", specialityId: "spec_1" },
      data: { isActive: false },
    });
    expect(prisma.speciality.delete).toHaveBeenCalledWith({
      where: { id: "spec_1" },
    });
  });

  it("allows speciality deletion when invoices are unrelated to the speciality", async () => {
    (prisma.productItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.appointment.count as jest.Mock).mockResolvedValue(0);
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.count as jest.Mock).mockResolvedValue(229);
    (prisma.speciality.delete as jest.Mock).mockResolvedValue({ id: "spec_1" });

    await CatalogService.deleteSpeciality("spec_1", "org_1");

    expect(prisma.invoice.count).not.toHaveBeenCalled();
    expect(prisma.speciality.delete).toHaveBeenCalledWith({
      where: { id: "spec_1" },
    });
  });

  describe("catalog scheduling helpers", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns merged bookable windows for a catalog item", async () => {
      jest.useFakeTimers({ advanceTimers: false });
      jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));

      (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_1",
          bookable: {
            durationMinutes: 60,
          },
        },
      ]);
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        memberUserIds: ["vet1", "vet2"],
      });
      (AvailabilityService.getBookableSlotsForDate as jest.Mock)
        .mockResolvedValueOnce({
          windows: [
            { startTime: "10:00", endTime: "11:00", isAvailable: true },
            { startTime: "14:00", endTime: "15:00", isAvailable: true },
          ],
        })
        .mockResolvedValueOnce({
          windows: [
            { startTime: "14:00", endTime: "15:00", isAvailable: true },
            { startTime: "18:00", endTime: "19:00", isAvailable: true },
          ],
        });

      const result = await CatalogService.getBookableSlotsService(
        "prod_1",
        "org_1",
        new Date("2026-01-01T00:00:00Z"),
      );

      expect(result.windows).toHaveLength(2);
      expect(result.windows[0]).toEqual(
        expect.objectContaining({
          startTime: "14:00",
          endTime: "15:00",
          vetIds: ["vet1", "vet2"],
        }),
      );
      expect(result.windows[1]).toEqual(
        expect.objectContaining({
          startTime: "18:00",
          endTime: "19:00",
          vetIds: ["vet2"],
        }),
      );
    });

    it("returns calendar prefill matches for a catalog item", async () => {
      (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_1",
          bookable: {
            durationMinutes: 15,
          },
        },
      ]);
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        memberUserIds: ["vet-1"],
      });
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
        personalDetails: { timezone: "UTC" },
      });
      (AvailabilityService.getBookableSlotsForDate as jest.Mock)
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({
          windows: [
            { startTime: "00:05", endTime: "00:20", isAvailable: true },
          ],
        })
        .mockResolvedValueOnce({ windows: [] });

      const matches = await CatalogService.getCalendarPrefillMatches({
        organisationId: "org_1",
        date: new Date("2026-04-01T00:00:00.000Z"),
        minuteOfDay: 5,
        serviceIds: ["prod_1"],
      });

      expect(matches).toEqual([
        {
          serviceId: "prod_1",
          slot: {
            startTime: "00:05",
            endTime: "00:20",
            vetIds: ["vet-1"],
          },
          meta: {
            localStartMinute: 5,
            localEndMinute: 20,
          },
        },
      ]);
      expect(prisma.userProfile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org_1" },
          select: { personalDetails: true },
        }),
      );
    });

    it("returns no calendar prefill matches when serviceIds are blank", async () => {
      const matches = await CatalogService.getCalendarPrefillMatches({
        organisationId: "org_1",
        date: new Date("2026-04-01T00:00:00.000Z"),
        minuteOfDay: 5,
        serviceIds: [],
      });

      expect(matches).toEqual([]);
      expect(
        AvailabilityService.getBookableSlotsForDate,
      ).not.toHaveBeenCalled();
    });

    it("falls back to all organisations when no nearby organisations are found", async () => {
      (prisma.organization.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "org_1",
            name: "Org",
            imageUrl: null,
            phoneNo: "12345",
            type: "CLINIC",
            appointmentCheckInBufferMinutes: null,
            appointmentCheckInRadiusMeters: null,
            address: {
              addressLine: "1 Main St",
              country: "US",
              city: "Austin",
              state: "TX",
              postalCode: "73301",
              latitude: 40,
              longitude: -74,
            },
          },
        ]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "spec_1", name: "General", organisationId: "org_1" },
      ]);
      (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "prod_1",
          name: "Checkup",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          organisationId: "org_1",
          bookable: {
            durationMinutes: 30,
            supportsOutpatient: true,
            supportsInpatient: false,
          },
          prices: [{ unitPrice: 50 }],
        },
      ]);

      const result =
        await CatalogService.listOrganisationsProvidingServiceNearby(40, -74);

      expect(prisma.organization.findMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "org_1",
          name: "Org",
          specialities: [
            expect.objectContaining({
              id: "spec_1",
              services: [
                expect.objectContaining({
                  id: "prod_1",
                  name: "Checkup",
                  kind: "CONSULTATION",
                  appointmentKinds: ["OUTPATIENT"],
                  cost: 50,
                }),
              ],
            }),
          ],
        }),
      );
    });

    it("lists nearby organisations with their active services", async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "org_1",
          name: "Org",
          imageUrl: null,
          phoneNo: "12345",
          type: "CLINIC",
          appointmentCheckInBufferMinutes: null,
          appointmentCheckInRadiusMeters: null,
          address: {
            addressLine: "1 Main St",
            country: "US",
            city: "Austin",
            state: "TX",
            postalCode: "73301",
            latitude: 40,
            longitude: -74,
          },
        },
      ]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "spec_1", name: "General", organisationId: "org_1" },
      ]);
      (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "prod_1",
          name: "Checkup",
          kind: "PACKAGE",
          specialityId: "spec_1",
          organisationId: "org_1",
          bookable: {
            durationMinutes: 45,
            supportsOutpatient: true,
            supportsInpatient: true,
          },
          prices: [{ unitPrice: 50 }],
          package: {
            items: [
              {
                id: "pkg_item_1",
                childProductItemId: "child_1",
                quantity: 2,
                pricingMode: "INCLUDED",
                overridePrice: null,
                discountPercent: null,
                sortOrder: 0,
                isOptional: false,
                childProductItem: {
                  id: "child_1",
                  name: "Blood Test",
                  code: "BT-1",
                  kind: "LAB_TEST",
                  prices: [
                    {
                      unitPrice: 25,
                      currency: "USD",
                      defaultDiscountPercent: 10,
                      maxDiscountPercent: 20,
                      isDefault: true,
                    },
                  ],
                },
              },
            ],
          },
        },
      ]);

      const result =
        await CatalogService.listOrganisationsProvidingServiceNearby(40, -74);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "org_1",
          name: "Org",
          specialities: [
            expect.objectContaining({
              id: "spec_1",
              services: [
                expect.objectContaining({
                  id: "prod_1",
                  name: "Checkup",
                  kind: "PACKAGE",
                  appointmentKinds: ["OUTPATIENT", "INPATIENT"],
                  cost: 50,
                  // Discovery view: this endpoint returns OTHER organisations'
                  // catalogs, so a package shows WHAT it contains and how much
                  // of it - never the per-line economics (internal codes,
                  // pricing mode, override price, discount percent, computed
                  // gross/discount/final), which are another practice's
                  // commercial terms.
                  packageItems: [
                    expect.objectContaining({
                      id: "pkg_item_1",
                      childProductName: "Blood Test",
                      childProductKind: "LAB_TEST",
                      quantity: 2,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    });

    it("filters out nearby products that are not bookable", async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "org_1",
          name: "Org",
          imageUrl: null,
          phoneNo: "12345",
          type: "CLINIC",
          appointmentCheckInBufferMinutes: null,
          appointmentCheckInRadiusMeters: null,
          address: {
            addressLine: "1 Main St",
            country: "US",
            city: "Austin",
            state: "TX",
            postalCode: "73301",
            latitude: 40,
            longitude: -74,
          },
        },
      ]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "spec_1", name: "General", organisationId: "org_1" },
      ]);
      (prisma.productItem.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "prod_bookable",
          name: "Checkup",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          organisationId: "org_1",
          bookable: {
            durationMinutes: 30,
            supportsOutpatient: true,
            supportsInpatient: false,
          },
          prices: [{ unitPrice: 50 }],
        },
        {
          id: "prod_unbookable",
          name: "Archived Bundle",
          kind: "PACKAGE",
          specialityId: "spec_1",
          organisationId: "org_1",
          prices: [{ unitPrice: 75 }],
          package: {
            items: [],
          },
        },
      ]);

      const result =
        await CatalogService.listOrganisationsProvidingServiceNearby(40, -74);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "org_1",
          specialities: [
            expect.objectContaining({
              id: "spec_1",
              services: [
                expect.objectContaining({
                  id: "prod_bookable",
                  name: "Checkup",
                  appointmentKinds: ["OUTPATIENT"],
                }),
              ],
            }),
          ],
        }),
      );
      expect(
        result[0].specialities[0].services.find(
          (service) => service.id === "prod_unbookable",
        ),
      ).toBeUndefined();
    });
  });
});

type MockRecord = Record<string, any>;

const prismaMock = prisma as unknown as MockRecord;

const buildPrice = (overrides: MockRecord = {}) => ({
  unitPrice: 100,
  currency: "USD",
  defaultDiscountPercent: 0,
  maxDiscountPercent: 50,
  isDefault: true,
  ...overrides,
});

const buildChild = (overrides: MockRecord = {}) => ({
  id: "child_1",
  name: "Child Service",
  code: "CS-0002",
  kind: "CONSULTATION",
  isActive: true,
  prices: [buildPrice()],
  ...overrides,
});

const buildPackageItem = (overrides: MockRecord = {}) => ({
  id: "pkgitem_1",
  childProductItemId: "child_1",
  inventoryItemId: null,
  quantity: 1,
  pricingMode: "INHERITED_PRICE",
  overridePrice: null,
  discountPercent: null,
  sortOrder: 0,
  isOptional: false,
  childProductItem: buildChild(),
  inventoryItem: null,
  ...overrides,
});

const buildProduct = (overrides: MockRecord = {}) => ({
  id: "prod_1",
  version: 1,
  organisationId: "org_1",
  name: "General Consultation",
  description: null,
  code: "CS-0001",
  kind: "CONSULTATION",
  specialityId: null,
  legacyServiceId: null,
  isActive: true,
  prices: [buildPrice()],
  bookable: null,
  package: null,
  ...overrides,
});

const buildSpecialityRow = (overrides: MockRecord = {}) => ({
  id: "spec_1",
  organisationId: "org_1",
  name: "Dermatology",
  headUserId: null,
  headName: null,
  headProfilePicUrl: null,
  memberUserIds: [],
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

describe("CatalogService negative and edge paths", () => {
  beforeEach(() => {
    // Earlier suites in this file spy on CatalogService methods and never
    // restore them; without this the real implementations stay stubbed out.
    jest.restoreAllMocks();
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    prismaMock.productItem.findMany.mockResolvedValue([]);
    prismaMock.productItem.findFirst.mockResolvedValue(null);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    prismaMock.speciality.findFirst.mockResolvedValue({ id: "spec_1" });
    prismaMock.speciality.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.count.mockResolvedValue(0);
    prismaMock.productPackageItem.findFirst.mockResolvedValue(null);
    prismaMock.templateCatalogLink.findMany.mockResolvedValue([]);
    prismaMock.organization.findMany.mockResolvedValue([]);
  });

  describe("string sanitizers", () => {
    it("turns a whitespace-only optional string into null", () => {
      expect(optionalSafeString("   ")).toBeNull();
      expect(optionalSafeString("\t\n")).toBeNull();
      expect(optionalSafeString(" kept ")).toBe("kept");
    });

    it("returns an empty list for a null or undefined teamMemberIds value", () => {
      expect(sanitizeTeamMemberIds(null)).toEqual([]);
      expect(sanitizeTeamMemberIds(undefined)).toEqual([]);
    });
  });

  describe("resolveCatalogSchedulingContext", () => {
    it("rejects a bookable product that has no speciality", async () => {
      prismaMock.productItem.findMany.mockResolvedValueOnce([
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: null,
          bookable: { durationMinutes: 30 },
        },
      ]);

      await expect(
        resolveCatalogSchedulingContext("prod_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Speciality not found.",
        statusCode: 404,
      });
      expect(prismaMock.speciality.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when the referenced speciality no longer exists", async () => {
      prismaMock.productItem.findMany.mockResolvedValueOnce([
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_gone",
          bookable: { durationMinutes: 30 },
        },
      ]);
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        resolveCatalogSchedulingContext("prod_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Speciality not found.",
        statusCode: 404,
      });
    });

    it("falls back to an empty vet list when memberUserIds is null", async () => {
      prismaMock.productItem.findMany.mockResolvedValueOnce([
        {
          id: "prod_1",
          organisationId: "org_1",
          specialityId: "spec_1",
          bookable: { durationMinutes: 45 },
        },
      ]);
      prismaMock.speciality.findFirst.mockResolvedValueOnce({
        memberUserIds: null,
      });

      await expect(
        resolveCatalogSchedulingContext("prod_1", "org_1"),
      ).resolves.toEqual({
        productItemId: "prod_1",
        organisationId: "org_1",
        durationMinutes: 45,
        vetIds: [],
      });
    });
  });

  describe("sanitizePackageItems", () => {
    it("rejects a negative override price for OVERRIDE_PRICE", () => {
      expect(() =>
        sanitizePackageItems([
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: -1,
          },
        ]),
      ).toThrow(
        "packageItems[0].overridePrice is required for OVERRIDE_PRICE.",
      );
    });

    it("accepts a zero override price and defaults sortOrder to the index", () => {
      expect(
        sanitizePackageItems([
          {
            childProductItemId: "child_1",
            quantity: 2,
            pricingMode: "OVERRIDE_PRICE",
            overridePrice: 0,
          },
          {
            childProductItemId: "child_2",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
          },
        ]),
      ).toEqual([
        expect.objectContaining({
          childProductItemId: "child_1",
          overridePrice: 0,
          sortOrder: 0,
          isOptional: false,
          discountPercent: null,
        }),
        expect.objectContaining({
          childProductItemId: "child_2",
          overridePrice: null,
          sortOrder: 1,
        }),
      ]);
    });
  });

  describe("generateProductCode", () => {
    it("ignores rows with a null code and keeps the highest sequence", async () => {
      prismaMock.productItem.findMany.mockResolvedValueOnce([
        { code: null },
        { code: "PR-0007" },
        { code: "PR-0002" },
        { code: "PR-not-a-number" },
      ]);

      await expect(generateProductCode("org_1", "PROCEDURE")).resolves.toBe(
        "PR-0008",
      );
    });
  });

  describe("package graph traversal", () => {
    it("treats an unknown product as depth 1", () => {
      const graph = new Map<string, string[]>([["pkg_a", ["pkg_b"]]]);

      expect(getPackageDepth(graph, "pkg_unknown")).toBe(1);
    });

    it("returns false when the starting package is not in the graph", () => {
      const graph = new Map<string, string[]>([["pkg_a", ["pkg_b"]]]);

      expect(packageContainsTarget(graph, "pkg_missing", "pkg_b")).toBe(false);
    });

    it("finds a target nested two packages deep", () => {
      const graph = new Map<string, string[]>([
        ["pkg_a", ["pkg_b"]],
        ["pkg_b", ["target"]],
      ]);

      expect(packageContainsTarget(graph, "pkg_a", "target")).toBe(true);
    });
  });

  describe("ensureProductDeletionAllowed", () => {
    it("scans across every organisation when none is supplied", async () => {
      await expect(
        ensureProductDeletionAllowed("prod_1"),
      ).resolves.toBeUndefined();

      expect(prismaMock.productPackageItem.findFirst).toHaveBeenCalledWith({
        where: { childProductItemId: "prod_1" },
        select: { id: true, packageId: true },
      });
      expect(prismaMock.appointment.count).toHaveBeenCalledWith({
        where: { productItemId: "prod_1" },
      });
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith({
        where: {},
        select: { id: true, items: true },
      });
    });

    it("reports zero package dependencies when only appointments block deletion", async () => {
      prismaMock.appointment.count.mockResolvedValueOnce(3);

      await expect(
        ensureProductDeletionAllowed("prod_1", "org_1"),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CATALOG_ITEM_HAS_DEPENDENCIES",
        details: { packageDependencies: 0, appointments: 3, invoices: 0 },
      });
    });

    it("counts invoices that reference the product only through packageProductItemId", async () => {
      prismaMock.invoice.findMany.mockResolvedValueOnce([
        { id: "inv_1", items: null },
        { id: "inv_2", items: [null, "text", { productItemId: "other" }] },
        { id: "inv_3", items: [{ packageProductItemId: "prod_1" }] },
      ]);

      await expect(
        ensureProductDeletionAllowed("prod_1", "org_1"),
      ).rejects.toMatchObject({
        details: { packageDependencies: 0, appointments: 0, invoices: 1 },
      });
    });
  });

  describe("mapSpecialitySummaries", () => {
    it("matches on a product name while tolerating null code, description and headName", () => {
      const result = mapSpecialitySummaries({
        specialities: [
          buildSpecialityRow({ id: "spec_1", name: "Dermatology" }),
          buildSpecialityRow({
            id: "spec_2",
            name: "Cardiology",
            isActive: false,
          }),
        ],
        products: [
          {
            specialityId: "spec_1",
            isActive: true,
            kind: "CONSULTATION",
            name: "Allergy Panel",
            code: null,
            description: null,
          },
          {
            specialityId: "spec_2",
            isActive: false,
            kind: "PACKAGE",
            name: "Heart Bundle",
            code: null,
            description: null,
          },
        ],
        search: "  Allergy  ",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "spec_1",
          status: "ACTIVE",
          teamMemberIds: [],
          activeServiceCount: 1,
          archivedPackageCount: 0,
        }),
      );
    });

    it("matches on the speciality name itself when no product matches", () => {
      const result = mapSpecialitySummaries({
        specialities: [
          buildSpecialityRow({
            id: "spec_1",
            name: "Dermatology",
            headUserId: "user_1",
            headName: "Dr Skin",
            memberUserIds: ["user_2"],
          }),
        ],
        products: [
          {
            specialityId: "spec_other",
            isActive: true,
            kind: "CONSULTATION",
            name: "Unrelated",
            code: "CS-1",
            description: "desc",
          },
        ],
        search: "dermat",
      });

      expect(result).toHaveLength(1);
      expect(result[0].teamMemberIds).toEqual(["user_2", "user_1"]);
    });

    it("returns every speciality sorted by name when no search is given", () => {
      const result = mapSpecialitySummaries({
        specialities: [
          buildSpecialityRow({ id: "spec_b", name: "Zebra" }),
          buildSpecialityRow({ id: "spec_a", name: "Alpha", isActive: false }),
        ],
        products: [],
      });

      expect(result.map((item) => item.name)).toEqual(["Alpha", "Zebra"]);
      expect(result[0].status).toBe("ARCHIVED");
    });
  });

  describe("ensurePackageItemsValid", () => {
    it("tolerates a null inventory lookup result", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          { id: "child_1", isActive: true, prices: [buildPrice()] },
        ])
        .mockResolvedValueOnce([]);
      prismaMock.inventoryItem.findMany.mockResolvedValueOnce(null);

      await expect(
        ensurePackageItemsValid({
          organisationId: "org_1",
          packageItems: [
            {
              childProductItemId: "child_1",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
            },
          ],
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects an inventory child that is not ACTIVE", async () => {
      prismaMock.productItem.findMany.mockResolvedValueOnce([]);
      prismaMock.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv_1", status: "ARCHIVED" },
      ]);

      await expect(
        ensurePackageItemsValid({
          organisationId: "org_1",
          packageItems: [
            {
              childProductItemId: "inv_1",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
            },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PACKAGE_CHILD_UNAVAILABLE",
        details: { childProductItemId: "inv_1" },
      });
    });

    it("accepts an ACTIVE inventory child without consulting the price rules", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv_1", status: "ACTIVE" },
      ]);

      await expect(
        ensurePackageItemsValid({
          organisationId: "org_1",
          packageItems: [
            {
              childProductItemId: "inv_1",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              discountPercent: 90,
            },
          ],
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects a discount above a child that carries no default price", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([{ id: "child_1", isActive: true, prices: [] }])
        .mockResolvedValueOnce([]);

      await expect(
        ensurePackageItemsValid({
          organisationId: "org_1",
          packageItems: [
            {
              childProductItemId: "child_1",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              discountPercent: 5,
            },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PACKAGE_ITEM_DISCOUNT_TOO_HIGH",
        details: { childProductItemId: "child_1", maxDiscountPercent: 0 },
      });
    });

    it("rejects a composition that exceeds the maximum nesting depth", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          { id: "pkg_a", isActive: true, prices: [buildPrice()] },
        ])
        .mockResolvedValueOnce([
          {
            id: "pkg_a",
            package: { items: [{ childProductItemId: "pkg_b" }] },
          },
          {
            id: "pkg_b",
            package: { items: [{ childProductItemId: "pkg_c" }] },
          },
          { id: "pkg_c", package: { items: [] } },
        ]);

      await expect(
        ensurePackageItemsValid({
          organisationId: "org_1",
          packageItems: [
            {
              childProductItemId: "pkg_a",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
            },
          ],
          currentProductId: "pkg_root",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PACKAGE_HAS_CYCLE",
        details: { maxDepth: 3 },
      });
    });
  });

  describe("package breakdown mapping", () => {
    it("prices an inventory-backed package line from the inventory record", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: 2,
            supportCount: 1,
            additionalDiscountPercent: 10,
            items: [
              buildPackageItem({
                id: "pkgitem_inv",
                childProductItemId: null,
                inventoryItemId: "inv_1",
                childProductItem: null,
                quantity: 2,
                inventoryItem: {
                  id: "inv_1",
                  name: "Syringe",
                  sku: "SKU-1",
                  status: "ACTIVE",
                  sellingPrice: 25,
                  currency: "EUR",
                },
              }),
            ],
          },
        }),
      );

      const detail = await CatalogService.getPackageDetail("pkg_1", "org_1");

      expect(detail.items[0]).toEqual(
        expect.objectContaining({
          childItemId: "inv_1",
          childItemKind: "INVENTORY_ITEM",
          childItemCode: "SKU-1",
          childItemName: "Syringe",
          unitPrice: 25,
          currency: "EUR",
          grossAmount: 50,
          finalAmount: 50,
        }),
      );
      expect(detail.currency).toBe("EUR");
      expect(detail.maxDiscountPercent).toBeNull();
      expect(detail.additionalDiscountAmount).toBeCloseTo(5);
      expect(detail.totalAmount).toBeCloseTo(45);
    });

    it("falls back to empty naming when a package line resolves to no child", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [
              buildPackageItem({
                id: "pkgitem_orphan",
                childProductItemId: null,
                inventoryItemId: null,
                childProductItem: null,
                inventoryItem: null,
                pricingMode: "OVERRIDE_PRICE",
                overridePrice: null,
              }),
            ],
          },
        }),
      );

      const detail = await CatalogService.getPackageDetail("pkg_1", "org_1");

      expect(detail.items[0]).toEqual(
        expect.objectContaining({
          childItemId: "",
          childItemKind: "INVENTORY_ITEM",
          childItemCode: null,
          childItemName: "",
          name: "",
          unitPrice: 0,
          currency: null,
          grossAmount: 0,
          discountPercent: 0,
        }),
      );
      expect(detail.currency).toBeNull();
    });

    it("returns an empty breakdown when a package record carries no package row", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: null,
        }),
      );

      const detail = await CatalogService.getPackageDetail("pkg_1", "org_1");

      expect(detail.items).toEqual([]);
      expect(detail.breakdownItemCount).toBe(0);
      expect(detail.leadCount).toBe(1);
      expect(detail.supportCount).toBe(0);
      expect(detail.additionalDiscountPercent).toBe(0);
      expect(detail.totalAmount).toBe(0);
      expect(detail.currency).toBeNull();
    });

    it("rejects a detail request for a record that is not a package", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({ kind: "CONSULTATION" }),
      );

      await expect(
        CatalogService.getPackageDetail("prod_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Product is not a package.",
        statusCode: 400,
      });
    });

    it("returns 404 when no package matches the identifier", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.getPackageDetail("pkg_missing", "org_1"),
      ).rejects.toMatchObject({
        message: "Package not found.",
        statusCode: 404,
      });
    });
  });

  describe("resolveCatalogSelectionFromRecord", () => {
    it("resolves a priceless non-package product to zero amounts", () => {
      const resolved = resolveCatalogSelectionFromRecord(
        buildProduct({ prices: [], code: null }) as never,
      );

      expect(resolved).toEqual(
        expect.objectContaining({
          currency: null,
          grossAmount: 0,
          itemDiscountAmount: 0,
          finalAmount: 0,
          isBookable: false,
          appointmentKinds: [],
        }),
      );
      expect(resolved.billingItems[0]).toEqual(
        expect.objectContaining({
          unitPrice: 0,
          currency: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
        }),
      );
    });

    it("rejects a package line whose child record is missing entirely", () => {
      expect(() =>
        resolveCatalogSelectionFromRecord(
          buildProduct({
            kind: "PACKAGE",
            package: {
              leadCount: 1,
              supportCount: 0,
              additionalDiscountPercent: 0,
              items: [
                buildPackageItem({
                  childProductItemId: null,
                  childProductItem: null,
                  inventoryItem: null,
                }),
              ],
            },
          }) as never,
        ),
      ).toThrow("One or more package child items are unavailable.");
    });

    it("resolves an INCLUDED line whose child has no price rows", () => {
      const resolved = resolveCatalogSelectionFromRecord(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: null,
            supportCount: null,
            additionalDiscountPercent: null,
            items: [
              buildPackageItem({
                pricingMode: "INCLUDED",
                quantity: 3,
                childProductItem: buildChild({ prices: [] }),
              }),
            ],
          },
        }) as never,
      );

      expect(resolved.includedItems[0]).toEqual(
        expect.objectContaining({
          productItemId: "child_1",
          quantity: 3,
          unitPrice: 0,
          currency: null,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          isPackageComponent: true,
          packageProductItemId: "pkg_1",
        }),
      );
      expect(resolved.leadCount).toBe(1);
      expect(resolved.supportCount).toBe(0);
      expect(resolved.additionalDiscountPercent).toBe(0);
      expect(resolved.currency).toBeNull();
    });

    it("uses the override price and the first non-null child currency for the package", () => {
      const resolved = resolveCatalogSelectionFromRecord(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [
              buildPackageItem({
                id: "pkgitem_override",
                pricingMode: "OVERRIDE_PRICE",
                overridePrice: 40,
                quantity: 2,
                childProductItem: buildChild({
                  prices: [buildPrice({ currency: "GBP" })],
                }),
              }),
            ],
          },
        }) as never,
      );

      expect(resolved.currency).toBe("GBP");
      // Index 0 now: the package's own list price is no longer emitted as an
      // extra billable line on top of the components it prices.
      expect(resolved.billingItems[0]).toEqual(
        expect.objectContaining({
          unitPrice: 40,
          referenceUnitPrice: 100,
          grossAmount: 80,
        }),
      );
    });

    it("rejects an OVERRIDE_PRICE line that lost its override price", () => {
      expect(() =>
        resolveCatalogSelectionFromRecord(
          buildProduct({
            kind: "PACKAGE",
            package: {
              leadCount: 1,
              supportCount: 0,
              additionalDiscountPercent: 0,
              items: [
                buildPackageItem({
                  pricingMode: "OVERRIDE_PRICE",
                  overridePrice: null,
                }),
              ],
            },
          }) as never,
        ),
      ).toThrow("Package component Child Service is missing override price.");
    });

    it("rejects an INHERITED_PRICE line whose child has no default price", () => {
      expect(() =>
        resolveCatalogSelectionFromRecord(
          buildProduct({
            kind: "PACKAGE",
            package: {
              leadCount: 1,
              supportCount: 0,
              additionalDiscountPercent: 0,
              items: [
                buildPackageItem({
                  childProductItem: buildChild({ prices: [] }),
                }),
              ],
            },
          }) as never,
        ),
      ).toThrow("Package component Child Service is missing default price.");
    });

    it("rejects an inactive package component", () => {
      expect(() =>
        resolveCatalogSelectionFromRecord(
          buildProduct({
            kind: "PACKAGE",
            package: {
              leadCount: 1,
              supportCount: 0,
              additionalDiscountPercent: 0,
              items: [
                buildPackageItem({
                  childProductItem: buildChild({ isActive: false }),
                }),
              ],
            },
          }) as never,
        ),
      ).toThrow("Package component Child Service is inactive.");
    });

    it("rejects a package record without package configuration", () => {
      expect(() =>
        resolveCatalogSelectionFromRecord(
          buildProduct({ kind: "PACKAGE", package: null }) as never,
        ),
      ).toThrow("Package product is missing package configuration.");
    });
  });

  describe("createProduct", () => {
    it("creates a package from an inventory child with defaulted package numbers", async () => {
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce([{ id: "inv_1", status: "ACTIVE" }])
        .mockResolvedValueOnce([{ id: "inv_1" }]);
      prismaMock.productItem.create.mockResolvedValueOnce(
        buildProduct({ id: "pkg_new", kind: "PACKAGE", package: null }),
      );

      await CatalogService.createProduct({
        organisationId: "org_1",
        name: "Starter Bundle",
        kind: "PACKAGE",
        code: "PK-0001",
        price: { unitPrice: 10 } as never,
        packageItems: [
          {
            childProductItemId: "inv_1",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
          },
        ],
      });

      const createArgs = prismaMock.productItem.create.mock.calls[0][0];
      expect(createArgs.data.specialityId).toBeUndefined();
      expect(createArgs.data.prices.create).toEqual({
        unitPrice: 10,
        currency: undefined,
        defaultDiscountPercent: undefined,
        maxDiscountPercent: undefined,
        isDefault: true,
      });
      expect(createArgs.data.package.create).toEqual(
        expect.objectContaining({
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
        }),
      );
      expect(createArgs.data.package.create.items.create).toEqual([
        expect.objectContaining({
          childProductItemId: null,
          inventoryItemId: "inv_1",
          sortOrder: 0,
          isOptional: false,
        }),
      ]);
    });

    it("rejects a child that disappears between validation and persistence", async () => {
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce([{ id: "inv_1", status: "ACTIVE" }])
        .mockResolvedValueOnce([]);

      await expect(
        CatalogService.createProduct({
          organisationId: "org_1",
          name: "Starter Bundle",
          kind: "PACKAGE",
          code: "PK-0001",
          packageItems: [
            {
              childProductItemId: "inv_1",
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
            },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PACKAGE_CHILD_UNAVAILABLE",
        details: { childProductItemId: "inv_1" },
      });
      expect(prismaMock.productItem.create).not.toHaveBeenCalled();
    });
  });

  describe("updateProduct", () => {
    const existingProduct = {
      id: "prod_1",
      organisationId: "org_1",
      name: "Old name",
      description: "old description",
      code: "CS-0001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: "legacy_1",
      isActive: true,
      version: 4,
      prices: [buildPrice()],
      bookable: null,
      package: null,
    };

    const arrangeUpdate = (existing: MockRecord = existingProduct) => {
      prismaMock.productItem.findFirst.mockImplementation(
        (args?: { where?: { code?: string } }) =>
          Promise.resolve(args?.where?.code ? null : existing),
      );
      prismaMock.productItem.update.mockResolvedValue({});
      prismaMock.productItem.findUnique.mockResolvedValue(
        buildProduct({ id: "prod_1", version: 5 }),
      );
    };

    it("clears optional strings and regenerates the code when the kind changes", async () => {
      arrangeUpdate();
      prismaMock.productItem.findMany.mockResolvedValue([{ code: "PR-0003" }]);

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        kind: "PROCEDURE",
        description: "   ",
        legacyServiceId: "   ",
        specialityId: null,
        package: null,
      });

      const updateArgs = prismaMock.productItem.update.mock.calls[0][0];
      expect(updateArgs.data.code).toBe("PR-0004");
      expect(updateArgs.data.description).toBeNull();
      expect(updateArgs.data.legacyServiceId).toBeNull();
      expect(updateArgs.data.specialityId).toBeNull();
      expect(updateArgs.data.name).toBeUndefined();
      expect(prismaMock.productPackage.findUnique).toHaveBeenCalled();
    });

    it("deletes an orphaned package row when the kind moves away from PACKAGE", async () => {
      arrangeUpdate({ ...existingProduct, kind: "PACKAGE", package: null });
      prismaMock.productPackage.findUnique.mockResolvedValueOnce({
        id: "pkg_row",
      });

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        kind: "CONSULTATION",
        code: "CS-0009",
      });

      expect(prismaMock.productPackage.delete).toHaveBeenCalledWith({
        where: { id: "pkg_row" },
      });
    });

    it("writes null price attributes onto an existing default price row", async () => {
      arrangeUpdate();
      prismaMock.productPrice.findFirst.mockResolvedValueOnce({
        id: "price_1",
      });

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        price: { unitPrice: 55 } as never,
      });

      expect(prismaMock.productPrice.update).toHaveBeenCalledWith({
        where: { id: "price_1" },
        data: {
          unitPrice: 55,
          currency: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
        },
      });
    });

    it("creates a default price row when none exists yet", async () => {
      arrangeUpdate();
      prismaMock.productPrice.findFirst.mockResolvedValueOnce(null);

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        price: { unitPrice: 12 } as never,
      });

      expect(prismaMock.productPrice.create).toHaveBeenCalledWith({
        data: {
          productItemId: "prod_1",
          unitPrice: 12,
          currency: undefined,
          defaultDiscountPercent: undefined,
          maxDiscountPercent: undefined,
          isDefault: true,
        },
      });
    });

    it("keeps the stored package numbers when only the items change", async () => {
      arrangeUpdate({
        ...existingProduct,
        kind: "PACKAGE",
        package: { items: [] },
      });
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          { id: "child_1", isActive: true, prices: [buildPrice()] },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "child_1" }]);
      prismaMock.productPackage.upsert.mockResolvedValueOnce({ id: "pkg_row" });

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
          },
        ],
      });

      expect(prismaMock.productPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
      expect(prismaMock.productPackageItem.deleteMany).toHaveBeenCalledWith({
        where: { packageId: "pkg_row" },
      });
      expect(prismaMock.productPackageItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            packageId: "pkg_row",
            childProductItemId: "child_1",
            inventoryItemId: null,
          }),
        ],
      });
    });

    it("resets the package numbers when the package summary is cleared", async () => {
      arrangeUpdate({
        ...existingProduct,
        kind: "PACKAGE",
        package: { items: [{ childProductItemId: "child_1", quantity: 1 }] },
      });
      prismaMock.productPackage.upsert.mockResolvedValueOnce({ id: "pkg_row" });

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        package: null,
      });

      const upsertArgs = prismaMock.productPackage.upsert.mock.calls[0][0];
      expect(upsertArgs.update).toEqual({
        leadCount: 1,
        supportCount: 0,
        additionalDiscountPercent: 0,
      });
      expect(upsertArgs.create).toEqual(
        expect.objectContaining({
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
        }),
      );
      expect(prismaMock.productPackageItem.deleteMany).not.toHaveBeenCalled();
    });

    it("clears every package item when the update nulls the item list", async () => {
      arrangeUpdate({
        ...existingProduct,
        kind: "PACKAGE",
        package: {
          items: [
            {
              childProductItemId: "child_1",
              inventoryItemId: null,
              quantity: 1,
              pricingMode: "INHERITED_PRICE",
              overridePrice: null,
              discountPercent: null,
              sortOrder: 0,
              isOptional: false,
            },
          ],
        },
      });
      prismaMock.productPackage.upsert.mockResolvedValueOnce({ id: "pkg_row" });

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        packageItems: null,
      });

      expect(prismaMock.productPackageItem.deleteMany).toHaveBeenCalledWith({
        where: { packageId: "pkg_row" },
      });
      expect(prismaMock.productPackageItem.createMany).not.toHaveBeenCalled();
    });

    it("rejects a package update that empties the item list", async () => {
      arrangeUpdate({
        ...existingProduct,
        kind: "PACKAGE",
        package: { items: [] },
      });

      await expect(
        CatalogService.updateProduct("prod_1", {
          organisationId: "org_1",
          packageItems: [],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("removes the bookable row when bookable is explicitly nulled", async () => {
      arrangeUpdate();

      await CatalogService.updateProduct("prod_1", {
        organisationId: "org_1",
        bookable: null,
      });

      expect(prismaMock.productBookable.deleteMany).toHaveBeenCalledWith({
        where: { productItemId: "prod_1" },
      });
    });

    it("throws 404 when the product vanishes inside the transaction", async () => {
      arrangeUpdate();
      prismaMock.productItem.findUnique.mockResolvedValueOnce(null);

      await expect(
        CatalogService.updateProduct("prod_1", { organisationId: "org_1" }),
      ).rejects.toMatchObject({
        message: "Product not found.",
        statusCode: 404,
      });
    });
  });

  describe("getProductById", () => {
    it("maps a stored product into the catalog view", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({
          description: "desc",
          bookable: {
            durationMinutes: 20,
            supportsOutpatient: true,
            supportsInpatient: true,
          },
        }),
      );

      await expect(
        CatalogService.getProductById("prod_1", "org_1"),
      ).resolves.toEqual(
        expect.objectContaining({
          id: "prod_1",
          version: 1,
          defaultPrice: expect.objectContaining({
            unitPrice: 100,
            isDefault: true,
          }),
          bookable: {
            durationMinutes: 20,
            supportsOutpatient: true,
            supportsInpatient: true,
          },
          package: null,
          packageItems: [],
        }),
      );
    });
  });

  describe("getSpecialityCatalog", () => {
    it("hides packages when the services tab is active and defaults the tab", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([
        buildProduct({ id: "svc_1", kind: "CONSULTATION" }),
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: null,
        }),
      ]);

      const servicesTab = await CatalogService.getSpecialityCatalog({
        organisationId: "org_1",
        specialityId: "spec_1",
        tab: "services",
      });
      expect(servicesTab.packages).toEqual([]);
      expect(servicesTab.services).toHaveLength(1);
      expect(servicesTab.search).toBeNull();

      const packagesTab = await CatalogService.getSpecialityCatalog({
        organisationId: "org_1",
        specialityId: "spec_1",
        tab: "packages",
        search: "  bundle  ",
        includeInactive: true,
      });
      expect(packagesTab.services).toEqual([]);
      expect(packagesTab.packages[0]).toEqual(
        expect.objectContaining({
          id: "pkg_1",
          unitPrice: null,
          totalAmount: 0,
          currency: null,
          leadCount: null,
        }),
      );

      const defaultTab = await CatalogService.getSpecialityCatalog({
        organisationId: "org_1",
        specialityId: "spec_1",
      });
      expect(defaultTab.activeTab).toBe("all");
      expect(defaultTab.services).toHaveLength(1);
      expect(defaultTab.packages).toHaveLength(1);
    });

    it("returns a zero total for a service without a unit price", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([
        buildProduct({ id: "svc_1", prices: [] }),
      ]);

      const view = await CatalogService.getSpecialityCatalog({
        organisationId: "org_1",
        specialityId: "spec_1",
      });

      expect(view.services[0]).toEqual(
        expect.objectContaining({
          unitPrice: null,
          totalAmount: 0,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
        }),
      );
    });

    it("treats a null default discount as no discount", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([
        buildProduct({
          id: "svc_1",
          prices: [
            buildPrice({
              unitPrice: 60,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              currency: null,
            }),
          ],
        }),
      ]);

      const view = await CatalogService.getSpecialityCatalog({
        organisationId: "org_1",
        specialityId: "spec_1",
      });

      expect(view.services[0]).toEqual(
        expect.objectContaining({
          unitPrice: 60,
          totalAmount: 60,
          currency: null,
        }),
      );
    });
  });

  describe("getArchiveCatalog", () => {
    it("queries without a search clause when no search term is given", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);

      await expect(
        CatalogService.getArchiveCatalog("org_1", "spec_1"),
      ).resolves.toEqual({ services: [], packages: [] });

      expect(prismaMock.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: "org_1",
            specialityId: "spec_1",
            isActive: false,
          },
        }),
      );
    });
  });

  describe("getOrganisationSummary and listSpecialities", () => {
    it("restricts to active rows when no options are supplied", async () => {
      await CatalogService.getOrganisationSummary("org_1");

      expect(prismaMock.speciality.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org_1", isActive: true },
        }),
      );
      expect(prismaMock.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org_1", isActive: true },
        }),
      );
    });

    it("includes archived rows when asked", async () => {
      await CatalogService.getOrganisationSummary("org_1", {
        includeArchived: true,
        search: "derm",
      });

      expect(prismaMock.speciality.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organisationId: "org_1" } }),
      );
    });

    it("paginates the requested page and page size", async () => {
      prismaMock.speciality.findMany.mockResolvedValue([
        buildSpecialityRow({ id: "spec_a", name: "Alpha" }),
        buildSpecialityRow({ id: "spec_b", name: "Bravo" }),
        buildSpecialityRow({ id: "spec_c", name: "Charlie" }),
      ]);

      await expect(
        CatalogService.listSpecialities("org_1", { page: 2, pageSize: 2 }),
      ).resolves.toEqual(
        expect.objectContaining({
          page: 2,
          pageSize: 2,
          total: 3,
          items: [expect.objectContaining({ id: "spec_c" })],
        }),
      );
    });

    it("filters and counts only archived specialities when status is ARCHIVED", async () => {
      prismaMock.speciality.findMany.mockResolvedValue([
        buildSpecialityRow({ id: "spec_a", name: "Alpha" }),
        buildSpecialityRow({ id: "spec_b", name: "Bravo", isActive: false }),
      ]);

      await expect(
        CatalogService.listSpecialities("org_1", { status: "ARCHIVED" }),
      ).resolves.toEqual(
        expect.objectContaining({
          page: 1,
          pageSize: 50,
          total: 1,
          items: [expect.objectContaining({ id: "spec_b" })],
        }),
      );
    });

    it("falls back to page 1 and size 50 for non-positive paging input", async () => {
      prismaMock.speciality.findMany.mockResolvedValue([]);

      await expect(
        CatalogService.listSpecialities("org_1", {
          page: 0,
          pageSize: -5,
          status: "ACTIVE",
        }),
      ).resolves.toEqual(
        expect.objectContaining({ page: 1, pageSize: 50, total: 0 }),
      );
    });
  });

  describe("getSpecialityById", () => {
    it("throws when the speciality row does not exist for the organisation", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.getSpecialityById("spec_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Speciality not found.",
        statusCode: 404,
        code: "NOT_FOUND",
      });
    });
  });

  describe("searchItems", () => {
    it("combines archived catalog rows and archived inventory rows", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          isActive: false,
          prices: [],
          package: null,
        }),
      ]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          id: "inv_1",
          organisationId: "org_1",
          name: "Gauze",
          sku: null,
          description: null,
          status: "ARCHIVED",
          sellingPrice: null,
          currency: null,
        },
      ]);

      const result = await CatalogService.searchItems({
        organisationId: "org_1",
        includeArchived: true,
        page: 1,
        pageSize: 10,
      });

      expect(result.total).toBe(2);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: "pkg_1",
          status: "ARCHIVED",
          unitPrice: 0,
          currency: null,
          defaultDiscountPercent: 0,
          maxDiscountPercent: 0,
          canBeAddedToPackage: true,
          blockReason: null,
        }),
      );
      expect(result.items[1]).toEqual(
        expect.objectContaining({
          id: "inv_1",
          code: null,
          description: null,
          status: "ARCHIVED",
          unitPrice: 0,
          totalAmount: 0,
          currency: null,
          canBeAddedToPackage: false,
          blockReason: "Inventory item is archived.",
        }),
      );
      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org_1", status: { not: "DELETED" } },
        }),
      );
    });

    it("applies the speciality, kind and query filters and skips inventory", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);

      const result = await CatalogService.searchItems({
        organisationId: "org_1",
        specialityId: "spec_1",
        kinds: ["LAB", "PACKAGE"],
        q: "  blood  ",
        page: 3,
        pageSize: 5,
      });

      expect(result).toEqual(
        expect.objectContaining({
          query: "blood",
          page: 3,
          pageSize: 5,
          total: 0,
        }),
      );
      expect(prismaMock.inventoryItem.findMany).not.toHaveBeenCalled();
      expect(prismaMock.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            specialityId: "spec_1",
            isActive: true,
            kind: { in: ["LAB_TEST", "DIAGNOSTIC", "PACKAGE"] },
          }),
        }),
      );
    });

    it("treats an empty kinds array as no kind filter and no inventory", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);

      await CatalogService.searchItems({ organisationId: "org_1", kinds: [] });

      expect(prismaMock.inventoryItem.findMany).not.toHaveBeenCalled();
      expect(prismaMock.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org_1", isActive: true },
        }),
      );
    });

    it("queries active inventory with a search clause when no kinds are given", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      await CatalogService.searchItems({ organisationId: "org_1", q: "gauze" });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org_1",
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("allows an unrelated package when a cycle exclusion is requested", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          buildProduct({
            id: "pkg_other",
            kind: "PACKAGE",
            prices: [],
            package: {
              leadCount: 1,
              supportCount: 0,
              additionalDiscountPercent: 0,
              items: [],
            },
          }),
        ])
        .mockResolvedValueOnce([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      const result = await CatalogService.searchItems({
        organisationId: "org_1",
        excludePackageId: "pkg_current",
      });

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: "pkg_other",
          canBeAddedToPackage: true,
          blockReason: null,
        }),
      );
    });

    it("defaults to page 1 and size 20 for non-positive paging input", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([]);

      await expect(
        CatalogService.searchItems({
          organisationId: "org_1",
          page: -1,
          pageSize: 0,
        }),
      ).resolves.toEqual(
        expect.objectContaining({ page: 1, pageSize: 20, query: null }),
      );
    });
  });

  describe("restoreProduct", () => {
    it("revalidates the package composition and reuses the stored version", async () => {
      prismaMock.productItem.findFirst.mockImplementation(
        (args?: { where?: { code?: string } }) =>
          Promise.resolve(
            args?.where?.code
              ? null
              : buildProduct({
                  id: "pkg_1",
                  kind: "PACKAGE",
                  version: 7,
                  isActive: false,
                  package: {
                    leadCount: 1,
                    supportCount: 0,
                    additionalDiscountPercent: 0,
                    items: [buildPackageItem()],
                  },
                }),
          ),
      );
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          { id: "child_1", isActive: true, prices: [buildPrice()] },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "child_1" }]);
      prismaMock.productPackage.upsert.mockResolvedValue({ id: "pkg_row" });
      prismaMock.productItem.update.mockResolvedValue({});
      prismaMock.productItem.findUnique.mockResolvedValue(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          version: 8,
          package: null,
        }),
      );

      await CatalogService.restoreProduct("pkg_1", "org_1");

      expect(prismaMock.productItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe("createSpeciality", () => {
    it("keeps the team list untouched when there is no head user", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);
      prismaMock.speciality.create.mockResolvedValueOnce({ id: "spec_new" });

      await CatalogService.createSpeciality({
        organisationId: "org_1",
        name: "Oncology",
        teamMemberIds: ["user_1", "user_1"],
      });

      expect(prismaMock.speciality.create).toHaveBeenCalledWith({
        data: {
          organisationId: "org_1",
          name: "Oncology",
          headUserId: null,
          headName: undefined,
          headProfilePicUrl: undefined,
          memberUserIds: ["user_1"],
          isActive: true,
        },
      });
    });
  });

  describe("updateSpeciality", () => {
    const existingSpeciality = {
      id: "spec_1",
      organisationId: "org_1",
      name: "Dermatology",
      headUserId: "user_head",
      headName: "Dr Skin",
      headProfilePicUrl: "https://example.test/pic.png",
      memberUserIds: ["user_1"],
      isActive: true,
    };

    it("keeps every stored value when the patch is empty", async () => {
      prismaMock.speciality.findFirst
        .mockResolvedValueOnce(existingSpeciality)
        .mockResolvedValueOnce(null);
      prismaMock.speciality.update.mockResolvedValueOnce({ id: "spec_1" });

      await CatalogService.updateSpeciality("spec_1", {
        organisationId: "org_1",
      });

      expect(prismaMock.speciality.update).toHaveBeenCalledWith({
        where: { id: "spec_1" },
        data: {
          name: "Dermatology",
          headUserId: "user_head",
          headName: "Dr Skin",
          headProfilePicUrl: "https://example.test/pic.png",
          memberUserIds: ["user_1", "user_head"],
        },
      });
    });

    it("clears the head and the optional profile fields when they are nulled", async () => {
      prismaMock.speciality.findFirst
        .mockResolvedValueOnce({ ...existingSpeciality, memberUserIds: null })
        .mockResolvedValueOnce(null);
      prismaMock.speciality.update.mockResolvedValueOnce({ id: "spec_1" });

      await CatalogService.updateSpeciality("spec_1", {
        organisationId: "org_1",
        name: "Renamed",
        headUserId: null,
        headName: null,
        headProfilePicUrl: "   ",
        teamMemberIds: ["user_2"],
        isActive: false,
      });

      expect(prismaMock.speciality.update).toHaveBeenCalledWith({
        where: { id: "spec_1" },
        data: {
          name: "Renamed",
          headUserId: null,
          headName: null,
          headProfilePicUrl: null,
          memberUserIds: ["user_2"],
          isActive: false,
        },
      });
    });

    it("throws when the speciality does not belong to the organisation", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.updateSpeciality("spec_1", { organisationId: "org_1" }),
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });
  });

  describe("speciality lifecycle guards", () => {
    it("rejects archiving a speciality that is not in the organisation", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.archiveSpeciality("spec_1", "org_1"),
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
      expect(prismaMock.productItem.updateMany).not.toHaveBeenCalled();
    });

    it("rejects restoring a speciality that is not in the organisation", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.restoreSpeciality("spec_1", "org_1"),
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
      expect(prismaMock.speciality.update).not.toHaveBeenCalled();
    });

    it("rejects deleting a speciality that is not in the organisation", async () => {
      prismaMock.speciality.findFirst.mockResolvedValueOnce(null);

      await expect(
        CatalogService.deleteSpeciality("spec_1", "org_1"),
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
      expect(prismaMock.speciality.delete).not.toHaveBeenCalled();
    });
  });

  describe("listOrganisationsProvidingServiceNearby", () => {
    it("maps a package service with a null child code and no price rows", async () => {
      prismaMock.organization.findMany.mockResolvedValue([
        {
          id: "org_1",
          name: "Org",
          imageUrl: null,
          phoneNo: "12345",
          type: "CLINIC",
          appointmentCheckInBufferMinutes: null,
          appointmentCheckInRadiusMeters: null,
          address: null,
        },
      ]);
      prismaMock.speciality.findMany.mockResolvedValue([
        { id: "spec_1", name: "General", organisationId: "org_1" },
      ]);
      prismaMock.productItem.findMany.mockResolvedValue([
        {
          id: "pkg_nearby",
          name: "Bundle",
          kind: "PACKAGE",
          specialityId: "spec_1",
          organisationId: "org_1",
          bookable: {
            durationMinutes: 30,
            supportsOutpatient: false,
            supportsInpatient: true,
          },
          prices: [],
          package: {
            items: [
              buildPackageItem({
                childProductItem: buildChild({ code: null }),
              }),
            ],
          },
        },
      ]);

      const result =
        await CatalogService.listOrganisationsProvidingServiceNearby();

      expect(result[0].specialities[0].services[0]).toEqual(
        expect.objectContaining({
          id: "pkg_nearby",
          cost: 0,
          appointmentKinds: ["INPATIENT"],
          packageItems: [
            expect.objectContaining({
              childProductName: "Child Service",
            }),
          ],
        }),
      );

      // This endpoint returns OTHER organisations' catalogs, so a package shows
      // only WHAT it contains and how much of it. The per-line economics -
      // internal codes, pricing mode, override price, discount percent and the
      // computed gross/discount/final amounts - are another practice's
      // commercial terms and must not appear here.
      const [packageItem] = (
        result[0].specialities[0].services[0] as unknown as {
          packageItems: Array<Record<string, unknown>>;
        }
      ).packageItems;
      expect(Object.keys(packageItem).sort()).toEqual([
        "childProductKind",
        "childProductName",
        "id",
        "isOptional",
        "quantity",
        "sortOrder",
      ]);
    });
  });

  describe("remaining guard and fallback paths", () => {
    it("reports a package dependency when another package still references the product", async () => {
      prismaMock.productPackageItem.findFirst.mockResolvedValueOnce({
        id: "pkgitem_1",
        packageId: "pkg_1",
      });

      await expect(
        ensureProductDeletionAllowed("prod_1", "org_1"),
      ).rejects.toMatchObject({
        statusCode: 409,
        details: { packageDependencies: 1, appointments: 0, invoices: 0 },
      });
    });

    it("tolerates a null inventory lookup while resolving package persistence data", async () => {
      prismaMock.productItem.findMany
        .mockResolvedValueOnce([
          { id: "child_1", isActive: true, prices: [buildPrice()] },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "child_1" }]);
      prismaMock.inventoryItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null);
      prismaMock.productItem.create.mockResolvedValueOnce(
        buildProduct({ id: "pkg_new", kind: "PACKAGE", package: null }),
      );

      await CatalogService.createProduct({
        organisationId: "org_1",
        name: "Bundle",
        kind: "PACKAGE",
        code: "PK-0002",
        package: {
          leadCount: 3,
          supportCount: 2,
          additionalDiscountPercent: 15,
        } as never,
        packageItems: [
          {
            childProductItemId: "child_1",
            quantity: 1,
            pricingMode: "INHERITED_PRICE",
          },
        ],
      });

      const createArgs = prismaMock.productItem.create.mock.calls[0][0];
      expect(createArgs.data.package.create).toEqual(
        expect.objectContaining({
          leadCount: 3,
          supportCount: 2,
          additionalDiscountPercent: 15,
        }),
      );
      expect(createArgs.data.package.create.items.create).toEqual([
        expect.objectContaining({
          childProductItemId: "child_1",
          inventoryItemId: null,
        }),
      ]);
    });

    it("defaults every nullable inventory field on a package breakdown line", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [
              buildPackageItem({
                childProductItemId: null,
                inventoryItemId: "inv_1",
                childProductItem: null,
                inventoryItem: {
                  id: "inv_1",
                  name: "Unpriced supply",
                  sku: null,
                  status: "ARCHIVED",
                  sellingPrice: null,
                  currency: null,
                },
              }),
            ],
          },
        }),
      );

      const detail = await CatalogService.getPackageDetail("pkg_1", "org_1");

      expect(detail.items[0]).toEqual(
        expect.objectContaining({
          childItemId: "inv_1",
          childItemCode: null,
          unitPrice: 0,
          currency: null,
          grossAmount: 0,
        }),
      );
    });

    it("resolves an OVERRIDE_PRICE line whose child carries no price rows", () => {
      const resolved = resolveCatalogSelectionFromRecord(
        buildProduct({
          id: "pkg_1",
          kind: "PACKAGE",
          prices: [],
          package: {
            leadCount: 1,
            supportCount: 0,
            additionalDiscountPercent: 0,
            items: [
              buildPackageItem({
                pricingMode: "OVERRIDE_PRICE",
                overridePrice: 30,
                quantity: 2,
                discountPercent: null,
                childProductItem: buildChild({ prices: [] }),
              }),
            ],
          },
        }) as never,
      );

      expect(resolved.billingItems[0]).toEqual(
        expect.objectContaining({
          unitPrice: 30,
          currency: null,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 60,
          finalAmount: 60,
        }),
      );
      expect(resolved.currency).toBeNull();
    });

    it("loads template bindings and prefers the published template version", async () => {
      prismaMock.productItem.findFirst.mockResolvedValueOnce(
        buildProduct({ kind: "MEDICATION" }),
      );
      prismaMock.templateCatalogLink.findMany.mockResolvedValueOnce([
        {
          template: {
            id: "tmpl_1",
            kind: "PRESCRIPTION",
            latestVersion: 9,
            publishedVersion: 4,
          },
        },
        {
          template: {
            id: "tmpl_2",
            kind: "PRESCRIPTION",
            latestVersion: 6,
            publishedVersion: null,
          },
        },
      ]);

      const resolved = await CatalogService.resolveSelection("prod_1", "org_1");

      expect(resolved.templateBindings).toEqual([
        {
          templateKind: "PRESCRIPTION",
          templateId: "tmpl_1",
          templateVersion: 4,
        },
        {
          templateKind: "PRESCRIPTION",
          templateId: "tmpl_2",
          templateVersion: 6,
        },
      ]);
    });

    it("marks an active inventory row as addable in search results", async () => {
      prismaMock.productItem.findMany.mockResolvedValue([]);
      prismaMock.inventoryItem.findMany.mockResolvedValue([
        {
          id: "inv_1",
          organisationId: "org_1",
          name: "Gauze",
          sku: "SKU-9",
          description: "Sterile",
          status: "ACTIVE",
          sellingPrice: 12,
          currency: "USD",
        },
      ]);

      const result = await CatalogService.searchItems({
        organisationId: "org_1",
      });

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: "inv_1",
          code: "SKU-9",
          description: "Sterile",
          status: "ACTIVE",
          unitPrice: 12,
          totalAmount: 12,
          currency: "USD",
          canBeAddedToPackage: true,
          blockReason: null,
        }),
      );
    });

    it("rebuilds an empty team list when the speciality has neither members nor a head", async () => {
      prismaMock.speciality.findFirst
        .mockResolvedValueOnce({
          id: "spec_1",
          organisationId: "org_1",
          name: "Dermatology",
          headUserId: null,
          headName: null,
          headProfilePicUrl: null,
          memberUserIds: null,
          isActive: true,
        })
        .mockResolvedValueOnce(null);
      prismaMock.speciality.update.mockResolvedValueOnce({ id: "spec_1" });

      await CatalogService.updateSpeciality("spec_1", {
        organisationId: "org_1",
      });

      expect(prismaMock.speciality.update).toHaveBeenCalledWith({
        where: { id: "spec_1" },
        data: {
          name: "Dermatology",
          headUserId: null,
          headName: null,
          headProfilePicUrl: null,
          memberUserIds: [],
        },
      });
    });
  });
});

describe("CatalogService.listOrganisationsProvidingServiceNearby pricing", () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const arrange = (defaultDiscountPercent: number | undefined) => {
    prismaMock.organization.findMany.mockResolvedValue([
      { id: "org-1", name: "Vet", address: { city: "Mainz" } },
    ]);
    prismaMock.speciality.findMany.mockResolvedValue([
      { id: "spec-1", name: "General Practice", organisationId: "org-1" },
    ]);
    prismaMock.productItem.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "General Consultation",
        kind: "SERVICE",
        specialityId: "spec-1",
        organisationId: "org-1",
        bookable: { supportsOutpatient: true, supportsInpatient: false },
        prices: [{ unitPrice: 240, defaultDiscountPercent }],
      },
    ]);
  };

  it("quotes the discounted amount, and selects the field it needs to do so", async () => {
    // The select is asserted because omitting defaultDiscountPercent does not
    // fail: the field comes back undefined, the discount computes as zero and
    // the quote silently reverts to the gross price. That is exactly how this
    // shipped broken the first time.
    arrange(5);

    const result =
      await CatalogService.listOrganisationsProvidingServiceNearby();

    const select = prismaMock.productItem.findMany.mock.calls.at(-1)[0].select;
    expect(select.prices.select.defaultDiscountPercent).toBe(true);

    const service = result[0].specialities[0].services[0];
    expect(service.cost).toBe(240);
    expect(service.finalAmount).toBe(228);
    expect(service.defaultDiscountPercent).toBe(5);
  });

  it("quotes the gross price when the practice sets no default discount", async () => {
    arrange(0);

    const result =
      await CatalogService.listOrganisationsProvidingServiceNearby();

    expect(result[0].specialities[0].services[0].finalAmount).toBe(240);
  });
});
