import {
  CATALOG_CODE_SYSTEM,
  CATALOG_HEALTHCARE_SERVICE_PROFILE,
  fromCatalogResolveOperationRequestDTO,
  fromCatalogSearchOperationRequestDTO,
  fromCatalogRequestDTO,
  toCatalogResolveOperationResponseDTO,
  toCatalogBundleResponseDTO,
  toCatalogResponseDTO,
  toCatalogSearchOperationResponseDTO,
} from "@yosemite-crew/types";

describe("Catalog FHIR DTOs", () => {
  it("parses a HealthcareService resource into catalog input", () => {
    const input = fromCatalogRequestDTO({
      resourceType: "HealthcareService",
      id: "prod_consult",
      active: true,
      providedBy: {
        reference: "Organization/org_1",
      },
      name: "General Consultation",
      comment: "Consult desc",
      specialty: [
        {
          coding: [
            {
              system: "https://yosemite.health/fhir/CodeSystem/specialities",
              code: "spec_1",
            },
          ],
        },
      ],
      extension: [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-product-kind",
          valueString: "CONSULTATION",
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-code",
          valueString: "CS-001",
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-unit-price",
          valueDecimal: 100,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-default-discount-percent",
          valueDecimal: 10,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-max-discount-percent",
          valueDecimal: 15,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-duration-minutes",
          valueInteger: 30,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-outpatient",
          valueBoolean: true,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-inpatient",
          valueBoolean: false,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-lead-count",
          valueInteger: 2,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-support-count",
          valueInteger: 1,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-additional-discount-percent",
          valueDecimal: 10,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-gross-amount",
          valueDecimal: 100,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item-discount-amount",
          valueDecimal: 10,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-additional-discount-amount",
          valueDecimal: 9,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-breakdown-item-count",
          valueInteger: 1,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item",
          extension: [
            {
              url: "childProductItemId",
              valueString: "prod_exam",
            },
            {
              url: "quantity",
              valueInteger: 1,
            },
            {
              url: "pricingMode",
              valueString: "INHERITED_PRICE",
            },
            {
              url: "overridePrice",
              valueDecimal: 75,
            },
            {
              url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item-discount-percent",
              valueDecimal: 10,
            },
            {
              url: "sortOrder",
              valueInteger: 0,
            },
            {
              url: "isOptional",
              valueBoolean: false,
            },
          ],
        },
      ],
    });

    expect(input).toEqual({
      organisationId: "org_1",
      name: "General Consultation",
      description: "Consult desc",
      code: "CS-001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      price: {
        unitPrice: 100,
        defaultDiscountPercent: 10,
        maxDiscountPercent: 15,
      },
      package: {
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 10,
        grossAmount: 100,
        itemDiscountAmount: 10,
        additionalDiscountAmount: 9,
        breakdownItemCount: 1,
      },
      bookable: {
        id: "",
        productItemId: "prod_consult",
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      packageItems: [
        {
          id: "package-item-1",
          packageId: "",
          childProductItemId: "prod_exam",
          quantity: 1,
          pricingMode: "INHERITED_PRICE",
          overridePrice: 75,
          discountPercent: 10,
          sortOrder: 0,
          isOptional: false,
        },
      ],
    });
  });

  it("serializes catalog products into HealthcareService and Bundle", () => {
    const resource = toCatalogResponseDTO({
      id: "prod_consult",
      version: 7,
      organisationId: "org_1",
      name: "General Consultation",
      description: "Consult desc",
      code: "CS-001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: "svc_1",
      isActive: true,
      defaultPrice: {
        unitPrice: 100,
        defaultDiscountPercent: 10,
        maxDiscountPercent: 15,
      },
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      package: {
        leadCount: 2,
        supportCount: 1,
        additionalDiscountPercent: 10,
        grossAmount: 100,
        itemDiscountAmount: 10,
        additionalDiscountAmount: 9,
        breakdownItemCount: 1,
      },
      packageItems: [
        {
          id: "pkgi_1",
          packageId: "",
          childProductItemId: "prod_exam",
          quantity: 1,
          pricingMode: "INHERITED_PRICE",
          overridePrice: 75,
          discountPercent: 10,
          sortOrder: 0,
          isOptional: false,
          childProductCode: "CS-EXAM",
          childProductName: "Dental Exam",
          childProductKind: "CONSULTATION",
          currency: "USD",
          grossAmount: 100,
          discountAmount: 10,
          finalAmount: 90,
        },
      ],
    });

    expect(resource.resourceType).toBe("HealthcareService");
    expect(resource.id).toBe("prod_consult");
    expect(resource.providedBy?.reference).toBe("Organization/org_1");
    expect(resource.meta?.profile).toEqual([
      CATALOG_HEALTHCARE_SERVICE_PROFILE,
    ]);
    expect(resource.meta?.versionId).toBe("7");
    expect(resource.identifier).toEqual([
      {
        system: CATALOG_CODE_SYSTEM,
        value: "CS-001",
      },
    ]);
    expect(resource.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-lead-count",
          valueInteger: 2,
        }),
        expect.objectContaining({
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item",
        }),
      ]),
    );

    const bundle = toCatalogBundleResponseDTO(
      [
        {
          id: "prod_consult",
          organisationId: "org_1",
          name: "General Consultation",
          description: "Consult desc",
          code: "CS-001",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          defaultPrice: {
            unitPrice: 100,
          },
          bookable: null,
          packageItems: [],
        },
      ],
      {
        baseUrl: "/fhir/v1/healthcare-service",
        searchMode: "match",
      },
    );

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
    expect(bundle.total).toBe(1);
    expect(bundle.entry?.[0]?.resource?.resourceType).toBe("HealthcareService");
    expect(bundle.entry?.[0]?.fullUrl).toBe(
      "/fhir/v1/healthcare-service/prod_consult",
    );
    expect(bundle.entry?.[0]?.search?.mode).toBe("match");
  });

  it("parses and serializes resolve-selection Parameters contracts", () => {
    const input = fromCatalogResolveOperationRequestDTO({
      resourceType: "Parameters",
      parameter: [
        { name: "productItemId", valueString: "pkg_1" },
        { name: "organization", valueString: "Organization/org_1" },
      ],
    });

    expect(input).toEqual({
      productItemId: "pkg_1",
      organisationId: "org_1",
    });

    const response = toCatalogResolveOperationResponseDTO({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Cardio Package",
      code: "PK-1",
      currency: "USD",
      legacyServiceId: null,
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      leadCount: 1,
      supportCount: 0,
      additionalDiscountPercent: 0,
      grossAmount: 1200,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 1200,
      breakdownItemCount: 1,
      templateKinds: ["SOAP_NOTE", "INPATIENT_SCHEDULE"],
      templateBindings: [],
      billingItems: [
        {
          productItemId: "pkg_1",
          code: "PK-1",
          name: "Cardio Package",
          kind: "PACKAGE",
          quantity: 1,
          currency: "USD",
          unitPrice: 1200,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 1200,
          discountAmount: 0,
          finalAmount: 1200,
          isPackageComponent: false,
          packageProductItemId: null,
        },
      ],
      includedItems: [],
    });

    expect(response.resourceType).toBe("Parameters");
    expect(
      response.parameter?.find((item) => item.name === "productKind")
        ?.valueString,
    ).toBe("PACKAGE");
    expect(
      response.parameter?.find((item) => item.name === "grossAmount")
        ?.valueDecimal,
    ).toBe(1200);
    expect(
      response.parameter
        ?.filter((item) => item.name === "templateKind")
        .map((item) => item.valueString),
    ).toEqual(["SOAP_NOTE", "INPATIENT_SCHEDULE"]);
  });

  it("parses and serializes search-components Parameters contracts", () => {
    const input = fromCatalogSearchOperationRequestDTO({
      resourceType: "Parameters",
      parameter: [
        { name: "organization", valueString: "Organization/org_1" },
        { name: "specialty", valueString: "spec_1" },
        { name: "kinds", valueString: "LAB,PACKAGE" },
        { name: "includeNestedBreakdown", valueBoolean: true },
      ],
    });

    expect(input).toEqual({
      organisationId: "org_1",
      q: undefined,
      specialityId: "spec_1",
      kinds: ["LAB", "PACKAGE"],
      includeArchived: false,
      excludePackageId: undefined,
      includeNestedBreakdown: true,
      page: undefined,
      pageSize: undefined,
    });

    const response = toCatalogSearchOperationResponseDTO({
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
          durationMinutes: null,
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

    expect(response.resourceType).toBe("Parameters");
    expect(
      response.parameter?.find((item) => item.name === "total")?.valueInteger,
    ).toBe(1);
    const itemsPart = response.parameter?.find((item) => item.name === "items");
    expect(
      itemsPart?.part?.[0]?.part?.find((item) => item.name === "specialty")
        ?.valueString,
    ).toBe("spec_1");
    expect(
      itemsPart?.part?.[0]?.part?.find((item) => item.name === "totalAmount")
        ?.valueDecimal,
    ).toBe(784);
  });
});
