import {
  CatalogService,
  CatalogServiceError,
  resolveCatalogSelectionFromRecord,
} from "../../src/services/catalog.service";
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
    },
  },
}));

describe("CatalogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (prisma.productPackageItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.templateCatalogLink.findMany as jest.Mock).mockResolvedValue([]);
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
      "CARE_PATHWAY",
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
    (prisma.productItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "prod_exam",
          version: 1,
          organisationId: "org_1",
          name: "Exam",
          description: null,
          code: "CS-0002",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          package: null,
        },
      ])
      .mockResolvedValueOnce([]);
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
              kind: "CONSULTATION",
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

  it("archives and restores products through updateProduct", async () => {
    const updateSpy = jest
      .spyOn(CatalogService, "updateProduct")
      .mockResolvedValue({ id: "prod_1", version: 3 } as never);
    jest.spyOn(CatalogService, "getProductById").mockResolvedValue({
      id: "pkg_1",
      version: 2,
      kind: "PACKAGE",
      organisationId: "org_1",
      packageItems: [
        {
          childProductItemId: "prod_1",
          quantity: 1,
          pricingMode: "INHERITED_PRICE",
          overridePrice: null,
          discountPercent: null,
          sortOrder: 0,
          isOptional: false,
        },
      ],
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
});
