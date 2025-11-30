import {Platform} from 'react-native';
import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {API_CONFIG} from '@/config/variables';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';
import type {
  Appointment,
  AppointmentStatus,
  Invoice,
  PaymentIntentInfo,
  SlotWindow,
  VetBusiness,
  VetService,
} from '@/features/appointments/types';

const normalizeUrlForPlatform = (url: string): string => {
  if (Platform.OS !== 'android') {
    return url;
  }
  return url
    .replace('://localhost', '://10.0.2.2')
    .replace('://127.0.0.1', '://10.0.2.2')
    .replace('://0.0.0.0', '://10.0.2.2');
};

const baseUrl = normalizeUrlForPlatform(API_CONFIG.baseUrl ?? '');
const pmsBaseUrl = normalizeUrlForPlatform(API_CONFIG.pmsBaseUrl ?? API_CONFIG.baseUrl ?? '');

const buildUrl = (path: string, opts?: {usePms?: boolean}) => {
  const base = opts?.usePms ? pmsBaseUrl : baseUrl;
  const sanitizedBase = base.replace(/\/$/, '');
  const sanitizedPath = path.replace(/^\//, '');
  return `${sanitizedBase}/${sanitizedPath}`;
};

const toStatus = (status?: string): AppointmentStatus => {
  const upper = (status ?? '').toUpperCase();
  switch (upper) {
    case 'AWAITING_PAYMENT':
    case 'NO_PAYMENT':
    case 'PAID':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'RESCHEDULED':
    case 'SCHEDULED':
    case 'PAYMENT_FAILED':
      return upper as AppointmentStatus;
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return 'REQUESTED';
  }
};

const parseParticipant = (participants: any[], prefix: string) => {
  const match = participants?.find((p: any) =>
    (p?.actor?.reference ?? '').toString().startsWith(prefix),
  );
  const reference: string = match?.actor?.reference ?? '';
  const display: string | undefined = match?.actor?.display;
  const id = reference.includes('/') ? reference.split('/')[1] : reference;
  return {id: id || null, display: display ?? null};
};

const extractExtensionValue = (
  extensions: any[] | undefined,
  matcher: (ext: any) => boolean,
): any | null => {
  if (!Array.isArray(extensions)) {
    return null;
  }
  const found = extensions.find(matcher);
  return found ?? null;
};

const parseAttachments = (extensions: any[] | undefined) => {
  if (!Array.isArray(extensions)) {
    return [];
  }

  const attachmentExt = extractExtensionValue(
    extensions,
    (ext: any) =>
      ext?.url ===
      'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
  );

  if (!attachmentExt?.extension || !Array.isArray(attachmentExt.extension)) {
    return [];
  }

  const attachmentGroups = (attachmentExt.extension as any[]).reduce<Record<string, any>>(
    (acc: Record<string, any>, ext: any) => {
      const key = ext?.url ?? '';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(ext);
      return acc;
    },
    {},
  );

  // Group by index
  const grouped: Array<Record<string, any>> = [];
  const keys = Object.keys(attachmentGroups);
  keys.forEach(url => {
    attachmentGroups[url].forEach((ext: any, index: number) => {
      grouped[index] = grouped[index] ?? {};
      grouped[index][url] = ext?.valueString ?? ext?.valueUrl ?? ext?.value ?? '';
    });
  });

  return grouped
    .map((item, index) => ({
      id: item.key || `attachment-${index}`,
      name: item.name || `Attachment ${index + 1}`,
      key: item.key,
      url: item.url || item.valueUrl || buildCdnUrlFromKey(item.key) || null,
    }))
    .filter(att => att.name || att.key);
};

const parseDateParts = (start?: string | null): {date: string; time: string; endTime: string} => {
  if (!start) {
    return {date: '', time: '', endTime: ''};
  }
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) {
    return {date: '', time: '', endTime: ''};
  }
  const date = formatDateToISODate(d);
  const time = d.toISOString().slice(11, 16);
  return {date, time, endTime: ''};
};

