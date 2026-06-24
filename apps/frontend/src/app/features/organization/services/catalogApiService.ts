import { deleteData, getData, patchData, postData, putData } from '@/app/services/axios';
import {
  fromCatalogRequestDTO,
  fromSpecialityRequestDTO,
  toCatalogResponseDTO,
  toSpecialityResponseDTO,
  type CatalogListRow,
  type CatalogPackageBreakdownRow,
  type CatalogPackageDetail,
  type CatalogSearchItem,
  type CatalogSearchOperationKind,
  type CatalogSearchOperationResponseDTO,
  type ProductKind,
  type Speciality,
} from '@yosemite-crew/types';
import type { HealthcareService, Parameters as FHIRParameters } from '@yosemite-crew/fhir';
import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';
import {
  computePackageBreakdownItem,
  computePackageTotals,
} from '@/app/features/organization/services/catalogCalculations';

type ListResponse<T> = T[] | { items?: T[] };
type SpecialityRow = {
  id?: string;
  _id?: string;
  specialityId?: string;
  organisationId?: string;
  organizationId?: string;
  name?: string;
  headUserId?: string | null;
  headVetId?: string | null;
  teamMemberIds?: string[];
  activeServiceCount?: number | null;
  activePackageCount?: number | null;
};

const unwrapItems = <T>(data: ListResponse<T>): T[] =>
  Array.isArray(data) ? data : (data.items ?? []);

const toId = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeKind = (kind: string | null | undefined): CatalogItemType => {
  if (kind === 'DIAGNOSTIC' || kind === 'LAB_TEST') return 'LAB';
  if (kind === 'INVENTORY_ITEM') return 'INVENTORY';
  if (
    kind === 'CONSULTATION' ||
    kind === 'PROCEDURE' ||
    kind === 'INVENTORY' ||
    kind === 'LAB' ||
    kind === 'MEDICATION' ||
    kind === 'PACKAGE'
  ) {
    return kind;
  }
  return 'CONSULTATION';
};

const toProductKind = (kind: CatalogItemType): ProductKind => {
  if (kind === 'LAB') return 'LAB_TEST';
  if (kind === 'INVENTORY') return 'INVENTORY_ITEM';
  return kind;
};

const appointmentModesFromFlags = (isBookable: boolean, isInpatientPreferred: boolean) => ({
  supportsOutpatient: isBookable,
  supportsInpatient: isInpatientPreferred,
});

const bookableFromFlags = (
  durationMinutes: number,
  isBookable: boolean,
  isInpatientPreferred: boolean
) => {
  const bookable = appointmentModesFromFlags(isBookable, isInpatientPreferred);
  if (!bookable.supportsOutpatient && !bookable.supportsInpatient) return null;
  return {
    durationMinutes,
    ...bookable,
  };
};

const formatDurationText = (minutes: number | null | undefined): string =>
  minutes ? `Approx. ${minutes} mins` : 'Approx. 30 mins';

export const parseDurationMinutes = (value: string): number => {
  const firstNumber = /\d+/.exec(value)?.[0];
  if (!firstNumber) return 30;
  return Math.max(1, Number.parseInt(firstNumber, 10));
};

const mapSpeciality = (row: SpecialityRow, fallbackOrgId: string): SpecialityRevamp => ({
  id: toId(row.id ?? row._id ?? row.specialityId),
  name: row.name ?? '',
  organisationId: toId(row.organisationId ?? row.organizationId) || fallbackOrgId,
  headVetId: toId(row.headVetId ?? row.headUserId) || undefined,
  teamMemberIds: Array.isArray(row.teamMemberIds) ? row.teamMemberIds : [],
  activeServiceCount: row.activeServiceCount ?? undefined,
  activePackageCount: row.activePackageCount ?? undefined,
});

/**
 * The live `/v1/catalog/.../services` and `/packages` endpoints return the rich
 * product "view" shape (nested `defaultPrice`/`bookable`/`package`) rather than the
 * flat `CatalogListRow` documented in the handoff. These readers tolerate both shapes
 * so price, discount and duration render correctly regardless of which the backend sends.
 */
