import {
  CatalogService,
  CatalogServiceError,
  assertBookableConfig,
  assertPackageItems,
  assertPriceConfig,
  buildPackageGraph,
  ensureCodeUniqueness,
  ensurePackageItemsValid,
  ensureSpecialityDeletionAllowed,
  ensureSpecialityExists,
  ensureSpecialityNameUnique,
  generateProductCode,
  getPackageDepth,
  mapSpecialitySummaries,
  packageContainsTarget,
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
    expect(resolved).toEqual(
      expect.objectContaining({
        name: "Dental Bundle",
        currency: "USD",
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 10,
        grossAmount: 330,
        itemDiscountAmount: 0,
        additionalDiscountAmount: 33,
        finalAmount: 297,
      }),
    );
    expect(resolved.billingItems).toEqual([
      expect.objectContaining({
        productItemId: "pkg_dental",
        code: null,
        name: "Dental Bundle",
        kind: "PACKAGE",
        quantity: 1,
        currency: "USD",
        unitPrice: 250,
        grossAmount: 250,
        discountAmount: 0,
        finalAmount: 250,
        referenceUnitPrice: null,
        defaultDiscountPercent: null,
        maxDiscountPercent: 15,
        discountPercent: 0,
        isPackageComponent: false,
        packageProductItemId: null,
      }),
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
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValue({
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
    (prisma.productItem.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "prod_1",
        kind: "CONSULTATION",
        prices: [{ id: "price_1", isDefault: true }],
        bookable: { id: "book_1" },
        package: null,
      })
      .mockResolvedValueOnce({
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
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValueOnce({
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
    (prisma.productItem.findUnique as jest.Mock)
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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

  it("rejects stale updates when the expected version is outdated", async () => {
    (prisma.productItem.findUnique as jest.Mock).mockResolvedValue({
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

    expect(prisma.speciality.update).toHaveBeenCalledWith({
      where: { id: "spec_1" },
      data: expect.objectContaining({
        organisationId: "org_1",
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
                  packageItems: [
                    expect.objectContaining({
                      id: "pkg_item_1",
                      childProductItemId: "child_1",
                      childProductName: "Blood Test",
                      childProductKind: "LAB_TEST",
                      childProductCode: "BT-1",
                      quantity: 2,
                      pricingMode: "INCLUDED",
                      grossAmount: 0,
                      discountAmount: 0,
                      finalAmount: 0,
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