const toBusinessCategory = (raw?: string | null): VetBusiness['category'] => {
  const normalized = (raw ?? '').toString().toUpperCase();
  switch (normalized) {
    case 'GROOMER':
      return 'groomer';
    case 'BREEDER':
      return 'breeder';
    case 'PET_CENTER':
    case 'PET CENTRE':
    case 'PET CENTERS':
      return 'pet_center';
    case 'BOARDER':
    case 'BOARDING':
      return 'boarder';
    case 'CLINIC':
      return 'clinic';
    case 'HOSPITAL':
    default:
      return 'hospital';
  }
};

const buildAddressString = (raw: any): string => {
  if (!raw) {
    return '';
  }
  if (Array.isArray(raw.line)) {
    const parts = [...raw.line];
    if (raw.city) parts.push(raw.city);
    if (raw.state) parts.push(raw.state);
    if (raw.postalCode) parts.push(raw.postalCode);
    if (raw.country) parts.push(raw.country);
    return parts.filter(Boolean).join(', ');
  }

  const parts = [
    raw.addressLine,
    raw.city,
    raw.state,
    raw.postalCode,
    raw.country,
  ].filter(Boolean);
  return parts.join(', ');
};

const CDN_BASE = 'https://d2kyjiikho62xx.cloudfront.net/';

const stripSlashes = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === '/') {
    start += 1;
  }

  while (end > start && value[end - 1] === '/') {
    end -= 1;
  }

  return value.slice(start, end);
};

const buildCdnUrlFromKey = (key?: string | null): string | null => {
  if (!key) {
    return null;
  }
  const normalizedKey = stripSlashes(key);
  const base = CDN_BASE.endsWith('/') ? CDN_BASE.slice(0, -1) : CDN_BASE;
  return `${base}/${normalizedKey}`;
};

const mapAppointmentResource = (resource: any): Appointment => {
  const participants = Array.isArray(resource?.participant) ? resource.participant : [];
  const patient = parseParticipant(participants, 'Patient/');
  const relatedPerson = parseParticipant(participants, 'RelatedPerson/');
  const practitioner = parseParticipant(participants, 'Practitioner/');
  const organisation = parseParticipant(participants, 'Organization/');

  const serviceType = Array.isArray(resource?.serviceType) ? resource.serviceType[0] : null;
  const serviceCoding = Array.isArray(serviceType?.coding) ? serviceType?.coding[0] : null;
  const speciality = Array.isArray(resource?.speciality) ? resource.speciality[0] : null;
  const specialityCoding = Array.isArray(speciality?.coding) ? speciality?.coding[0] : null;

  const {date, time} = parseDateParts(resource?.start);
  const endTime = resource?.end ? new Date(resource.end).toISOString().slice(11, 16) : null;

  const emergencyExt = extractExtensionValue(
    resource?.extension,
    (ext: any) =>
      ext?.url ===
      'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency',
  );
  const speciesExt = extractExtensionValue(
    resource?.extension,
    (ext: any) =>
      ext?.id === 'species' || ext?.url === 'http://hl7.org/fhir/animal-species',
  );
  const breedExt = extractExtensionValue(
    resource?.extension,
    (ext: any) => ext?.id === 'breed' || ext?.url === 'http://hl7.org/fhir/animal-breed',
  );

  return {
    id: resource?.id ?? resource?._id ?? '',
    companionId: patient.id ?? '',
    businessId: organisation.id ?? '',
    serviceId: serviceCoding?.code ?? null,
    serviceName: serviceCoding?.display ?? serviceType?.text ?? null,
    serviceCode: serviceCoding?.code ?? null,
    specialityId: specialityCoding?.code ?? null,
    employeeId: practitioner.id,
    employeeName: practitioner.display,
    date,
    time,
    endTime,
    start: resource?.start ?? null,
    end: resource?.end ?? null,
    type: specialityCoding?.display ?? speciality?.text ?? serviceType?.text ?? 'General',
    concern: resource?.description ?? '',
    emergency: emergencyExt?.valueBoolean ?? false,
    species: speciesExt?.valueString ?? null,
    breed: breedExt?.valueString ?? null,
    uploadedFiles: parseAttachments(resource?.extension),
    status: toStatus(resource?.status),
    invoiceId: resource?.invoiceId ?? null,
    organisationName: organisation.display ?? null,
    organisationAddress: buildAddressString(resource?.location?.address ?? {}),
    createdAt:
      resource?.createdAt ??
      resource?.meta?.lastUpdated ??
      resource?.start ??
      new Date().toISOString(),
    updatedAt:
      resource?.updatedAt ??
      resource?.meta?.lastUpdated ??
      resource?.start ??
      new Date().toISOString(),
  };
};

