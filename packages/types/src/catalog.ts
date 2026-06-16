import type { Bundle, Extension, HealthcareService } from '@yosemite-crew/fhir';
import type { TemplateKind } from './template';

export const PRODUCT_KINDS = [
  'CONSULTATION',
  'PROCEDURE',
  'DIAGNOSTIC',
  'MEDICATION',
  'INVENTORY_ITEM',
  'LAB_TEST',
  'PACKAGE',
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const APPOINTMENT_KINDS = ['OUTPATIENT', 'INPATIENT'] as const;

export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export const PACKAGE_ITEM_PRICING_MODES = [
  'INCLUDED',
  'INHERITED_PRICE',
  'OVERRIDE_PRICE',
] as const;

export type PackageItemPricingMode = (typeof PACKAGE_ITEM_PRICING_MODES)[number];

export type CatalogPricePolicy = {
  unitPrice: number;
  currency?: string | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
};

export type ProductItem = {
  id: string;
  organisationId: string;
  name: string;
  description?: string | null;
  code?: string | null;
  kind: ProductKind;
  specialityId?: string | null;
  legacyServiceId?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ProductPrice = CatalogPricePolicy & {
  id: string;
  productItemId: string;
  isDefault: boolean;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ProductBookable = {
  id: string;
  productItemId: string;
  durationMinutes: number;
  supportsOutpatient: boolean;
  supportsInpatient: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CatalogTemplateBinding = {
  templateKind: TemplateKind;
  templateId?: string | null;
  templateVersion?: number | null;
};

export type ProductPackageItem = {
  id: string;
  packageId: string;
  childProductItemId: string;
  quantity: number;
  pricingMode: PackageItemPricingMode;
  overridePrice?: number | null;
  discountPercent?: number | null;
  sortOrder: number;
  isOptional: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ProductPackage = {
  id: string;
  productItemId: string;
  items: ProductPackageItem[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type ResolvedCatalogItem = {
  productItemId: string;
  code: string | null;
  name: string;
  kind: ProductKind;
  quantity: number;
  currency: string | null;
  unitPrice: number;
  referenceUnitPrice?: number | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
  discountPercent: number;
  grossAmount: number;
  discountAmount: number;
  finalAmount: number;
  isPackageComponent: boolean;
  packageProductItemId?: string | null;
};

export type ResolvedCatalogSelection = {
  productItemId: string;
  productKind: ProductKind;
  name: string;
  code: string | null;
  currency: string | null;
  legacyServiceId?: string | null;
  isBookable: boolean;
  appointmentKinds: AppointmentKind[];
  leadCount?: number | null;
  supportCount?: number | null;
  additionalDiscountPercent?: number | null;
  grossAmount: number;
  itemDiscountAmount: number;
  additionalDiscountAmount: number;
  finalAmount: number;
  breakdownItemCount?: number | null;
  templateKinds: TemplateKind[];
  templateBindings: CatalogTemplateBinding[];
  billingItems: ResolvedCatalogItem[];
  includedItems: ResolvedCatalogItem[];
};

export type CatalogTab = 'services' | 'packages' | 'all';

export type CatalogListRow = {
  id: string;
  version: number;
  code: string | null;
  name: string;
  description: string | null;
  kind: ProductKind;
  isBookable: boolean;
  isActive: boolean;
  durationMinutes: number | null;
  unitPrice: number | null;
  defaultDiscountPercent: number | null;
  maxDiscountPercent: number | null;
  totalAmount: number;
  leadCount?: number | null;
  supportCount?: number | null;
  additionalDiscountPercent?: number | null;
  grossAmount?: number | null;
  itemDiscountAmount?: number | null;
  additionalDiscountAmount?: number | null;
  breakdownItemCount?: number | null;
  currency?: string | null;
};

export type CatalogPackageBreakdownRow = {
  id: string;
  type: ProductKind;
  childItemId: string;
  childItemKind: ProductKind;
  childItemCode: string | null;
  name: string;
  childItemName: string;
  quantity: number;
  unitPrice: number;
  currency: string | null;
  grossAmount: number;
  discountPercent: number | null;
  discountAmount: number;
  finalAmount: number;
  pricingMode: PackageItemPricingMode;
  overridePrice: number | null;
  isOptional: boolean;
  sortOrder: number;
};

export type CatalogPackageDetail = {
  id: string;
  version: number;
  code: string | null;
  name: string;
  description: string | null;
  isBookable: boolean;
  isActive: boolean;
  durationMinutes: number | null;
  leadCount: number;
  supportCount: number;
  additionalDiscountPercent: number;
  grossAmount: number;
  itemDiscountAmount: number;
  additionalDiscountAmount: number;
  breakdownItemCount: number;
  maxDiscountPercent: number | null;
  currency: string | null;
  totalAmount: number;
  items: CatalogPackageBreakdownRow[];
};

export type SpecialityCatalogView = {
  specialityId: string;
  organisationId: string;
  activeTab: CatalogTab;
  search: string | null;
  services: CatalogListRow[];
  packages: CatalogListRow[];
};

export type CatalogPackageSummary = {
  leadCount: number;
  supportCount: number;
  additionalDiscountPercent: number;
  grossAmount: number;
  itemDiscountAmount: number;
  additionalDiscountAmount: number;
  breakdownItemCount: number;
};

export type CatalogSearchSource = 'CATALOG' | 'INVENTORY';
export type CatalogSearchStatus = 'ACTIVE' | 'ARCHIVED';

export type CatalogSearchItem = {
  id: string;
  organisationId: string;
  specialityId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  kind: ProductKind | 'INVENTORY_ITEM';
  source: CatalogSearchSource;
  status: CatalogSearchStatus;
  isBookable: boolean;
  durationMinutes: number | null;
  unitPrice: number;
  currency: string | null;
  defaultDiscountPercent: number;
  maxDiscountPercent: number;
  totalAmount: number;
  canBeAddedToPackage: boolean;
  blockReason: string | null;
  nestedBreakdown: CatalogPackageBreakdownRow[] | null;
};

export type CatalogSearchResult = {
  query: string | null;
  page: number;
  pageSize: number;
  total: number;
  items: CatalogSearchItem[];
};

export const EXT_CATALOG_KIND =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-product-kind';
export const CATALOG_HEALTHCARE_SERVICE_PROFILE =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-healthcare-service';
export const CATALOG_CODE_SYSTEM = 'https://yosemitecrew.com/fhir/NamingSystem/catalog-code';
export const EXT_CATALOG_DURATION =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-duration-minutes';
export const EXT_CATALOG_DEFAULT_DISCOUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-default-discount-percent';
export const EXT_CATALOG_MAX_DISCOUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-max-discount-percent';
export const EXT_CATALOG_PRICE =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-unit-price';
export const EXT_CATALOG_CODE = 'https://yosemitecrew.com/fhir/StructureDefinition/catalog-code';
export const EXT_CATALOG_LEGACY_SERVICE_ID =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-legacy-service-id';
export const EXT_CATALOG_BOOKABLE_OUTPATIENT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-outpatient';
export const EXT_CATALOG_BOOKABLE_INPATIENT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-inpatient';
export const EXT_CATALOG_LEAD_COUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-lead-count';
export const EXT_CATALOG_SUPPORT_COUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-support-count';
export const EXT_CATALOG_ADDITIONAL_DISCOUNT_PERCENT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-additional-discount-percent';
export const EXT_CATALOG_PACKAGE_GROSS_AMOUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-gross-amount';
export const EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_AMOUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item-discount-amount';
export const EXT_CATALOG_PACKAGE_ADDITIONAL_DISCOUNT_AMOUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-additional-discount-amount';
export const EXT_CATALOG_PACKAGE_BREAKDOWN_ITEM_COUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-breakdown-item-count';
export const EXT_CATALOG_PACKAGE_ITEM =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item';
export const EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_PERCENT =
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-package-item-discount-percent';
export const EXT_CATALOG_PACKAGE_ITEM_CHILD_ID = 'childProductItemId';
export const EXT_CATALOG_PACKAGE_ITEM_CHILD_CODE = 'childProductCode';
export const EXT_CATALOG_PACKAGE_ITEM_CHILD_NAME = 'childProductName';
export const EXT_CATALOG_PACKAGE_ITEM_CHILD_KIND = 'childProductKind';
export const EXT_CATALOG_PACKAGE_ITEM_QUANTITY = 'quantity';
export const EXT_CATALOG_PACKAGE_ITEM_PRICING_MODE = 'pricingMode';
export const EXT_CATALOG_PACKAGE_ITEM_OVERRIDE_PRICE = 'overridePrice';
export const EXT_CATALOG_PACKAGE_ITEM_CURRENCY = 'currency';
export const EXT_CATALOG_PACKAGE_ITEM_GROSS_AMOUNT = 'grossAmount';
export const EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_AMOUNT_VALUE = 'discountAmount';
export const EXT_CATALOG_PACKAGE_ITEM_FINAL_AMOUNT = 'finalAmount';
export const EXT_CATALOG_PACKAGE_ITEM_SORT_ORDER = 'sortOrder';
export const EXT_CATALOG_PACKAGE_ITEM_OPTIONAL = 'isOptional';

export type CatalogFHIRResource = HealthcareService;
export type CatalogFHIRBundle = Bundle;
export type CatalogFHIRBundleEntryMode = 'match' | 'include' | 'outcome';

export type CatalogFHIRInput = {
  organisationId: string;
  name: string;
  description?: string | null;
  code?: string | null;
  kind: ProductKind;
  specialityId?: string | null;
  legacyServiceId?: string | null;
  isActive?: boolean;
  price?: CatalogPricePolicy | null;
  bookable?: ProductBookable | null;
  package?: CatalogPackageSummary | null;
  packageItems?: ProductPackageItem[] | null;
};

type CatalogFHIRPackageItem = {
  id: string;
  packageId: string;
  childProductItemId: string;
  quantity: number;
  pricingMode: PackageItemPricingMode;
  overridePrice: number | null;
  discountPercent: number | null;
  sortOrder: number;
  isOptional: boolean;
  childProductCode?: string | null;
  childProductName?: string | null;
  childProductKind?: ProductKind | null;
  currency?: string | null;
  grossAmount?: number | null;
  discountAmount?: number | null;
  finalAmount?: number | null;
};

const toReferenceId = (reference?: string): string | undefined => {
  if (!reference) return undefined;
  const parts = reference.split('/');
  return parts.at(-1) || undefined;
};

const findExtension = (extensions: Extension[] | undefined, url: string) =>
  extensions?.find((extension) => extension.url === url);

const readIntegerExtension = (extensions: Extension[] | undefined, url: string) =>
  findExtension(extensions, url)?.valueInteger ?? undefined;

const readDecimalExtension = (extensions: Extension[] | undefined, url: string) =>
  findExtension(extensions, url)?.valueDecimal ?? undefined;

const parsePackageItemExtensions = (
  extensions: Extension[] | undefined
): ProductPackageItem[] | undefined => {
  const packageItemExtensions =
    extensions?.filter((extension) => extension.url === EXT_CATALOG_PACKAGE_ITEM) ?? [];

  if (!packageItemExtensions.length) {
    return undefined;
  }

  return packageItemExtensions.map((extension, index) => {
    const nested = extension.extension ?? [];

    return {
      id: `package-item-${index + 1}`,
      packageId: '',
      childProductItemId:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_CHILD_ID)?.valueString ?? '',
      quantity:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_QUANTITY)?.valueInteger ?? 1,
      pricingMode:
        (nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_PRICING_MODE)
          ?.valueString as PackageItemPricingMode) ?? 'INCLUDED',
      overridePrice:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_OVERRIDE_PRICE)?.valueDecimal ??
        null,
      discountPercent:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_PERCENT)
          ?.valueDecimal ?? null,
      sortOrder:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_SORT_ORDER)?.valueInteger ??
        index,
      isOptional:
        nested.find((item) => item.url === EXT_CATALOG_PACKAGE_ITEM_OPTIONAL)?.valueBoolean ??
        false,
    };
  });
};

const parsePackageSummaryExtensions = (
  extensions: Extension[] | undefined
): CatalogPackageSummary | undefined => {
  const leadCount = readIntegerExtension(extensions, EXT_CATALOG_LEAD_COUNT);
  const supportCount = readIntegerExtension(extensions, EXT_CATALOG_SUPPORT_COUNT);
  const additionalDiscountPercent = readDecimalExtension(
    extensions,
    EXT_CATALOG_ADDITIONAL_DISCOUNT_PERCENT
  );
  const grossAmount = readDecimalExtension(extensions, EXT_CATALOG_PACKAGE_GROSS_AMOUNT);
  const itemDiscountAmount = readDecimalExtension(
    extensions,
    EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_AMOUNT
  );
  const additionalDiscountAmount = readDecimalExtension(
    extensions,
    EXT_CATALOG_PACKAGE_ADDITIONAL_DISCOUNT_AMOUNT
  );
  const breakdownItemCount = readIntegerExtension(
    extensions,
    EXT_CATALOG_PACKAGE_BREAKDOWN_ITEM_COUNT
  );

  if (
    leadCount == null &&
    supportCount == null &&
    additionalDiscountPercent == null &&
    grossAmount == null &&
    itemDiscountAmount == null &&
    additionalDiscountAmount == null &&
    breakdownItemCount == null
  ) {
    return undefined;
  }

  return {
    leadCount: leadCount ?? 1,
    supportCount: supportCount ?? 0,
    additionalDiscountPercent: additionalDiscountPercent ?? 0,
    grossAmount: grossAmount ?? 0,
    itemDiscountAmount: itemDiscountAmount ?? 0,
    additionalDiscountAmount: additionalDiscountAmount ?? 0,
    breakdownItemCount: breakdownItemCount ?? 0,
  };
};

export const fromFHIRCatalogHealthcareService = (
  resource: CatalogFHIRResource
): CatalogFHIRInput => {
  if (!resource || resource.resourceType !== 'HealthcareService') {
    throw new Error('Invalid payload. Expected FHIR HealthcareService resource.');
  }

  const extensions = resource.extension ?? [];
  const durationMinutes = findExtension(extensions, EXT_CATALOG_DURATION)?.valueInteger;
  const supportsOutpatient = findExtension(
    extensions,
    EXT_CATALOG_BOOKABLE_OUTPATIENT
  )?.valueBoolean;
  const supportsInpatient = findExtension(extensions, EXT_CATALOG_BOOKABLE_INPATIENT)?.valueBoolean;

  return {
    organisationId: toReferenceId(resource.providedBy?.reference) ?? '',
    name: resource.name ?? '',
    description: resource.comment ?? null,
    code: findExtension(extensions, EXT_CATALOG_CODE)?.valueString ?? null,
    kind:
      (findExtension(extensions, EXT_CATALOG_KIND)?.valueString as ProductKind) ?? 'CONSULTATION',
    specialityId: resource.specialty?.[0]?.coding?.[0]?.code ?? null,
    legacyServiceId: findExtension(extensions, EXT_CATALOG_LEGACY_SERVICE_ID)?.valueString ?? null,
    isActive: resource.active ?? true,
    price:
      findExtension(extensions, EXT_CATALOG_PRICE)?.valueDecimal != null
        ? {
            unitPrice: findExtension(extensions, EXT_CATALOG_PRICE)?.valueDecimal ?? 0,
            defaultDiscountPercent:
              findExtension(extensions, EXT_CATALOG_DEFAULT_DISCOUNT)?.valueDecimal ?? null,
            maxDiscountPercent:
              findExtension(extensions, EXT_CATALOG_MAX_DISCOUNT)?.valueDecimal ?? null,
          }
        : null,
    bookable:
      durationMinutes != null
        ? {
            id: '',
            productItemId: resource.id ?? '',
            durationMinutes,
            supportsOutpatient: supportsOutpatient ?? true,
            supportsInpatient: supportsInpatient ?? false,
          }
        : null,
    package: parsePackageSummaryExtensions(extensions) ?? null,
    packageItems: parsePackageItemExtensions(extensions) ?? null,
  };
};

const buildPackageItemExtension = (item: CatalogFHIRPackageItem): Extension => ({
  url: EXT_CATALOG_PACKAGE_ITEM,
  extension: [
    {
      url: EXT_CATALOG_PACKAGE_ITEM_CHILD_ID,
      valueString: item.childProductItemId,
    },
    ...(item.childProductCode != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_CHILD_CODE,
            valueString: item.childProductCode,
          } as Extension,
        ]
      : []),
    ...(item.childProductName != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_CHILD_NAME,
            valueString: item.childProductName,
          } as Extension,
        ]
      : []),
    ...(item.childProductKind != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_CHILD_KIND,
            valueString: item.childProductKind,
          } as Extension,
        ]
      : []),
    {
      url: EXT_CATALOG_PACKAGE_ITEM_QUANTITY,
      valueInteger: item.quantity,
    },
    {
      url: EXT_CATALOG_PACKAGE_ITEM_PRICING_MODE,
      valueString: item.pricingMode,
    },
    ...(item.overridePrice != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_OVERRIDE_PRICE,
            valueDecimal: item.overridePrice,
          } as Extension,
        ]
      : []),
    ...(item.discountPercent != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_PERCENT,
            valueDecimal: item.discountPercent,
          } as Extension,
        ]
      : []),
    ...(item.currency != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_CURRENCY,
            valueString: item.currency,
          } as Extension,
        ]
      : []),
    ...(item.grossAmount != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_GROSS_AMOUNT,
            valueDecimal: item.grossAmount,
          } as Extension,
        ]
      : []),
    ...(item.discountAmount != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_AMOUNT_VALUE,
            valueDecimal: item.discountAmount,
          } as Extension,
        ]
      : []),
    ...(item.finalAmount != null
      ? [
          {
            url: EXT_CATALOG_PACKAGE_ITEM_FINAL_AMOUNT,
            valueDecimal: item.finalAmount,
          } as Extension,
        ]
      : []),
    {
      url: EXT_CATALOG_PACKAGE_ITEM_SORT_ORDER,
      valueInteger: item.sortOrder,
    },
    {
      url: EXT_CATALOG_PACKAGE_ITEM_OPTIONAL,
      valueBoolean: item.isOptional,
    },
  ],
});

