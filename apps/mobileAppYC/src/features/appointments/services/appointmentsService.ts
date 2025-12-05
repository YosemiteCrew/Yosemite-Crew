import {Platform} from 'react-native';
import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {API_CONFIG} from '@/config/variables';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';
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
    .replaceAll('://localhost', '://10.0.2.2')
    .replaceAll('://127.0.0.1', '://10.0.2.2')
    .replaceAll('://0.0.0.0', '://10.0.2.2');
};

const baseUrl = normalizeUrlForPlatform(API_CONFIG.baseUrl ?? '');
const pmsBaseUrl = normalizeUrlForPlatform(API_CONFIG.pmsBaseUrl ?? API_CONFIG.baseUrl ?? '');

const buildUrl = (path: string, opts?: {usePms?: boolean}) => {
  const base = opts?.usePms ? pmsBaseUrl : baseUrl;
  const sanitizedBase = base.replaceAll(/\/$/, '');
  const sanitizedPath = path.replaceAll(/^\//, '');
  return `${sanitizedBase}/${sanitizedPath}`;
};

const toStatus = (status?: string): AppointmentStatus => {
  const upper = (status ?? '').toUpperCase();
  const normalized = upper.replaceAll(/\s+/g, '_');
  switch (normalized) {
    case 'AWAITING_PAYMENT':
    case 'NO_PAYMENT':
    case 'PAID':
    case 'UPCOMING':
    case 'CHECKED_IN':
    case 'IN_PROGRESS':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'RESCHEDULED':
    case 'SCHEDULED':
    case 'PAYMENT_FAILED':
      return normalized as AppointmentStatus;
    case 'ARRIVED':
      return 'CHECKED_IN';
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
  const avatar =
    match?.extension?.find?.(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/lead-profile-url',
    )?.valueString ?? null;
  return {id: id || null, display: display ?? null, avatar};
};

const extractExtensionValue = (
  extensions: any[] | undefined,
  matcher: (ext: any) => boolean,
): Record<string, any> | null => {
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

  const attachmentGroups = attachmentExt.extension.reduce<Record<string, any>>(
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
      type: item.contentType ?? null,
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
    case 'BOARDER':
    case 'BOARDING':
      return 'boarder';
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

const extractArrayFromResponse = (data: any): any[] => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
};

const parseParticipantDetails = (participants: any[]) => {
  const patient = parseParticipant(participants, 'Patient/');
  const practitionerEntry = participants?.find?.((p: any) =>
    (p?.actor?.reference ?? '').toString().startsWith('Practitioner/'),
  );
  const practitioner = parseParticipant(participants, 'Practitioner/');
  const practitionerRole =
    practitionerEntry?.type?.[0]?.coding?.[0]?.display ??
    practitionerEntry?.type?.[0]?.text ??
    null;
  const organisation = parseParticipant(participants, 'Organization/');
  return {patient, practitioner, practitionerRole, organisation};
};

const extractServiceDetails = (resource: any) => {
  const serviceType = Array.isArray(resource?.serviceType) ? resource.serviceType[0] : null;
  const serviceCoding = Array.isArray(serviceType?.coding) ? serviceType?.coding[0] : null;
  const speciality = Array.isArray(resource?.speciality) ? resource.speciality[0] : null;
  const specialityCoding = Array.isArray(speciality?.coding) ? speciality?.coding[0] : null;
  return {serviceType, serviceCoding, speciality, specialityCoding};
};

const extractExtensionDetails = (extensions: any[] | undefined) => {
  const emergencyExt = extractExtensionValue(
    extensions,
    (ext: any) =>
      ext?.url ===
      'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency',
  );
  const speciesExt = extractExtensionValue(
    extensions,
    (ext: any) =>
      ext?.id === 'species' || ext?.url === 'https://hl7.org/fhir/animal-species',
  );
  const breedExt = extractExtensionValue(
    extensions,
    (ext: any) => ext?.id === 'breed' || ext?.url === 'https://hl7.org/fhir/animal-breed',
  );
  const uploadedFiles = parseAttachments(extensions);
  return {emergencyExt, speciesExt, breedExt, uploadedFiles};
};

const resolveOrganisationAddress = (org: any, locationAddressObj: any) => {
  const locationAddress = buildAddressString(locationAddressObj ?? {});
  const orgAddress = buildAddressString(org?.address);
  const organisationAddress = locationAddress?.trim?.().length ? locationAddress : orgAddress;
  const addressObj =
    (Array.isArray(org?.address) ? org.address.at(0) : org?.address) ??
    locationAddressObj ??
    {};
  return {organisationAddress, addressObj};
};

const extractEndTime = (end?: string | null) =>
  end ? new Date(end).toISOString().slice(11, 16) : null;

const resolveBusinessCoordinates = (addressObj: any) => ({
  businessLat: addressObj?.latitude ?? addressObj?.location?.coordinates?.[1] ?? null,
  businessLng: addressObj?.longitude ?? addressObj?.location?.coordinates?.[0] ?? null,
});

const resolveAuditTimestamps = (resource: any) => {
  const createdAt =
    resource?.createdAt ??
    resource?.meta?.lastUpdated ??
    resource?.start ??
    new Date().toISOString();
  const updatedAt =
    resource?.updatedAt ??
    resource?.meta?.lastUpdated ??
    resource?.start ??
    new Date().toISOString();
  return {createdAt, updatedAt};
};

const mapAppointmentResource = (incoming: any): Appointment => {
  const resource = incoming?.appointment ?? incoming;
  const org = incoming?.organisation ?? incoming?.organization;
  const participants = Array.isArray(resource?.participant) ? resource.participant : [];
  const {patient, practitioner, practitionerRole, organisation} = parseParticipantDetails(participants);
  const {serviceType, serviceCoding, speciality, specialityCoding} = extractServiceDetails(resource);

  const {date, time} = parseDateParts(resource?.start);
  const endTime = extractEndTime(resource?.end);
  const {emergencyExt, speciesExt, breedExt, uploadedFiles} = extractExtensionDetails(resource?.extension);
  const {organisationAddress, addressObj} = resolveOrganisationAddress(org, resource?.location?.address);
  const {businessLat, businessLng} = resolveBusinessCoordinates(addressObj);
  const {createdAt, updatedAt} = resolveAuditTimestamps(resource);

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
    employeeAvatar: practitioner.avatar,
    employeeTitle: practitionerRole,
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
    uploadedFiles,
    status: toStatus(resource?.status),
    invoiceId: resource?.invoiceId ?? null,
    organisationName: organisation.display ?? org?.name ?? null,
    organisationAddress,
    businessLat,
    businessLng,
    businessPhoto: org?.imageURL ?? org?.imageUrl ?? org?.logoUrl ?? null,
    businessGooglePlacesId: org?.googlePlacesId ?? org?.placeId ?? null,
    createdAt,
    updatedAt,
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

  const extensions = Array.isArray(raw.extension) ? raw.extension : [];
  const paymentIntentIdFromExt =
    extensions.find(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id',
    )?.valueString ??
    raw.stripePaymentIntentId ??
    raw.paymentIntentId ??
    null;

  let paymentIntent: PaymentIntentInfo | null = null;
  if (raw.paymentIntent) {
    paymentIntent = {
      paymentIntentId: raw.paymentIntent.paymentIntentId ?? raw.paymentIntent.id,
      clientSecret: raw.paymentIntent.clientSecret,
      amount: raw.paymentIntent.amount,
      currency: raw.paymentIntent.currency ?? raw.currency ?? 'USD',
      paymentLinkUrl: raw.paymentIntent.paymentLinkUrl ?? null,
    };
  } else if (paymentIntentIdFromExt) {
    paymentIntent = {
      paymentIntentId: paymentIntentIdFromExt,
      clientSecret:
        raw.paymentIntent?.clientSecret ??
        raw.clientSecret ??
        raw.paymentIntentClientSecret ??
        '',
      amount: raw.paymentIntent?.amount ?? total,
      currency: raw.paymentIntent?.currency ?? raw.currency ?? 'USD',
      paymentLinkUrl: raw.paymentIntent?.paymentLinkUrl ?? null,
    };
  }

  const invoiceCreatedAt: string | undefined =
    raw.invoiceDate ?? raw.createdAt ?? raw.paymentIntent?.createdAt ?? raw.date;
  const dueTill = invoiceCreatedAt
    ? new Date(new Date(invoiceCreatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : raw.dueDate;

  const receiptUrl =
    extensions.find(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-receipt-url',
    )?.valueUri ?? raw.invoiceUrl ?? raw.downloadUrl ?? null;
  const appointmentFromExt =
    extensions.find(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id',
    )?.valueString;
  const appointmentFromAccount =
    typeof raw?.account?.reference === 'string' &&
    raw.account.reference.includes('Appointment/')
      ? raw.account.reference.split('/').pop()
      : null;
  const statusFromExt =
    extensions.find(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status',
    )?.valueString;
  const refundMetadata = extensions.find(
    (ext: any) =>
      ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/invoice-metadata',
  );
  const refundId =
    refundMetadata?.extension?.find?.((ext: any) => ext?.url === 'refundId')?.valueString ??
    null;
  const refundAmount =
    refundMetadata?.extension?.find?.((ext: any) => ext?.url === 'amount')?.valueDecimal ??
    null;
  const refundDate =
    refundMetadata?.extension?.find?.((ext: any) => ext?.url === 'refundDate')?.valueString ??
    null;
  const refundReason =
    refundMetadata?.extension?.find?.((ext: any) => ext?.url === 'cancellationReason')?.valueString ??
    null;
  const totalPriceComponents = Array.isArray(raw.totalPriceComponent)
    ? raw.totalPriceComponent
    : [];
  const subtotalFromTotals = totalPriceComponents.find((pc: any) => pc?.type === 'base')?.amount
    ?.value;
  const grandTotalFromTotals = totalPriceComponents.find(
    (pc: any) => pc?.code?.text === 'grand-total' || pc?.type === 'informational',
  )?.amount?.value;
  const normalizedPriceComponents = totalPriceComponents.map((pc: any) => ({
    type: pc?.type ?? pc?.Type ?? pc?.name,
    amount: pc?.amount ?? pc?.Amount,
    code: pc?.code ?? pc?.Code,
    factor: pc?.factor ?? pc?.Factor ?? null,
  }));

  const invoice: Invoice = {
    id: raw.id ?? raw._id ?? raw.invoiceId ?? `invoice-${Date.now()}`,
    appointmentId: appointmentFromExt ?? appointmentFromAccount ?? raw.appointmentId ?? '',
    items: normalizedItems,
    subtotal: subtotalFromTotals ?? subtotal,
    discountPercent: raw.discountPercent ?? null,
    taxPercent: raw.taxPercent ?? null,
    total: grandTotalFromTotals ?? total,
    totalPriceComponent: normalizedPriceComponents,
    currency: raw.currency ?? paymentIntent?.currency ?? 'USD',
    dueDate: dueTill,
    invoiceNumber: raw.invoiceNumber ?? raw.invoiceNo ?? raw.number,
    invoiceDate: invoiceCreatedAt,
    billedToName: raw.billedToName,
    billedToEmail: raw.billedToEmail,
    status: statusFromExt ?? raw.status,
    stripePaymentIntentId: raw.stripePaymentIntentId ?? null,
    stripeInvoiceId: raw.stripeInvoiceId ?? null,
    stripePaymentLinkId: raw.stripePaymentLinkId ?? null,
    paymentIntent,
    downloadUrl: receiptUrl,
    refundId,
    refundAmount,
    refundDate,
    refundStatus: statusFromExt ?? raw.status,
    refundReason,
    refundReceiptUrl: receiptUrl,
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
  const addressObj = Array.isArray(org?.address) ? org.address.at(0) : org?.address;
  const distanceMi = distanceMeters ? distanceMeters / 1609.344 : undefined;
  const photo =
    org?.imageURL ??
    org?.imageUrl ??
    org?.logoUrl ??
    org?.photo ??
    org?.extension?.find?.(
      (ext: any) =>
        ext?.url === 'https://example.org/fhir/StructureDefinition/organisation-image',
    )?.valueUrl ??
    org?.extension?.find?.(
      (ext: any) =>
        ext?.url === 'https://example.org/fhir/StructureDefinition/organisation-image',
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
    googlePlacesId: org?.googlePlacesId ?? org?.placeId ?? org?.googlePlaceId ?? null,
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

  async checkInAppointment({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<Appointment> {
    const url = buildUrl(
      `/fhir/v1/appointment/mobile/${encodeURIComponent(appointmentId)}/checkin`,
    );
    const {data} = await apiClient.patch(url, undefined, {
      headers: withAuthHeaders(accessToken),
    });
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
    const items = extractArrayFromResponse(data);
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
      {usePms: true},
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

  async fetchInvoiceForAppointment({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<{invoice: Invoice | null; paymentIntent?: PaymentIntentInfo | null}> {
    const url = buildUrl(
      `/fhir/v1/invoice/mobile/appointment/${encodeURIComponent(appointmentId)}`,
      {usePms: true},
    );
    const {data} = await apiClient.get(url, {headers: withAuthHeaders(accessToken)});
    let collection: any[] = [];
    if (Array.isArray(data?.data)) {
      collection = data.data;
    } else if (Array.isArray(data)) {
      collection = data;
    }
    const raw = collection[0] ?? null;
    if (!raw) return {invoice: null, paymentIntent: undefined};
    const base = mapInvoiceFromApi(raw);
    const stripeReceipt =
      raw?.extension?.find?.(
        (ext: any) =>
          ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-receipt-url',
      )?.valueUri ?? null;
    const appointmentExt =
      raw?.extension?.find?.(
        (ext: any) =>
          ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id',
      )?.valueString ?? appointmentId;
    const statusExt =
      raw?.extension?.find?.(
        (ext: any) =>
          ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/pms-invoice-status',
      )?.valueString;

    return {
      invoice: base.invoice
        ? {
            ...base.invoice,
            id: raw.id ?? base.invoice.id,
            appointmentId: appointmentExt ?? appointmentId,
            invoiceDate: raw.date ?? base.invoice.invoiceDate,
            status: statusExt ?? base.invoice.status,
            downloadUrl: base.invoice.downloadUrl ?? stripeReceipt,
          }
        : null,
      paymentIntent: base.paymentIntent,
    };
  },

  async createPaymentIntent({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<PaymentIntentInfo> {
    const url = buildUrl(`/v1/stripe/payment-intent/${encodeURIComponent(appointmentId)}`);
    const {data} = await apiClient.post(url, undefined, {headers: withAuthHeaders(accessToken)});
    const payload = data?.data ?? data ?? {};
    return {
      paymentIntentId: payload.paymentIntentId ?? payload.id ?? `pi-${appointmentId}`,
      clientSecret: payload.clientSecret,
      amount: payload.amount,
      currency: payload.currency ?? 'USD',
      paymentLinkUrl: payload.paymentLinkUrl ?? null,
    };
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
    const {data} = await apiClient.patch(url, undefined, {
      headers: withAuthHeaders(accessToken),
    });
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

  async getOrganisationRatingStatus({
    organisationId,
    accessToken,
  }: {
    organisationId: string;
    accessToken: string;
  }): Promise<{isRated: boolean; rating?: number | null; review?: string | null}> {
    const url = buildUrl(`/v1/organisation-rating/${encodeURIComponent(organisationId)}/is-rated`);
    const {data} = await apiClient.get(url, {headers: withAuthHeaders(accessToken)});
    const payload = data?.data ?? data ?? {};
    const base = payload?.hasRated ?? payload ?? {};
    return {
      isRated: Boolean(base.isRated),
      rating: base.rating ?? null,
      review: base.review ?? null,
    };
  },
};

export const mapInvoiceFromResponse = mapInvoiceFromApi;
export const mapAppointmentFromResponse = mapAppointmentResource;
export const mapBusinessFromResponse = mapBusinessFromApi;