const mapInvoiceFromApi = (
  raw: any,
): {invoice: Invoice | null; paymentIntent?: PaymentIntentInfo | null} => {
  if (!raw) {
    return {invoice: null, paymentIntent: null};
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems: Array<{
    description: string;
    rate: number;
    qty: number;
    lineTotal: number;
  }> =
    items.length > 0
      ? items.map((item: any) => {
          const qty = item.quantity ?? item.qty ?? 1;
          const rate = item.unitPrice ?? item.rate ?? item.total ?? 0;
          const total = item.total ?? rate * qty;
          return {
            description: item.description ?? item.name ?? 'Line item',
            rate,
            qty,
            lineTotal: total,
          };
        })
      : [];

  const subtotal =
    raw.subtotal ??
    normalizedItems.reduce((sum: number, item) => sum + (item.lineTotal ?? 0), 0) ??
    0;
  const total = raw.totalAmount ?? raw.total ?? subtotal;

  const paymentIntent = raw.paymentIntent
    ? {
        paymentIntentId: raw.paymentIntent.paymentIntentId ?? raw.paymentIntent.id,
        clientSecret: raw.paymentIntent.clientSecret,
        amount: raw.paymentIntent.amount,
        currency: raw.paymentIntent.currency ?? raw.currency ?? 'USD',
        paymentLinkUrl: raw.paymentIntent.paymentLinkUrl ?? null,
      }
    : null;

  const invoiceCreatedAt: string | undefined =
    raw.invoiceDate ?? raw.createdAt ?? raw.paymentIntent?.createdAt;
  const dueTill =
    invoiceCreatedAt != null
      ? new Date(new Date(invoiceCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : raw.dueDate;

  const invoice: Invoice = {
    id: raw.id ?? raw._id ?? raw.invoiceId ?? `invoice-${Date.now()}`,
    appointmentId: raw.appointmentId ?? '',
    items: normalizedItems,
    subtotal,
    discountPercent: raw.discountPercent ?? null,
    taxPercent: raw.taxPercent ?? null,
    total,
    currency: raw.currency ?? paymentIntent?.currency ?? 'USD',
    dueDate: dueTill,
    invoiceNumber: raw.invoiceNumber ?? raw.invoiceNo ?? raw.number,
    invoiceDate: invoiceCreatedAt,
    billedToName: raw.billedToName,
    billedToEmail: raw.billedToEmail,
    status: raw.status,
    stripePaymentIntentId: raw.stripePaymentIntentId ?? null,
    stripeInvoiceId: raw.stripeInvoiceId ?? null,
    stripePaymentLinkId: raw.stripePaymentLinkId ?? null,
    paymentIntent,
    downloadUrl: raw.invoiceUrl ?? raw.downloadUrl ?? null,
  };

  return {invoice, paymentIntent};
};

const mapBusinessFromApi = (
  raw: any,
): {business: VetBusiness; services: VetService[]} => {
  const org = raw?.org ?? raw; // handle wrapper {org, distanceInMeters, specialitiesWithServices}
  const distanceMeters =
    raw?.distanceInMeters ?? raw?.distance ?? org?.distanceInMeters ?? 0;
  const id = org?.id ?? org?._id ?? '';
  const category = toBusinessCategory(
    org?.type?.[0]?.coding?.[0]?.code ??
      org?.type?.[0]?.coding?.[0]?.display ??
      org?.type ??
      org?.organisationType ??
      org?.typeCode,
  );
  const addressObj = Array.isArray(org?.address) ? org.address[0] : org?.address;
  const distanceMi = distanceMeters != null ? distanceMeters / 1609.344 : undefined;
  const photo =
    org?.imageURL ??
    org?.imageUrl ??
    org?.logoUrl ??
    org?.photo ??
    org?.extension?.find?.(
      (ext: any) =>
        ext?.url === 'http://example.org/fhir/StructureDefinition/organisation-image',
    )?.valueUrl ??
    org?.extension?.find?.(
      (ext: any) =>
        ext?.url === 'http://example.org/fhir/StructureDefinition/organisation-image',
    )?.valueUrl;

  const specialities =
    raw?.specialitiesWithServices ??
    org?.specialitiesWithServices ??
    org?.specialities ??
    org?.specialties ??
    org?.specialty ??
    [];

  const services: VetService[] = [];
  specialities.forEach((spec: any) => {
    const specName = spec?.name ?? spec?.text ?? spec?.coding?.[0]?.display;
    const specId = spec?._id ?? spec?.id ?? spec?.coding?.[0]?.code;
    if (Array.isArray(spec?.services)) {
      spec.services.forEach((svc: any) => {
        services.push({
          id: svc?._id ?? svc?.id ?? `${id}-${specId}-${svc?.name ?? 'service'}`,
          businessId: id,
          specialty: specName ?? '',
          specialityId: specId ?? null,
          name: svc?.name ?? svc?.display ?? 'Service',
          description: svc?.description,
          basePrice: svc?.cost ?? svc?.price ?? undefined,
          currency: svc?.currency,
          defaultEmployeeId: undefined,
        });
      });
    }
  });

  const addressString = buildAddressString(addressObj ?? {});

  const business: VetBusiness = {
    id,
    name: org?.name ?? 'Business',
    category,
    address: addressString,
    distanceMi,
    distanceMeters,
    rating:
      org?.rating ??
      raw?.rating ??
      (typeof distanceMeters === 'number' ? 0 : undefined),
    openHours: org?.openHours,
    photo,
    specialties: specialities
      .map((spec: any) => spec?.name ?? spec?.text ?? spec?.coding?.[0]?.display)
      .filter(Boolean),
    website: org?.telecom?.find?.((t: any) => t?.system === 'url')?.value ?? org?.website ?? undefined,
    description: org?.description ?? undefined,
    phone:
      org?.phoneNo ??
      org?.phone ??
      org?.telecom?.find?.((t: any) => t?.system === 'phone')?.value,
    email: org?.email,
    lat: addressObj?.latitude ?? addressObj?.location?.coordinates?.[1],
    lng: addressObj?.longitude ?? addressObj?.location?.coordinates?.[0],
  };

  return {business, services};
};

export const appointmentApi = {
  async listAppointments({
    companionId,
    accessToken,
  }: {
    companionId: string;
    accessToken: string;
  }): Promise<Appointment[]> {
    const url = buildUrl(`/fhir/v1/appointment/mobile/companion/${encodeURIComponent(companionId)}`);
    const {data} = await apiClient.get(url, {headers: withAuthHeaders(accessToken)});
    const collection = Array.isArray(data?.data) ? data.data : [];
    return collection.map(mapAppointmentResource);
  },

  async getAppointment({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<Appointment> {
    const url = buildUrl(`/fhir/v1/appointment/mobile/${encodeURIComponent(appointmentId)}`);
    const {data} = await apiClient.get(url, {headers: withAuthHeaders(accessToken)});
    const resource = data?.data ?? data;
    return mapAppointmentResource(resource);
  },

  async fetchNearbyBusinesses({
    lat,
    lng,
    page = 1,
    accessToken,
  }: {
    lat: number;
    lng: number;
    page?: number;
    accessToken?: string;
  }): Promise<{businesses: VetBusiness[]; services: VetService[]; meta?: any}> {
    const url = buildUrl(
      `/fhir/v1/organization/getNearby?lat=${lat}&lng=${lng}&page=${page}`,
    );
    const config = accessToken ? {headers: withAuthHeaders(accessToken)} : undefined;
    const {data} = await apiClient.get(url, config);
    const items = Array.isArray(data?.data) ? data.data : [];
    const mapped: Array<{business: VetBusiness; services: VetService[]}> =
      items.map(mapBusinessFromApi);
    return {
      businesses: mapped.map(m => m.business),
      services: mapped.flatMap(m => m.services),
      meta: data?.meta,
    };
  },

  async searchBusinessesByService({
    serviceName,
    lat,
    lng,
    accessToken,
  }: {
    serviceName: string;
    lat: number;
    lng: number;
    accessToken?: string;
  }): Promise<{businesses: VetBusiness[]; services: VetService[]}> {
    const url = buildUrl(
      `/fhir/v1/service/organisation/search?serviceName=${encodeURIComponent(
        serviceName,
      )}&lat=${lat}&lng=${lng}`,
    );
    const config = accessToken ? {headers: withAuthHeaders(accessToken)} : undefined;
    const {data} = await apiClient.get(url, config);
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const mapped: Array<{business: VetBusiness; services: VetService[]}> =
      items.map(mapBusinessFromApi);
    return {
      businesses: mapped.map(m => m.business),
      services: mapped.flatMap(m => m.services),
    };
  },

  async fetchBookableSlots({
    serviceId,
    organisationId,
    date,
    accessToken,
  }: {
    serviceId: string;
    organisationId: string;
    date: string;
    accessToken?: string;
  }): Promise<{date: string; windows: SlotWindow[]}> {
    const url = buildUrl('/fhir/v1/service/bookable-slots');
    const config = accessToken ? {headers: withAuthHeaders(accessToken)} : undefined;
    const {data} = await apiClient.post(url, {serviceId, organisationId, date}, config);
    const payload = data?.data ?? data ?? {};
    return {
      date: payload?.date ?? date,
      windows: Array.isArray(payload?.windows) ? payload.windows : [],
    };
  },

  async bookAppointment({
    payload,
    accessToken,
  }: {
    payload: any;
    accessToken: string;
  }): Promise<{appointment: Appointment; invoice: Invoice | null; paymentIntent: PaymentIntentInfo | null}> {
    const url = buildUrl('/fhir/v1/appointment/mobile/', {usePms: true});
    const {data} = await apiClient.post(url, payload, {
      headers: withAuthHeaders(accessToken),
    });
    const resp = data?.data ?? data;
    const mappedAppointment = mapAppointmentResource(resp?.appointment ?? resp);
    const {invoice, paymentIntent} = mapInvoiceFromApi(resp?.invoice ?? null);
    const intent =
      paymentIntent ??
      (resp?.paymentIntent
        ? {
            paymentIntentId: resp.paymentIntent.paymentIntentId ?? resp.paymentIntent.id,
            clientSecret: resp.paymentIntent.clientSecret,
            amount: resp.paymentIntent.amount,
            currency: resp.paymentIntent.currency ?? invoice?.currency ?? 'USD',
            paymentLinkUrl: resp.paymentIntent.paymentLinkUrl ?? null,
          }
        : null);

    return {appointment: mappedAppointment, invoice, paymentIntent: intent};
  },

  async rescheduleAppointment({
    appointmentId,
    startTime,
    endTime,
    isEmergency,
    concern,
    accessToken,
  }: {
    appointmentId: string;
    startTime: string;
    endTime: string;
    isEmergency: boolean;
    concern: string;
    accessToken: string;
  }): Promise<Appointment> {
    const url = buildUrl(
      `/fhir/v1/appointment/mobile/${encodeURIComponent(appointmentId)}/reschedule`,
    );
    const {data} = await apiClient.patch(
      url,
      {
        startTime,
        endTime,
        isEmergency,
        concern,
      },
      {headers: withAuthHeaders(accessToken)},
    );
    const resource = data?.data ?? data;
    return mapAppointmentResource(resource);
  },

  async cancelAppointment({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<Appointment> {
    const url = buildUrl(
      `/fhir/v1/appointment/mobile/${encodeURIComponent(appointmentId)}/cancel`,
      {usePms: true},
    );
    const {data} = await apiClient.get(url, {headers: withAuthHeaders(accessToken)});
    const resource = data?.data ?? data;
    return mapAppointmentResource(resource);
  },

  async rateOrganisation({
    organisationId,
    rating,
    review,
    accessToken,
  }: {
    organisationId: string;
    rating: number;
    review: string;
    accessToken: string;
  }) {
    const url = buildUrl(`/v1/organisation-rating/${encodeURIComponent(organisationId)}`);
    const {data} = await apiClient.post(
      url,
      {rating, review},
      {headers: withAuthHeaders(accessToken)},
    );
    return data;
  },
};

export const mapInvoiceFromResponse = mapInvoiceFromApi;
export const mapAppointmentFromResponse = mapAppointmentResource;
export const mapBusinessFromResponse = mapBusinessFromApi;
