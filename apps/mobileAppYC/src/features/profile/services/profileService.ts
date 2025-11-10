import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {RelatedPerson} from '@yosemite-crew/fhirtypes';
import {
  fromParentRequestDTO,
  toParentResponseDTO,
  type Parent,
  type ParentRequestDTO,
  type ParentDTOAttributesType,
  type AddressDTOAttributes,
} from '@yosemite-crew/types';
import {isAxiosError} from 'axios';

export interface ProfileStatusRequest {
  accessToken: string;
  userId: string;
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
}

export interface ProfileStatus {
  exists: boolean;
  isComplete: boolean;
  profileToken?: string;
  source: ProfileStatusSource;
  parent?: ParentProfileSummary;
}

export interface ParentProfileUpsertPayload {
  userId: string;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  dateOfBirth: string;
  profileImageUrl?: string | null;
  address: {
    addressLine: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  isProfileComplete?: boolean;
}

export type ParentProfileUpsertResult = ParentProfileSummary;

const PARENT_RESOURCE = '/fhir/v1/parent';
const PROFILE_COMPLETION_EXTENSION_URL =
  'http://example.org/fhir/StructureDefinition/parent-profile-completed';

const isAddressComplete = (address?: AddressDTOAttributes): boolean => {
  if (!address) {
    return false;
  }

  const required: Array<keyof AddressDTOAttributes> = [
    'addressLine',
    'city',
    'state',
    'postalCode',
    'country',
  ];

  return required.every(field => {
    const value = address[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
};

const deriveProfileCompletion = (
  resource: RelatedPerson,
  attributes: ParentDTOAttributesType,
): boolean => {
  const completionExtension = resource.extension?.find(
    extension => extension.url === PROFILE_COMPLETION_EXTENSION_URL,
  );

  if (completionExtension && typeof completionExtension.valueBoolean === 'boolean') {
    return completionExtension.valueBoolean;
  }

  return (
    Boolean(attributes.firstName) &&
    typeof attributes.age === 'number' &&
    attributes.age > 0 &&
    Boolean(attributes.phoneNumber) &&
    isAddressComplete(attributes.address)
  );
};

const parseParentResource = (resource: RelatedPerson): ParentProfileSummary => {
  const attributes = fromParentRequestDTO(resource);

  return {
    id: attributes._id ?? resource.id ?? '',
    firstName: attributes.firstName,
    lastName: attributes.lastName,
    age: attributes.age,
    phoneNumber: attributes.phoneNumber,
    address: attributes.address,
    profileImageUrl: attributes.profileImageUrl,
    birthDate: resource.birthDate,
  };
};

const mapSummaryFromResource = (
  resource: RelatedPerson,
): {summary: ParentProfileSummary; isComplete: boolean} => {
  const summary = parseParentResource(resource);
  const attributes = fromParentRequestDTO(resource);
  const isComplete = deriveProfileCompletion(resource, attributes);

  summary.isComplete = isComplete;

  return {
    summary,
    isComplete,
  };
};

const calculateAgeFromDate = (dateOfBirth: string): number => {
  const parsed = new Date(dateOfBirth);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Invalid date of birth provided.');
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const month = today.getMonth() - parsed.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
};

const buildParentDomain = (payload: ParentProfileUpsertPayload): Parent => {
  const age = calculateAgeFromDate(payload.dateOfBirth);

  return {
    _id: payload.userId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    age,
    address: {
      addressLine: payload.address.addressLine,
      city: payload.address.city,
      state: payload.address.stateProvince,
      postalCode: payload.address.postalCode,
      country: payload.address.country,
      latitude: payload.address.latitude,
      longitude: payload.address.longitude,
    },
    phoneNumber: payload.phoneNumber,
    birthDate: payload.dateOfBirth,
    profileImageUrl: payload.profileImageUrl ?? undefined,
    isProfileComplete: payload.isProfileComplete ?? true,
  };
};

const submitParentProfile = async (
  payload: ParentProfileUpsertPayload,
  accessToken: string,
  method: 'post' | 'put',
): Promise<ParentProfileUpsertResult> => {
  const parentDomain = buildParentDomain(payload);
  const body: ParentRequestDTO = toParentResponseDTO(parentDomain);

  const endpoint =
    method === 'post'
      ? `${PARENT_RESOURCE}`
      : `${PARENT_RESOURCE}/${encodeURIComponent(payload.userId)}`;

  console.log('[ProfileService] Upsert parent request', {
    method,
    endpoint,
    userId: payload.userId,
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
    userId: payload.userId,
    data: response.data,
  });

  const {summary, isComplete} = mapSummaryFromResource(response.data);
  summary.isComplete = isComplete;
  return summary;
};

export const fetchProfileStatus = async ({
  accessToken,
  userId,
}: ProfileStatusRequest): Promise<ProfileStatus> => {
  if (!accessToken || !userId) {
    return {
      exists: false,
      isComplete: false,
      profileToken: undefined,
      source: 'mock',
    };
  }

  try {
    const endpoint = `${PARENT_RESOURCE}/${encodeURIComponent(userId)}`;
    console.log('[ProfileService] Fetch parent request', {endpoint, userId});

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
): Promise<ParentProfileUpsertResult> => submitParentProfile(payload, accessToken, 'post');

export const updateParentProfile = async (
  payload: ParentProfileUpsertPayload,
  accessToken: string,
): Promise<ParentProfileUpsertResult> => submitParentProfile(payload, accessToken, 'put');