type ProductPriceView = {
  unitPrice?: number | null;
  currency?: string | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
};
type ProductBookableView = {
  durationMinutes?: number | null;
  supportsOutpatient?: boolean | null;
  supportsInpatient?: boolean | null;
};
type CatalogRowLike = Partial<CatalogListRow> & {
  organisationId?: string;
  specialityId?: string;
  defaultPrice?: ProductPriceView | null;
  bookable?: boolean | ProductBookableView | null;
  package?: {
    leadCount?: number | null;
    supportCount?: number | null;
    additionalDiscountPercent?: number | null;
    finalAmount?: number | null;
    grossAmount?: number | null;
  } | null;
  packageItems?: PackageDetailItemLike[] | null;
};

const priceView = (row: CatalogRowLike): ProductPriceView =>
  (row.defaultPrice && typeof row.defaultPrice === 'object' ? row.defaultPrice : {}) ?? {};

const bookableView = (row: CatalogRowLike): ProductBookableView =>
  row.bookable && typeof row.bookable === 'object' ? row.bookable : {};

const readUnitPrice = (row: CatalogRowLike): number =>
  priceView(row).unitPrice ?? row.unitPrice ?? row.grossAmount ?? row.totalAmount ?? 0;

const readDefaultDiscount = (row: CatalogRowLike): number =>
  priceView(row).defaultDiscountPercent ?? row.defaultDiscountPercent ?? 0;

const readMaxDiscount = (row: CatalogRowLike): number =>
  priceView(row).maxDiscountPercent ?? row.maxDiscountPercent ?? 0;

const readCurrency = (row: CatalogRowLike): string | undefined =>
  priceView(row).currency ?? row.currency ?? undefined;

const readDurationMinutes = (row: CatalogRowLike): number =>
  bookableView(row).durationMinutes ?? row.durationMinutes ?? 30;

const readIsBookable = (row: CatalogRowLike): boolean =>
  bookableView(row).supportsOutpatient ?? Boolean(row.isBookable);

const readIsInpatient = (row: CatalogRowLike): boolean =>
  Boolean(bookableView(row).supportsInpatient);

const mapServiceRow = (
  row: CatalogRowLike,
  organisationId: string,
  specialityId: string
): ServiceRevamp => ({
  id: row.id ?? '',
  code: row.code ?? '',
  name: row.name ?? '',
  description: row.description ?? '',
  type: normalizeKind(row.kind),
  specialityId: row.specialityId ?? specialityId,
  organisationId: row.organisationId ?? organisationId,
  grossAmount: readUnitPrice(row),
  currency: readCurrency(row),
  defaultDiscount: readDefaultDiscount(row),
  maxDiscount: readMaxDiscount(row),
  durationMinutes: readDurationMinutes(row),
  isBookable: readIsBookable(row),
  isInpatientPreferred: readIsInpatient(row),
  status: row.isActive === false ? 'ARCHIVED' : 'ACTIVE',
  createdAt: new Date().toISOString(),
  version: row.version,
});

/** Breakdown rows arrive either as flat `CatalogPackageBreakdownRow` (detail JSON) or as
 * the nested product-view `packageItems` shape. This union covers both. */
type PackageDetailItemLike = Partial<CatalogPackageBreakdownRow> & {
  childProductItemId?: string;
  childProductCode?: string | null;
  childProductName?: string;
  childProductKind?: string;
  unitPrice?: number | null;
  overridePrice?: number | null;
};

const breakdownUnitPrice = (item: PackageDetailItemLike): number => {
  if (typeof item.unitPrice === 'number') return item.unitPrice;
  if (typeof item.overridePrice === 'number') return item.overridePrice;
  // Product-view rows omit unitPrice; derive the pre-discount unit price from grossAmount.
  if (typeof item.grossAmount === 'number' && item.quantity) {
    return item.grossAmount / item.quantity;
  }
  if (typeof item.finalAmount === 'number' && item.quantity) {
    return item.finalAmount / item.quantity;
  }
  return 0;
};

const mapBreakdown = (rows: PackageDetailItemLike[] = []): PackageBreakdownItem[] =>
  rows.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    childItemId: item.childItemId ?? item.childProductItemId,
    code: item.childItemCode ?? item.childProductCode ?? undefined,
    type: normalizeKind(item.childItemKind ?? item.childProductKind ?? item.type),
    name: item.childItemName ?? item.childProductName ?? item.name ?? '',
    unitPrice: breakdownUnitPrice(item),
    currency: item.currency ?? undefined,
    quantity: item.quantity ?? 1,
    discount: item.discountPercent ?? 0,
    maxDiscount: undefined,
    isBookable: false,
    isInpatientPreferred: false,
  }));

