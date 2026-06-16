import type { Parameters as FHIRParameters } from '@yosemite-crew/fhir';
import type {
  CatalogPackageBreakdownRow,
  CatalogSearchItem,
  CatalogSearchResult,
  ResolvedCatalogSelection,
} from '../catalog';

export const CATALOG_RESOLVE_SELECTION_OPERATION = '$resolve-selection';
export const CATALOG_SEARCH_COMPONENTS_OPERATION = '$search-components';

export const CATALOG_SEARCH_OPERATION_KINDS = [
  'CONSULTATION',
  'PROCEDURE',
  'LAB',
  'MEDICATION',
  'INVENTORY',
  'PACKAGE',
] as const;

export type CatalogResolveOperationRequestDTO = FHIRParameters;
export type CatalogResolveOperationResponseDTO = FHIRParameters;
export type CatalogSearchOperationRequestDTO = FHIRParameters;
export type CatalogSearchOperationResponseDTO = FHIRParameters;

export type CatalogSearchOperationKind = (typeof CATALOG_SEARCH_OPERATION_KINDS)[number];

export type CatalogResolveOperationInput = {
  productItemId: string;
  organisationId?: string;
};

export type CatalogSearchOperationInput = {
  organisationId: string;
  q?: string;
  specialityId?: string;
  kinds?: CatalogSearchOperationKind[];
  includeArchived?: boolean;
  excludePackageId?: string;
  includeNestedBreakdown?: boolean;
  page?: number;
  pageSize?: number;
};

const getParameter = (dto: FHIRParameters, name: string) =>
  dto.parameter?.find((parameter) => parameter.name === name);

const normalizeReferenceId = (value?: string): string | undefined => {
  if (!value) return undefined;

  return value.replace(/^Organization\//, '').trim() || undefined;
};

const requireParametersResource = (dto: FHIRParameters, message: string) => {
  if (!dto || dto.resourceType !== 'Parameters') {
    throw new Error(message);
  }
};

const requireValueString = (value: string | undefined, field: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(field);
  }

  return trimmed;
};

const parseKinds = (value?: string): CatalogSearchOperationKind[] | undefined => {
  const rawKinds = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!rawKinds?.length) {
    return undefined;
  }

  const validKinds = new Set<string>(CATALOG_SEARCH_OPERATION_KINDS);
  for (const kind of rawKinds) {
    if (!validKinds.has(kind)) {
      throw new Error(`Unsupported catalog search kind: ${kind}`);
    }
  }

  return rawKinds as CatalogSearchOperationKind[];
};

export const fromCatalogResolveOperationRequestDTO = (
  dto: CatalogResolveOperationRequestDTO
): CatalogResolveOperationInput => {
  requireParametersResource(dto, 'Invalid payload. Expected FHIR Parameters resource.');

  return {
    productItemId: requireValueString(
      getParameter(dto, 'productItemId')?.valueString,
      'Parameters.productItemId is required.'
    ),
    organisationId: normalizeReferenceId(getParameter(dto, 'organization')?.valueString),
  };
};