type CatalogFHIRShape = {
  id: string;
  version?: number;
  organisationId: string;
  name: string;
  description: string | null;
  code: string | null;
  kind: ProductKind;
  specialityId: string | null;
  legacyServiceId?: string | null;
  isActive: boolean;
  defaultPrice?: CatalogPricePolicy | null;
  bookable?: {
    durationMinutes: number;
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  package?: CatalogPackageSummary | null;
  packageItems?:
    | CatalogFHIRPackageItem[]
    | Array<{
        id: string;
        childProductItemId: string;
        quantity: number;
        pricingMode: PackageItemPricingMode;
        overridePrice: number | null;
        discountPercent?: number | null;
        sortOrder: number;
        isOptional: boolean;
        childProductCode?: string | null;
        childProductName?: string | null;
        childProductKind?: ProductKind | null;
        currency?: string | null;
        grossAmount?: number | null;
        discountAmount?: number | null;
        finalAmount?: number | null;
      }>;
};

export const toFHIRCatalogHealthcareService = (product: CatalogFHIRShape): CatalogFHIRResource => {
  const extensions: Extension[] = [
    {
      url: EXT_CATALOG_KIND,
      valueString: product.kind,
    },
  ];

  if (product.code) {
    extensions.push({
      url: EXT_CATALOG_CODE,
      valueString: product.code,
    });
  }

  if (product.legacyServiceId) {
    extensions.push({
      url: EXT_CATALOG_LEGACY_SERVICE_ID,
      valueString: product.legacyServiceId,
    });
  }

  if (product.defaultPrice?.unitPrice != null) {
    extensions.push({
      url: EXT_CATALOG_PRICE,
      valueDecimal: product.defaultPrice.unitPrice,
    });
  }

  if (product.defaultPrice?.defaultDiscountPercent != null) {
    extensions.push({
      url: EXT_CATALOG_DEFAULT_DISCOUNT,
      valueDecimal: product.defaultPrice.defaultDiscountPercent,
    });
  }

  if (product.defaultPrice?.maxDiscountPercent != null) {
    extensions.push({
      url: EXT_CATALOG_MAX_DISCOUNT,
      valueDecimal: product.defaultPrice.maxDiscountPercent,
    });
  }

  if (product.package) {
    extensions.push({
      url: EXT_CATALOG_LEAD_COUNT,
      valueInteger: product.package.leadCount,
    });
    extensions.push({
      url: EXT_CATALOG_SUPPORT_COUNT,
      valueInteger: product.package.supportCount,
    });
    extensions.push({
      url: EXT_CATALOG_ADDITIONAL_DISCOUNT_PERCENT,
      valueDecimal: product.package.additionalDiscountPercent,
    });
    extensions.push({
      url: EXT_CATALOG_PACKAGE_GROSS_AMOUNT,
      valueDecimal: product.package.grossAmount,
    });
    extensions.push({
      url: EXT_CATALOG_PACKAGE_ITEM_DISCOUNT_AMOUNT,
      valueDecimal: product.package.itemDiscountAmount,
    });
    extensions.push({
      url: EXT_CATALOG_PACKAGE_ADDITIONAL_DISCOUNT_AMOUNT,
      valueDecimal: product.package.additionalDiscountAmount,
    });
    extensions.push({
      url: EXT_CATALOG_PACKAGE_BREAKDOWN_ITEM_COUNT,
      valueInteger: product.package.breakdownItemCount,
    });
  }

  if (product.bookable?.durationMinutes != null) {
    extensions.push({
      url: EXT_CATALOG_DURATION,
      valueInteger: product.bookable.durationMinutes,
    });
    extensions.push({
      url: EXT_CATALOG_BOOKABLE_OUTPATIENT,
      valueBoolean: product.bookable.supportsOutpatient,
    });
    extensions.push({
      url: EXT_CATALOG_BOOKABLE_INPATIENT,
      valueBoolean: product.bookable.supportsInpatient,
    });
  }

  if (product.packageItems?.length) {
    extensions.push(
      ...product.packageItems.map((item) =>
        buildPackageItemExtension({
          id: item.id,
          packageId: '',
          childProductItemId: item.childProductItemId,
          quantity: item.quantity,
          pricingMode: item.pricingMode,
          overridePrice: item.overridePrice ?? null,
          discountPercent: item.discountPercent ?? null,
          sortOrder: item.sortOrder,
          isOptional: item.isOptional,
          childProductCode: item.childProductCode ?? null,
          childProductName: item.childProductName ?? null,
          childProductKind: item.childProductKind ?? null,
          currency: item.currency ?? null,
          grossAmount: item.grossAmount ?? null,
          discountAmount: item.discountAmount ?? null,
          finalAmount: item.finalAmount ?? null,
        })
      )
    );
  }

  return {
    resourceType: 'HealthcareService',
    id: product.id,
    active: product.isActive,
    meta: {
      ...(product.version != null ? { versionId: String(product.version) } : {}),
      profile: [CATALOG_HEALTHCARE_SERVICE_PROFILE],
    },
    identifier: product.code
      ? [
          {
            system: CATALOG_CODE_SYSTEM,
            value: product.code,
          },
        ]
      : undefined,
    providedBy: {
      reference: `Organization/${product.organisationId}`,
    },
    name: product.name,
    comment: product.description ?? undefined,
    specialty: product.specialityId
      ? [
          {
            coding: [
              {
                system: 'https://yosemite.health/fhir/CodeSystem/specialities',
                code: product.specialityId,
              },
            ],
          },
        ]
      : undefined,
    extension: extensions,
  };
};

export const toFHIRCatalogBundle = (
  resources: CatalogFHIRShape[],
  options?: {
    baseUrl?: string;
    searchMode?: CatalogFHIRBundleEntryMode;
  }
): CatalogFHIRBundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({
    fullUrl: options?.baseUrl
      ? `${options.baseUrl.replace(/\/$/, '')}/${resource.id}`
      : `HealthcareService/${resource.id}`,
    search: {
      mode: options?.searchMode ?? 'match',
    },
    resource: toFHIRCatalogHealthcareService(resource),
  })),
});
