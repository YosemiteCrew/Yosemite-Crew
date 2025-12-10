import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '@/shared/utils/serviceHelpers';
import type {User} from '@/features/auth';
import type {Companion} from '@/features/companion';
import {documentApi} from '@/features/documents/services/documentService';
import type {DocumentFile} from '@/features/documents/types';
import {
  type AdverseEventDestinations,
  type AdverseEventProductInfo,
  type ReporterType,
} from '@/features/adverseEventReporting/types';
import {capitalize} from '@/shared/utils/commonHelpers';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const resolveFileUrl = (file?: DocumentFile | null) =>
  file?.downloadUrl ?? file?.viewUrl ?? file?.s3Url ?? null;

const mapAdministrationRoute = (method: AdverseEventProductInfo['administrationMethod']): string => {
  if (!method) {
    return '';
  }
  switch (method) {
    case 'by mouth':
      return 'By mouth';
    case 'on the skin':
      return 'On skin';
    case 'subcutaneous injection':
      return 'Subcutaneous injection';
    case 'intramuscular injection':
      return 'Intramuscular injection';
    case 'into the ear':
      return 'Into the ear';
    case 'into the eye':
      return 'Into the eye';
    case 'other':
      return 'Other';
    case 'none':
    default:
      return 'None';
  }
};

const mapReporter = (user: User, reporterType: ReporterType) => ({
  userId: user.parentId ?? user.id,
  type: reporterType === 'guardian' ? 'GUARDIAN' : 'PARENT',
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  phoneNumber: user.phone ?? '',
  email: user.email ?? '',
  dateOfBirth: user.dateOfBirth ?? '',
  addressLine: user.address?.addressLine ?? '',
  city: user.address?.city ?? '',
  state: user.address?.stateProvince ?? '',
  postalCode: user.address?.postalCode ?? '',
  country: user.address?.country ?? '',
  currency: user.currency ?? 'USD',
});

const mapCompanion = (companion: Companion) => ({
  companionId: companion.id,
  name: companion.name,
  breed: companion.breed?.breedName ?? '',
  dateOfBirth: companion.dateOfBirth ?? '',
  gender: capitalize(companion.gender),
  currentWeight:
    typeof companion.currentWeight === 'number' && Number.isFinite(companion.currentWeight)
      ? `${companion.currentWeight} kg`
      : '',
  color: companion.color ?? '',
  neuteredStatus: capitalize(companion.neuteredStatus),
  insured: (() => {
    if (!companion.insuredStatus) {
      return '';
    }
    return companion.insuredStatus === 'insured' ? 'Yes' : 'No';
  })(),
});

const mapDosageForm = (unit: AdverseEventProductInfo['quantityUnit']) =>
  unit === 'liquid' ? 'Liquid - ML' : 'Tablet - Piece';

const parsePositiveNumber = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Enter a valid ${label} before submitting.`);
  }
  return parsed;
};

const uploadPrimaryProductImage = async ({
  files,
  companionId,
  accessToken,
}: {
  files: DocumentFile[];
  companionId: string;
  accessToken: string;
}): Promise<{url: string; files: DocumentFile[]}> => {
  if (!files?.length) {
    throw new Error('Please add an image of the product before submitting.');
  }

  const [primary, ...rest] = files;
  if (primary.status && primary.status !== 'ready') {
    throw new Error('Product image is still preparing. Please wait a moment and try again.');
  }
  const existingUrl = resolveFileUrl(primary);
  if (existingUrl) {
    return {url: existingUrl, files};
  }

  const uploaded = await documentApi.uploadAttachment({
    file: primary,
    companionId,
    accessToken,
  });

  const uploadedUrl = resolveFileUrl(uploaded);
  if (!uploadedUrl) {
    throw new Error('Failed to upload the product image. Please try again.');
  }

  return {url: uploadedUrl, files: [uploaded, ...rest]};
};

export interface SubmitAdverseEventParams {
  organisationId: string;
  reporterType: ReporterType;
  reporter: User;
  companion: Companion;
  product: AdverseEventProductInfo;
  destinations: AdverseEventDestinations;
  consentToContact: boolean;
}

export const adverseEventService = {
  async submitReport(
    params: SubmitAdverseEventParams,
  ): Promise<{data: any; productFiles: DocumentFile[]}> {
    if (!params.organisationId) {
      throw new Error('Select a linked hospital to continue.');
    }
    if (!params.reporter?.id) {
      throw new Error('Missing reporter information. Please sign in again.');
    }

    const {accessToken} = await ensureAccessContext();
    const {url: productImageUrl, files} = await uploadPrimaryProductImage({
      files: params.product.files,
      companionId: params.companion.id,
      accessToken,
    });

    const payload = {
      organisationId: params.organisationId,
      reporter: mapReporter(params.reporter, params.reporterType),
      companion: mapCompanion(params.companion),
      product: {
        productName: params.product.productName.trim(),
        brandName: params.product.brandName.trim(),
        manufacturingCountry: params.product.manufacturingCountry?.name ?? '',
        batchNumber: params.product.batchNumber.trim(),
        numberOfTimesUsed: parsePositiveNumber(
          params.product.frequencyUsed,
          'usage frequency',
        ),
        quantityUsed: parsePositiveNumber(
          params.product.quantityUsed,
          'quantity used',
        ),
        dosageForm: mapDosageForm(params.product.quantityUnit),
        administrationRoute: mapAdministrationRoute(
          params.product.administrationMethod,
        ),
        reasonToUse: params.product.reasonToUseProduct.trim(),
        conditionBefore: params.product.petConditionBefore.trim(),
        conditionAfter: params.product.petConditionAfter.trim(),
        eventDate: formatDate(params.product.eventDate),
        productImageUrl,
      },
      destinations: params.destinations,
      consent: {
        agreedToContact: params.consentToContact,
      },
    };

    try {
      const {data} = await apiClient.post('/v1/adverse-event/', payload, {
        headers: withAuthHeaders(accessToken),
      });
      return {data, productFiles: files};
    } catch (error) {
      throw new Error(
        toErrorMessage(error, 'Failed to submit adverse event report.'),
      );
    }
  },

  async fetchRegulatoryAuthority({
    country,
    iso2,
    iso3,
  }: {
    country?: string | null;
    iso2?: string | null;
    iso3?: string | null;
  }) {
    const {accessToken} = await ensureAccessContext();
    const params = new URLSearchParams();
    if (country) params.append('country', country);
    if (iso2) params.append('iso2', iso2);
    if (iso3) params.append('iso3', iso3);
    const query = params.toString();
    const url = `/v1/adverse-event/regulatory-authority${
      query ? `?${query}` : ''
    }`;

    try {
      const {data} = await apiClient.get(url, {
        headers: withAuthHeaders(accessToken),
      });
      return data;
    } catch (error) {
      throw new Error(
        toErrorMessage(
          error,
          'Failed to fetch regulatory authority contact details.',
        ),
      );
    }
  },
};