export const toCatalogResolveOperationResponseDTO = (
  result: ResolvedCatalogSelection
): CatalogResolveOperationResponseDTO => ({
  resourceType: 'Parameters',
  parameter: [
    { name: 'productItemId', valueString: result.productItemId },
    { name: 'name', valueString: result.name },
    { name: 'productKind', valueString: result.productKind },
    ...(result.code ? [{ name: 'code', valueString: result.code }] : []),
    ...(result.currency ? [{ name: 'currency', valueString: result.currency }] : []),
    { name: 'isBookable', valueBoolean: result.isBookable },
    ...(result.leadCount != null ? [{ name: 'leadCount', valueInteger: result.leadCount }] : []),
    ...(result.supportCount != null
      ? [{ name: 'supportCount', valueInteger: result.supportCount }]
      : []),
    ...(result.additionalDiscountPercent != null
      ? [
          {
            name: 'additionalDiscountPercent',
            valueDecimal: result.additionalDiscountPercent,
          },
        ]
      : []),
    { name: 'grossAmount', valueDecimal: result.grossAmount },
    { name: 'itemDiscountAmount', valueDecimal: result.itemDiscountAmount },
    { name: 'additionalDiscountAmount', valueDecimal: result.additionalDiscountAmount },
    { name: 'finalAmount', valueDecimal: result.finalAmount },
    ...(result.breakdownItemCount != null
      ? [{ name: 'breakdownItemCount', valueInteger: result.breakdownItemCount }]
      : []),
    ...result.templateKinds.map((kind) => ({
      name: 'templateKind',
      valueString: kind,
    })),
    ...result.appointmentKinds.map((kind) => ({
      name: 'appointmentKind',
      valueString: kind,
    })),
    {
      name: 'billingItems',
      part: result.billingItems.map((item) => ({
        name: 'item',
        part: [
          { name: 'productItemId', valueString: item.productItemId },
          ...(item.code ? [{ name: 'code', valueString: item.code }] : []),
          { name: 'name', valueString: item.name },
          { name: 'kind', valueString: item.kind },
          { name: 'quantity', valueInteger: item.quantity },
          ...(item.currency ? [{ name: 'currency', valueString: item.currency }] : []),
          { name: 'unitPrice', valueDecimal: item.unitPrice },
          { name: 'grossAmount', valueDecimal: item.grossAmount },
          { name: 'discountPercent', valueDecimal: item.discountPercent },
          { name: 'discountAmount', valueDecimal: item.discountAmount },
          { name: 'finalAmount', valueDecimal: item.finalAmount },
          ...(item.referenceUnitPrice != null
            ? [{ name: 'referenceUnitPrice', valueDecimal: item.referenceUnitPrice }]
            : []),
          ...(item.packageProductItemId
            ? [
                {
                  name: 'packageProductItemId',
                  valueString: item.packageProductItemId,
                },
              ]
            : []),
        ],
      })),
    },
    {
      name: 'includedItems',
      part: result.includedItems.map((item) => ({
        name: 'item',
        part: [
          { name: 'productItemId', valueString: item.productItemId },
          ...(item.code ? [{ name: 'code', valueString: item.code }] : []),
          { name: 'name', valueString: item.name },
          { name: 'kind', valueString: item.kind },
          { name: 'quantity', valueInteger: item.quantity },
          ...(item.currency ? [{ name: 'currency', valueString: item.currency }] : []),
          { name: 'unitPrice', valueDecimal: item.unitPrice },
          { name: 'grossAmount', valueDecimal: item.grossAmount },
          { name: 'discountPercent', valueDecimal: item.discountPercent },
          { name: 'discountAmount', valueDecimal: item.discountAmount },
          { name: 'finalAmount', valueDecimal: item.finalAmount },
          ...(item.referenceUnitPrice != null
            ? [{ name: 'referenceUnitPrice', valueDecimal: item.referenceUnitPrice }]
            : []),
        ],
      })),
    },
  ],
});

export const fromCatalogSearchOperationRequestDTO = (
  dto: CatalogSearchOperationRequestDTO
): CatalogSearchOperationInput => {
  requireParametersResource(dto, 'Invalid payload. Expected FHIR Parameters resource.');

  return {
    organisationId: requireValueString(
      normalizeReferenceId(getParameter(dto, 'organization')?.valueString),
      'Parameters.organization is required.'
    ),
    q: getParameter(dto, 'q')?.valueString?.trim() || undefined,
    specialityId:
      getParameter(dto, 'specialty')?.valueString?.trim() ||
      getParameter(dto, 'speciality')?.valueString?.trim() ||
      undefined,
    kinds: parseKinds(getParameter(dto, 'kinds')?.valueString),
    includeArchived: getParameter(dto, 'includeArchived')?.valueBoolean ?? false,
    excludePackageId: getParameter(dto, 'excludePackageId')?.valueString?.trim() || undefined,
    includeNestedBreakdown: getParameter(dto, 'includeNestedBreakdown')?.valueBoolean ?? false,
    page: getParameter(dto, 'page')?.valueInteger,
    pageSize: getParameter(dto, 'pageSize')?.valueInteger,
  };
};