const mapPackageRow = (
  row: CatalogRowLike,
  organisationId: string,
  specialityId: string
): PackageRevamp => ({
  id: row.id ?? '',
  code: row.code ?? '',
  name: row.name ?? '',
  description: row.description ?? '',
  specialityId: row.specialityId ?? specialityId,
  organisationId: row.organisationId ?? organisationId,
  durationText: formatDurationText(readDurationMinutes(row)),
  isBookable: readIsBookable(row),
  isInpatientPreferred: readIsInpatient(row),
  currency: readCurrency(row),
  leadCount: row.package?.leadCount ?? row.leadCount ?? 1,
  supportCount: row.package?.supportCount ?? row.supportCount ?? 0,
  additionalDiscount: row.package?.additionalDiscountPercent ?? row.additionalDiscountPercent ?? 0,
  breakdown: mapBreakdown(row.packageItems ?? []),
  serverFinalAmount: row.package?.finalAmount ?? undefined,
  status: row.isActive === false ? 'ARCHIVED' : 'ACTIVE',
  createdAt: new Date().toISOString(),
  version: row.version,
});

const mapPackageDetail = (
  detail: CatalogPackageDetail & { organisationId?: string; specialityId?: string },
  fallback: PackageRevamp
): PackageRevamp => ({
  ...fallback,
  id: detail.id,
  code: detail.code ?? fallback.code,
  name: detail.name,
  description: detail.description ?? '',
  durationText: formatDurationText(detail.durationMinutes),
  isBookable: detail.isBookable,
  currency: detail.currency ?? undefined,
  leadCount: detail.leadCount,
  supportCount: detail.supportCount,
  additionalDiscount: detail.additionalDiscountPercent,
  breakdown: mapBreakdown(detail.items),
  status: detail.isActive ? 'ACTIVE' : 'ARCHIVED',
  version: detail.version,
});

type CatalogServicePayload = Omit<ServiceRevamp, 'id' | 'code' | 'createdAt'> &
  Partial<Pick<ServiceRevamp, 'id' | 'code' | 'version'>>;

const catalogPayloadFromService = (service: CatalogServicePayload) =>
  toCatalogResponseDTO({
    id: service.id ?? '',
    version: service.version,
    organisationId: service.organisationId,
    name: service.name,
    description: service.description || null,
    code: service.code ?? null,
    kind: toProductKind(service.type),
    specialityId: service.specialityId,
    legacyServiceId: null,
    isActive: service.status !== 'ARCHIVED',
    defaultPrice: {
      unitPrice: service.grossAmount,
      currency: service.currency ?? null,
      defaultDiscountPercent: service.defaultDiscount,
      maxDiscountPercent: service.maxDiscount,
    },
    bookable: bookableFromFlags(
      service.durationMinutes,
      service.isBookable,
      service.isInpatientPreferred
    ),
  });

type CatalogPackagePayload = Omit<PackageRevamp, 'id' | 'code' | 'createdAt'> &
  Partial<Pick<PackageRevamp, 'id' | 'code' | 'version'>>;

const catalogPayloadFromPackage = (pkg: CatalogPackagePayload) => {
  const totals = computePackageTotals(pkg as PackageRevamp);
  const itemDiscountAmount = pkg.breakdown.reduce(
    (sum, item) => sum + computePackageBreakdownItem(item).discountAmt,
    0
  );
  return toCatalogResponseDTO({
    id: pkg.id ?? '',
    version: pkg.version,
    organisationId: pkg.organisationId,
    name: pkg.name,
    description: pkg.description || null,
    code: pkg.code ?? null,
    kind: 'PACKAGE',
    specialityId: pkg.specialityId,
    legacyServiceId: null,
    isActive: pkg.status !== 'ARCHIVED',
    defaultPrice: {
      unitPrice: totals.totalCost,
      currency: pkg.currency ?? null,
      defaultDiscountPercent: 0,
      maxDiscountPercent: 100,
    },
    bookable: bookableFromFlags(
      parseDurationMinutes(pkg.durationText),
      pkg.isBookable,
      pkg.isInpatientPreferred
    ),
    package: {
      leadCount: pkg.leadCount,
      supportCount: pkg.supportCount,
      additionalDiscountPercent: pkg.additionalDiscount,
      grossAmount: totals.grossTotal,
      itemDiscountAmount,
      additionalDiscountAmount: totals.additionalDiscountAmt,
      breakdownItemCount: pkg.breakdown.length,
    },
    packageItems: pkg.breakdown.map((item, index) => {
      const line = computePackageBreakdownItem(item);
      return {
        id: item.id,
        packageId: pkg.id ?? '',
        childProductItemId: item.childItemId ?? item.id,
        quantity: item.quantity,
        pricingMode: 'INHERITED_PRICE',
        overridePrice: null,
        discountPercent: item.discount,
        sortOrder: index,
        isOptional: false,
        childProductCode: item.code ?? null,
        childProductName: item.name,
        childProductKind: toProductKind(item.type),
        currency: item.currency ?? null,
        unitPrice: item.unitPrice,
        grossAmount: line.gross,
        discountAmount: line.discountAmt,
        finalAmount: line.net,
      };
    }),
  });
};

