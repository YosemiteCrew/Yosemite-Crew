import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {
  Address as FhirAddress,
  ContactPoint,
  Extension,
  RelatedPerson,
} from '@yosemite-crew/fhirtypes';
import {isAxiosError} from 'axios';

export interface ProfileStatusRequest {
  accessToken: string;
  userId?: string;
  parentId?: string;
}

export type ProfileStatusSource = 'remote' | 'fallback' | 'mock';

export interface ParentProfileSummary {
  id: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  phoneNumber?: string;
  birthDate?: string;
  address?: AddressDTOAttributes;
  profileImageUrl?: string;
  isComplete?: boolean;
  email?: string;
}

export interface AddressDTOAttributes {
  addressLine?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface ProfileStatus {
  exists: boolean;
  isComplete: boolean;
  profileToken?: string;
  source: ProfileStatusSource;
  parent?: ParentProfileSummary;
}

export interface ParentProfileUpsertPayload {
  parentId?: string | null;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  email: string;
  dateOfBirth?: string | null;
  address?: {
    addressLine?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  isProfileComplete?: boolean;
  profileImageKey?: string | null;
  existingPhotoUrl?: string | null;
}

export type ParentProfileUpsertResult = ParentProfileSummary;

const PARENT_RESOURCE = '/fhir/v1/parent';
const PROFILE_COMPLETION_EXTENSION_URL =
  'http://example.org/fhir/StructureDefinition/parent-profile-completed';

const hasAddressContent = (address?: FhirAddress | null): boolean => {
  if (!address) {
    return false;
  }

  return Boolean(
    address.line?.[0] ??
      address.city ??
      address.state ??
      address.postalCode ??
      address.country,
  );
};

const normalizeAddressFromResource = (
  address?: FhirAddress | null,
): AddressDTOAttributes | undefined => {
  if (!address) {
    return undefined;
  }

  return {
    addressLine: address.line?.[0],
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
};

const extractTelecomValue = (
  telecom: ContactPoint[] | undefined,
  targetSystem: ContactPoint['system'],
): string | undefined => telecom?.find(item => item.system === targetSystem)?.value;

const calculateAgeFromDate = (dateOfBirth?: string): number | undefined => {
  if (!dateOfBirth) {
    return undefined;
  }

  const parsed = new Date(dateOfBirth);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const month = today.getMonth() - parsed.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
};

const deriveCompletionFromExtensions = (
  extensions?: Extension[] | null,
): boolean | undefined => {
  if (!extensions?.length) {
    return undefined;
  }

  const match = extensions.find(
    extension => extension.url === PROFILE_COMPLETION_EXTENSION_URL,
  );
  if (match && typeof match.valueBoolean === 'boolean') {
    return match.valueBoolean;
  }

  return undefined;
};

const computeDefaultCompletion = (summary: ParentProfileSummary): boolean => {
  return (
    Boolean(summary.firstName?.trim()) &&
    Boolean(summary.lastName?.trim()) &&
    Boolean(summary.phoneNumber?.trim())
  );
};

const mapSummaryFromResource = (
  resource: RelatedPerson,
): {summary: ParentProfileSummary; isComplete: boolean} => {
  const phoneNumber = extractTelecomValue(resource.telecom, 'phone');
  const email = extractTelecomValue(resource.telecom, 'email');
  const address = normalizeAddressFromResource(resource.address?.[0]);

  const summary: ParentProfileSummary = {
    id: resource.id ?? '',
    firstName: resource.name?.[0]?.given?.[0] ?? resource.name?.[0]?.text,
    lastName: resource.name?.[0]?.family,
    birthDate: resource.birthDate,
    phoneNumber,
    address,
    profileImageUrl: resource.photo?.[0]?.url,
    email,
    age: calculateAgeFromDate(resource.birthDate),
  };

  const extensionCompletion = deriveCompletionFromExtensions(resource.extension);
  const fallbackCompletion = computeDefaultCompletion(summary);
  summary.isComplete =
    typeof extensionCompletion === 'boolean'
      ? extensionCompletion || fallbackCompletion
      : fallbackCompletion;

  return {
    summary,
    isComplete: summary.isComplete ?? false,
  };
};

const buildNamePayload = (
  firstName?: string,
  lastName?: string,
): RelatedPerson['name'] => {
  if (!firstName && !lastName) {
    return undefined;
  }

  const text = [firstName, lastName].filter(Boolean).join(' ').trim();

  return [
    {
      use: 'official',
      text: text || undefined,
      given: firstName ? [firstName] : undefined,
      family: lastName || undefined,
    },
  ];
};

const buildTelecomPayload = ({
  phoneNumber,
  email,
}: {
  phoneNumber?: string;
  email?: string;
}): RelatedPerson['telecom'] => {
  const telecom: ContactPoint[] = [];

  if (phoneNumber?.trim()) {
    telecom.push({
      system: 'phone',
      value: phoneNumber.trim(),
    });
  }

  if (email?.trim()) {
    telecom.push({
      system: 'email',
      value: email.trim(),
    });
  }

  return telecom.length ? telecom : undefined;
};

const buildAddressPayload = (
  address: ParentProfileUpsertPayload['address'],
): RelatedPerson['address'] => {
  if (!address) {
    return undefined;
  }

  const trimmed = {
    line: address.addressLine ? [address.addressLine.trim()] : undefined,
    city: address.city?.trim(),
    state: address.stateProvince?.trim(),
    postalCode: address.postalCode?.trim(),
    country: address.country?.trim(),
  };

  return hasAddressContent(trimmed) ? [trimmed] : undefined;
};

const buildPhotoPayload = (
  payload: ParentProfileUpsertPayload,
): RelatedPerson['photo'] => {
  const url = payload.profileImageKey ?? payload.existingPhotoUrl ?? undefined;
  if (!url) {
    return undefined;
  }

  return [
    {
      url,
    },
  ];
};

const buildParentRequestBody = (payload: ParentProfileUpsertPayload): RelatedPerson => {
  const extensions: Extension[] = [];
  if (typeof payload.isProfileComplete === 'boolean') {
    extensions.push({
      url: PROFILE_COMPLETION_EXTENSION_URL,
      valueBoolean: payload.isProfileComplete,
    });
  }

  return {
    resourceType: 'RelatedPerson',
    id: payload.parentId ?? undefined,
    name: buildNamePayload(payload.firstName, payload.lastName),
    telecom: buildTelecomPayload({
      phoneNumber: payload.phoneNumber,
      email: payload.email,
    }),
    address: buildAddressPayload(payload.address),
    photo: buildPhotoPayload(payload),
    birthDate: payload.dateOfBirth ?? undefined,
    extension: extensions.length ? extensions : undefined,
  };
};
export const fetchProfileStatus = async ({
  accessToken,
  userId,
  parentId,
}: ProfileStatusRequest): Promise<ProfileStatus> => {
  const targetId = parentId ?? userId;

  if (!accessToken || !targetId) {
    return {
      exists: false,
      isComplete: false,
      profileToken: undefined,
      source: 'mock',
    };
  }

  try {
    const endpoint = `${PARENT_RESOURCE}/${encodeURIComponent(targetId)}`;
    console.log('[ProfileService] Fetch parent request', {
      endpoint,
      parentId: targetId,
    });

    const response = await apiClient.get<RelatedPerson>(endpoint, {
      headers: withAuthHeaders(accessToken),
    });

    console.log('[ProfileService] Fetch parent response', {
      status: response.status,
      endpoint,
      data: response.data,
    });

    const {summary, isComplete} = mapSummaryFromResource(response.data);

    return {
      exists: true,
      isComplete,
      profileToken: summary.profileImageUrl,
      source: 'remote',
      parent: summary,
    };
  } catch (error) {
    if (isAxiosError(error)) {
      console.warn('[ProfileService] Fetch parent error', {
        message: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      });
      if (error.response?.status === 404) {
        return {
          exists: false,
          isComplete: false,
          profileToken: undefined,
          source: 'remote',
        };
      }

      console.warn('[ProfileService] Failed to fetch parent profile', error.message);
      return {
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'fallback',
      };
    }

    console.warn('[ProfileService] Unexpected error while fetching profile', error);
    return {
      exists: false,
      isComplete: false,
      profileToken: undefined,
      source: 'fallback',
    };
  }
};

export const createParentProfile = async (
  payload: ParentProfileUpsertPayload,
  accessToken: string,
): Promise<ParentProfileUpsertResult> =>
  submitParentProfile(
    {
      ...payload,
      parentId: payload.parentId ?? null,
    },
    accessToken,
  );

export const updateParentProfile = async (
  payload: ParentProfileUpsertPayload,
  accessToken: string,
): Promise<ParentProfileUpsertResult> => {
  if (!payload.parentId) {
    throw new Error('Parent identifier is required for updates.');
  }
  return submitParentProfile(payload, accessToken);
};

export const deleteParentProfile = async (
  parentId: string,
  accessToken: string,
): Promise<void> => {
  if (!parentId) {
    throw new Error('Parent identifier is required to delete the account.');
  }

  const endpoint = `${PARENT_RESOURCE}/${encodeURIComponent(parentId)}`;
  console.log('[ProfileService] Delete parent request', {endpoint, parentId});

  try {
    const response = await apiClient.delete(endpoint, {
      headers: withAuthHeaders(accessToken),
    });

    console.log('[ProfileService] Delete parent response', {
      status: response.status,
      endpoint,
    });
  } catch (error) {
    if (isAxiosError(error)) {
      const serverMessage =
        typeof error.response?.data === 'object' && error.response?.data
          ? (error.response?.data as {message?: string}).message
          : undefined;
      const message = serverMessage ?? 'Failed to delete parent profile.';
      console.warn('[ProfileService] Delete parent failed', {
        status: error.response?.status,
        serverMessage,
      });
      throw new Error(message);
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to delete parent profile.',
    );
  }
};
const submitParentProfile = async (
  payload: ParentProfileUpsertPayload,
  accessToken: string,
): Promise<ParentProfileUpsertResult> => {
  const body = buildParentRequestBody(payload);
  const hasParentId = Boolean(payload.parentId);
  const endpoint = hasParentId
    ? `${PARENT_RESOURCE}/${encodeURIComponent(payload.parentId ?? '')}`
    : PARENT_RESOURCE;
  const method: 'post' | 'put' = hasParentId ? 'put' : 'post';

  console.log('[ProfileService] Upsert parent request', {
    method,
    endpoint,
    parentId: payload.parentId,
    payload: body,
  });

  const response = await apiClient.request<RelatedPerson>({
    method,
    url: endpoint,
    data: body,
    headers: withAuthHeaders(accessToken),
  });

  console.log('[ProfileService] Upsert parent response', {
    status: response.status,
    endpoint,
    parentId: payload.parentId,
    data: response.data,
  });

  const {summary, isComplete} = mapSummaryFromResource(response.data);
  summary.isComplete = isComplete;
  return summary;
};