export const toCatalogSearchOperationResponseDTO = (
  result: CatalogSearchResult
): CatalogSearchOperationResponseDTO => ({
  resourceType: 'Parameters',
  parameter: [
    { name: 'query', valueString: result.query ?? undefined },
    { name: 'page', valueInteger: result.page },
    { name: 'pageSize', valueInteger: result.pageSize },
    { name: 'total', valueInteger: result.total },
    {
      name: 'items',
      part: result.items.map((item: CatalogSearchItem) => ({
        name: 'item',
        part: [
          { name: 'id', valueString: item.id },
          { name: 'organization', valueString: `Organization/${item.organisationId}` },
          ...(item.specialityId ? [{ name: 'specialty', valueString: item.specialityId }] : []),
          ...(item.code ? [{ name: 'code', valueString: item.code }] : []),
          { name: 'name', valueString: item.name },
          ...(item.description ? [{ name: 'description', valueString: item.description }] : []),
          { name: 'kind', valueString: item.kind },
          { name: 'source', valueString: item.source },
          { name: 'status', valueString: item.status },
          { name: 'isBookable', valueBoolean: item.isBookable },
          ...(item.durationMinutes != null
            ? [{ name: 'durationMinutes', valueInteger: item.durationMinutes }]
            : []),
          { name: 'unitPrice', valueDecimal: item.unitPrice },
          ...(item.currency ? [{ name: 'currency', valueString: item.currency }] : []),
          { name: 'defaultDiscountPercent', valueDecimal: item.defaultDiscountPercent },
          { name: 'maxDiscountPercent', valueDecimal: item.maxDiscountPercent },
          { name: 'totalAmount', valueDecimal: item.totalAmount },
          { name: 'canBeAddedToPackage', valueBoolean: item.canBeAddedToPackage },
          ...(item.blockReason ? [{ name: 'blockReason', valueString: item.blockReason }] : []),
          ...(item.nestedBreakdown
            ? [
                {
                  name: 'nestedBreakdown',
                  part: item.nestedBreakdown.map((nestedItem: CatalogPackageBreakdownRow) => ({
                    name: 'item',
                    part: [
                      { name: 'id', valueString: nestedItem.id },
                      { name: 'kind', valueString: nestedItem.type },
                      { name: 'childItemId', valueString: nestedItem.childItemId },
                      { name: 'childItemKind', valueString: nestedItem.childItemKind },
                      ...(nestedItem.childItemCode
                        ? [{ name: 'childItemCode', valueString: nestedItem.childItemCode }]
                        : []),
                      { name: 'name', valueString: nestedItem.name },
                      { name: 'childItemName', valueString: nestedItem.childItemName },
                      { name: 'quantity', valueInteger: nestedItem.quantity },
                      ...(nestedItem.currency
                        ? [{ name: 'currency', valueString: nestedItem.currency }]
                        : []),
                      { name: 'unitPrice', valueDecimal: nestedItem.unitPrice },
                      { name: 'grossAmount', valueDecimal: nestedItem.grossAmount },
                      ...(nestedItem.discountPercent != null
                        ? [
                            {
                              name: 'discountPercent',
                              valueDecimal: nestedItem.discountPercent,
                            },
                          ]
                        : []),
                      { name: 'discountAmount', valueDecimal: nestedItem.discountAmount },
                      { name: 'finalAmount', valueDecimal: nestedItem.finalAmount },
                      { name: 'pricingMode', valueString: nestedItem.pricingMode },
                      ...(nestedItem.overridePrice != null
                        ? [{ name: 'overridePrice', valueDecimal: nestedItem.overridePrice }]
                        : []),
                      { name: 'isOptional', valueBoolean: nestedItem.isOptional },
                      { name: 'sortOrder', valueInteger: nestedItem.sortOrder },
                    ],
                  })),
                },
              ]
            : []),
        ],
      })),
    },
  ],
});