const mapHealthcareService = (
  dto: HealthcareService,
  fallback: {
    organisationId: string;
    specialityId: string;
    status?: 'ACTIVE' | 'ARCHIVED';
  }
): ServiceRevamp | PackageRevamp => {
  const normal = fromCatalogRequestDTO(dto);
  const id = dto.id ?? '';
  const isPackage = normal.kind === 'PACKAGE';
  const common = {
    id,
    code: normal.code ?? '',
    name: normal.name,
    description: normal.description ?? '',
    specialityId: normal.specialityId ?? fallback.specialityId,
    organisationId: normal.organisationId || fallback.organisationId,
    currency: normal.price?.currency ?? undefined,
    status: normal.isActive === false ? 'ARCHIVED' : (fallback.status ?? 'ACTIVE'),
    createdAt: new Date().toISOString(),
  };
  if (isPackage) {
    return {
      ...common,
      durationText: formatDurationText(normal.bookable?.durationMinutes),
      isBookable: Boolean(normal.bookable?.supportsOutpatient),
      isInpatientPreferred: Boolean(normal.bookable?.supportsInpatient),
      leadCount: normal.package?.leadCount ?? 1,
      supportCount: normal.package?.supportCount ?? 0,
      additionalDiscount: normal.package?.additionalDiscountPercent ?? 0,
      breakdown: [],
    };
  }
  return {
    ...common,
    type: normalizeKind(normal.kind),
    grossAmount: normal.price?.unitPrice ?? 0,
    defaultDiscount: normal.price?.defaultDiscountPercent ?? 0,
    maxDiscount: normal.price?.maxDiscountPercent ?? 0,
    durationMinutes: normal.bookable?.durationMinutes ?? 30,
    isBookable: Boolean(normal.bookable?.supportsOutpatient),
    isInpatientPreferred: Boolean(normal.bookable?.supportsInpatient),
  };
};

type FHIRParameter = NonNullable<FHIRParameters['parameter']>[number];
type FHIRParameterPart = NonNullable<FHIRParameter['part']>[number];

const readPart = (parts: FHIRParameter['part'], name: string): FHIRParameterPart | undefined =>
  parts?.find((part) => part.name === name);

const parseSearchParameters = (dto: CatalogSearchOperationResponseDTO): CatalogSearchItem[] => {
  const itemParts = dto.parameter?.find((parameter) => parameter.name === 'items')?.part ?? [];
  return itemParts.map((entry: FHIRParameterPart): CatalogSearchItem => {
    const parts = entry.part ?? [];
    return {
      id: readPart(parts, 'id')?.valueString ?? '',
      organisationId:
        readPart(parts, 'organization')?.valueString?.replace(/^Organization\//, '') ?? '',
      specialityId: readPart(parts, 'specialty')?.valueString ?? null,
      code: readPart(parts, 'code')?.valueString ?? null,
      name: readPart(parts, 'name')?.valueString ?? '',
      description: readPart(parts, 'description')?.valueString ?? null,
      kind: (readPart(parts, 'kind')?.valueString as CatalogSearchItem['kind']) ?? 'CONSULTATION',
      source: (readPart(parts, 'source')?.valueString as CatalogSearchItem['source']) ?? 'CATALOG',
      status: (readPart(parts, 'status')?.valueString as CatalogSearchItem['status']) ?? 'ACTIVE',
      isBookable: readPart(parts, 'isBookable')?.valueBoolean ?? false,
      durationMinutes: readPart(parts, 'durationMinutes')?.valueInteger ?? null,
      unitPrice: readPart(parts, 'unitPrice')?.valueDecimal ?? 0,
      currency: readPart(parts, 'currency')?.valueString ?? null,
      defaultDiscountPercent: readPart(parts, 'defaultDiscountPercent')?.valueDecimal ?? 0,
      maxDiscountPercent: readPart(parts, 'maxDiscountPercent')?.valueDecimal ?? 0,
      totalAmount: readPart(parts, 'totalAmount')?.valueDecimal ?? 0,
      canBeAddedToPackage: readPart(parts, 'canBeAddedToPackage')?.valueBoolean ?? true,
      blockReason: readPart(parts, 'blockReason')?.valueString ?? null,
      nestedBreakdown: null,
    };
  });
};

export const catalogApi = {
  async listSpecialities(organisationId: string, status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE') {
    const res = await getData<ListResponse<SpecialityRow>>(
      `/v1/catalog/organisations/${organisationId}/specialities`,
      { status, page: 1, pageSize: 100 }
    );
    return unwrapItems(res.data).map((row) => mapSpeciality(row, organisationId));
  },

  async createSpeciality(name: string, organisationId: string) {
    const payload = toSpecialityResponseDTO({ name, organisationId, isActive: true });
    const res = await postData<Parameters<typeof fromSpecialityRequestDTO>[0]>(
      '/fhir/v1/speciality',
      payload
    );
    const normal = fromSpecialityRequestDTO(res.data);
    return mapSpeciality(
      {
        id: normal.id ?? normal._id,
        name: normal.name,
        organisationId: normal.organisationId,
        headUserId: normal.headUserId,
        teamMemberIds: normal.teamMemberIds,
      },
      organisationId
    );
  },

  async updateSpeciality(speciality: SpecialityRevamp) {
    const payload: Speciality = {
      _id: speciality.id,
      name: speciality.name,
      organisationId: speciality.organisationId,
      headUserId: speciality.headVetId,
      teamMemberIds: speciality.teamMemberIds,
      isActive: true,
    };
    const res = await putData<Parameters<typeof fromSpecialityRequestDTO>[0]>(
      `/fhir/v1/speciality/${speciality.id}`,
      toSpecialityResponseDTO(payload)
    );
    const normal = fromSpecialityRequestDTO(res.data);
    return mapSpeciality(
      {
        id: normal.id ?? normal._id,
        name: normal.name,
        organisationId: normal.organisationId,
        headUserId: normal.headUserId,
        teamMemberIds: normal.teamMemberIds,
      },
      speciality.organisationId
    );
  },

  async deleteSpeciality(organisationId: string, specialityId: string) {
    await deleteData(`/v1/catalog/organisations/${organisationId}/specialities/${specialityId}`);
  },

  async listServices(organisationId: string, specialityId: string, status = 'ACTIVE') {
    const res = await getData<ListResponse<CatalogListRow>>(
      `/v1/catalog/organisations/${organisationId}/specialities/${specialityId}/services`,
      { status, search: '' }
    );
    return unwrapItems(res.data).map((row) => mapServiceRow(row, organisationId, specialityId));
  },

  async listPackages(organisationId: string, specialityId: string, status = 'ACTIVE') {
    const res = await getData<ListResponse<CatalogListRow>>(
      `/v1/catalog/organisations/${organisationId}/specialities/${specialityId}/packages`,
      { status, search: '' }
    );
    return unwrapItems(res.data).map((row) => mapPackageRow(row, organisationId, specialityId));
  },

  async getPackageDetail(pkg: PackageRevamp) {
    const res = await getData<CatalogPackageDetail>(
      `/v1/catalog/organisations/${pkg.organisationId}/packages/${pkg.id}`
    );
    return mapPackageDetail(res.data, pkg);
  },

  async createService(draft: Omit<ServiceRevamp, 'id' | 'code' | 'createdAt'>) {
    const res = await postData<HealthcareService>(
      '/fhir/v1/healthcare-service',
      catalogPayloadFromService(draft)
    );
    return mapHealthcareService(res.data, {
      organisationId: draft.organisationId,
      specialityId: draft.specialityId,
    }) as ServiceRevamp;
  },

  async updateService(id: string, patch: Partial<ServiceRevamp>, current: ServiceRevamp) {
    const next = { ...current, ...patch };
    const res = await patchData<HealthcareService>(
      `/fhir/v1/healthcare-service/${id}`,
      catalogPayloadFromService(next),
      next.version ? { headers: { 'If-Match': String(next.version) } } : undefined
    );
    return mapHealthcareService(res.data, {
      organisationId: next.organisationId,
      specialityId: next.specialityId,
    }) as ServiceRevamp;
  },

  async archiveService(service: ServiceRevamp) {
    await postData(
      `/v1/catalog/organisations/${service.organisationId}/services/${service.id}/archive`
    );
  },

  async restoreService(service: ServiceRevamp) {
    await postData(
      `/v1/catalog/organisations/${service.organisationId}/services/${service.id}/restore`
    );
  },

  async deleteService(service: ServiceRevamp) {
    await deleteData(`/v1/catalog/organisations/${service.organisationId}/services/${service.id}`);
  },

  async createPackage(draft: Omit<PackageRevamp, 'id' | 'code' | 'createdAt'>) {
    const res = await postData<HealthcareService>(
      '/fhir/v1/healthcare-service',
      catalogPayloadFromPackage(draft)
    );
    return mapHealthcareService(res.data, {
      organisationId: draft.organisationId,
      specialityId: draft.specialityId,
    }) as PackageRevamp;
  },

  async updatePackage(id: string, patch: Partial<PackageRevamp>, current: PackageRevamp) {
    const next = { ...current, ...patch };
    const res = await patchData<HealthcareService>(
      `/fhir/v1/healthcare-service/${id}`,
      catalogPayloadFromPackage(next),
      next.version ? { headers: { 'If-Match': String(next.version) } } : undefined
    );
    return mapHealthcareService(res.data, {
      organisationId: next.organisationId,
      specialityId: next.specialityId,
    }) as PackageRevamp;
  },

  async archivePackage(pkg: PackageRevamp) {
    await postData(`/v1/catalog/organisations/${pkg.organisationId}/packages/${pkg.id}/archive`);
  },

  async restorePackage(pkg: PackageRevamp) {
    await postData(`/v1/catalog/organisations/${pkg.organisationId}/packages/${pkg.id}/restore`);
  },

  async deletePackage(pkg: PackageRevamp) {
    await deleteData(`/v1/catalog/organisations/${pkg.organisationId}/packages/${pkg.id}`);
  },

  async searchItems(input: {
    organisationId: string;
    specialityId?: string;
    q: string;
    kinds?: CatalogSearchOperationKind[];
    excludePackageId?: string;
  }) {
    const parameters: FHIRParameters = {
      resourceType: 'Parameters',
      parameter: [
        { name: 'organization', valueString: `Organization/${input.organisationId}` },
        ...(input.specialityId ? [{ name: 'specialty', valueString: input.specialityId }] : []),
        { name: 'q', valueString: input.q },
        ...(input.kinds?.length ? [{ name: 'kinds', valueString: input.kinds.join(',') }] : []),
        ...(input.excludePackageId
          ? [{ name: 'excludePackageId', valueString: input.excludePackageId }]
          : []),
        { name: 'includeNestedBreakdown', valueBoolean: true },
        { name: 'page', valueInteger: 1 },
        { name: 'pageSize', valueInteger: 25 },
      ],
    };
    const res = await postData<CatalogSearchOperationResponseDTO>(
      '/fhir/v1/healthcare-service/$search-components',
      parameters
    );
    return parseSearchParameters(res.data);
  },

  mapSearchItem(item: CatalogSearchItem): PackageBreakdownItem {
    return {
      id: crypto.randomUUID(),
      childItemId: item.id,
      code: item.code ?? undefined,
      type: normalizeKind(item.kind),
      name: item.name,
      unitPrice: item.unitPrice,
      currency: item.currency ?? undefined,
      quantity: 1,
      discount: item.defaultDiscountPercent,
      maxDiscount: item.maxDiscountPercent,
      isBookable: item.isBookable,
      isInpatientPreferred: false,
      nestedBreakdown: item.nestedBreakdown ? mapBreakdown(item.nestedBreakdown) : undefined,
    };
  },
};
