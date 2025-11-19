import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {AxiosResponse} from 'axios';
import {
  fromCompanionRequestDTO,
  toFHIRCompanion,
  type Companion as BackendCompanion,
  type CompanionRequestDTO,
  type CompanionResponseDTO,
  type CompanionType,
  type SourceType,
} from '@yosemite-crew/types';
import type {
  AddCompanionPayload,
  Companion,
  CompanionCategory,
  CompanionGender,
  CompanionOrigin,
  InsuredStatus,
  NeuteredStatus,
  Breed,
} from '@/features/companion/types';

const COMPANION_ENDPOINT = '/fhir/v1/companion';
const parentCompanionsEndpoint = (userId: string) =>
  `/fhir/v1/parent/${encodeURIComponent(userId)}/companions`;

const logCompanionApiEvent = (
  phase: 'request' | 'response' | 'error',
  details: Record<string, unknown>,
) => {
  const normalized: Record<string, unknown> = {
    phase,
    timestamp: new Date().toISOString(),
    ...details,
  };
  console.log('[CompanionAPI]', normalized);
};

type CompanionInput = (AddCompanionPayload & {id?: string}) | Companion;

const SPECIES_NAME: Record<CompanionCategory, string> = {
  cat: 'Cat',
  dog: 'Dog',
  horse: 'Horse',
};

const SOURCE_BY_ORIGIN: Record<CompanionOrigin, SourceType> = {
  shop: 'shop',
  breeder: 'breeder',
  'foster-shelter': 'foster_shelter',
  'friends-family': 'friends_family',
  unknown: 'unknown',
};

const ORIGIN_BY_SOURCE: Record<SourceType, CompanionOrigin> = {
  shop: 'shop',
  breeder: 'breeder',
  foster_shelter: 'foster-shelter',
  friends_family: 'friends-family',
  unknown: 'unknown',
};

const isAppCompanion = (input: CompanionInput): input is Companion =>
  'id' in input && typeof input.id === 'string';

const extractCompanionCollection = (
  payload: unknown,
): CompanionResponseDTO[] => {
  if (Array.isArray(payload)) {
    return payload as CompanionResponseDTO[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [
      record.companions,
      record.data,
      (record.data as Record<string, unknown> | undefined)?.companions,
      record.results,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as CompanionResponseDTO[];
      }
    }
  }

  return [];
};

const ensureCategory = (category: CompanionCategory | null | undefined): CompanionCategory => {
  if (!category) {
    throw new Error('Companion category is required.');
  }
  return category;
};

const ensureGender = (gender: CompanionGender | null | undefined): CompanionGender => {
  if (!gender) {
    throw new Error('Companion gender is required.');
  }
  return gender;
};

const ensureDateOfBirth = (value: string | Date | null | undefined): Date => {
  if (!value) {
    throw new Error('Companion date of birth is required.');
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Invalid companion date of birth.');
  }
  return date;
};

const ensureOrigin = (origin: CompanionOrigin | null | undefined): CompanionOrigin => {
  if (!origin) {
    throw new Error('Companion origin is required.');
  }
  return origin;
};

const mapCategoryToType = (category: CompanionCategory): CompanionType => {
  switch (category) {
    case 'cat':
    case 'dog':
    case 'horse':
      return category;
    default:
      return 'other';
  }
};

const mapTypeToCategory = (type: CompanionType | undefined): CompanionCategory => {
  if (type === 'cat' || type === 'dog' || type === 'horse') {
    return type;
  }
  return 'dog';
};

const mapOriginToSource = (origin: CompanionOrigin): SourceType => SOURCE_BY_ORIGIN[origin];

const mapSourceToOrigin = (source: SourceType | undefined): CompanionOrigin => {
  if (!source) {
    return 'unknown';
  }
  return ORIGIN_BY_SOURCE[source] ?? 'unknown';
};

const mapNeuteredStatusToBoolean = (
  status: NeuteredStatus | null | undefined,
): boolean | undefined => {
  if (!status) {
    return undefined;
  }
  return status === 'neutered';
};

const mapBooleanToNeuteredStatus = (value: boolean | undefined): NeuteredStatus => {
  if (value === true) {
    return 'neutered';
  }
  return 'not-neutered';
};

const mapInsuredStatusToBoolean = (status: InsuredStatus | null | undefined): boolean => {
  return status === 'insured';
};

const mapBooleanToInsuredStatus = (value: boolean | undefined): InsuredStatus => {
  return value ? 'insured' : 'not-insured';
};

const normalizeBreedFromName = (
  breedName: string | undefined,
  category: CompanionCategory,
): Breed | null => {
  if (!breedName) {
    return null;
  }

  const DATASETS: Record<CompanionCategory, Breed[]> = {
    cat: require('@/features/companion/data/catBreeds.json'),
    dog: require('@/features/companion/data/dogBreeds.json'),
    horse: require('@/features/companion/data/horseBreeds.json'),
  };

  const dataset = DATASETS[category];
  const match =
    dataset.find(
      candidate =>
        candidate.breedName?.toLowerCase() === breedName.toLowerCase(),
    ) ?? null;

  if (match) {
    return match;
  }

  return {
    speciesId: 0,
    speciesName: SPECIES_NAME[category],
    breedId: -1,
    breedName,
  };
};

const extractCompanionInput = (input: CompanionInput) => {
  const {
    category,
    name,
    breed,
    dateOfBirth,
    gender,
    currentWeight,
    color,
    allergies,
    neuteredStatus,
    ageWhenNeutered,
    bloodGroup,
    microchipNumber,
    passportNumber,
    insuredStatus,
    insuranceCompany,
    insurancePolicyNumber,
    countryOfOrigin,
    origin,
    profileImage,
  } = input;

  return {
    id: isAppCompanion(input) ? input.id : undefined,
    category: ensureCategory(category),
    name,
    breed,
    dateOfBirth: ensureDateOfBirth(dateOfBirth),
    gender: ensureGender(gender),
    currentWeight: currentWeight ?? undefined,
    color: color ?? undefined,
    allergies: allergies ?? undefined,
    neuteredStatus: neuteredStatus ?? undefined,
    ageWhenNeutered: ageWhenNeutered ?? undefined,
    bloodGroup: bloodGroup ?? undefined,
    microchipNumber: microchipNumber ?? undefined,
    passportNumber: passportNumber ?? undefined,
    insuredStatus: insuredStatus ?? undefined,
    insuranceCompany: insuranceCompany ?? undefined,
    insurancePolicyNumber: insurancePolicyNumber ?? undefined,
    countryOfOrigin: countryOfOrigin ?? undefined,
    origin: ensureOrigin(origin),
    profileImage: profileImage ?? undefined,
    createdAt: isAppCompanion(input) ? new Date(input.createdAt) : undefined,
    updatedAt: isAppCompanion(input) ? new Date(input.updatedAt) : undefined,
  };
};

const buildBackendCompanion = (input: CompanionInput): BackendCompanion => {
  const {
    id,
    category,
    name,
    breed,
    dateOfBirth,
    gender,
    currentWeight,
    color,
    allergies,
    neuteredStatus,
    ageWhenNeutered,
    bloodGroup,
    microchipNumber,
    passportNumber,
    insuredStatus,
    countryOfOrigin,
    origin,
    profileImage,
    createdAt,
    updatedAt,
  } = extractCompanionInput(input);

  return {
    _id: id,
    name,
    type: mapCategoryToType(category),
    breed: breed?.breedName ?? '',
    dateOfBirth,
    gender,
    photoUrl: profileImage,
    currentWeight,
    colour: color,
    allergy: allergies ?? undefined,
    bloodGroup: bloodGroup ?? undefined,
    isneutered: mapNeuteredStatusToBoolean(neuteredStatus),
    ageWhenNeutered: ageWhenNeutered ?? undefined,
    microchipNumber: microchipNumber ?? undefined,
    passportNumber: passportNumber ?? undefined,
    isInsured: mapInsuredStatusToBoolean(insuredStatus),
    countryOfOrigin: countryOfOrigin ?? undefined,
    source: mapOriginToSource(origin),
    status: 'active',
    createdAt,
    updatedAt,
  };
};

const mapResponseToAppCompanion = (
  response: CompanionResponseDTO,
  userId: string,
  persisted?: Companion,
): Companion => {
  const attributes = fromCompanionRequestDTO(response);

  const category = mapTypeToCategory(attributes.type);
  const dateOfBirth = attributes.dateOfBirth?.toISOString() ?? new Date().toISOString();
  const updatedAt = attributes.updatedAt?.toISOString() ?? new Date().toISOString();

  const mergedBreed =
    attributes.breed && category
      ? normalizeBreedFromName(attributes.breed, category)
      : null;

  return {
    id: attributes._id ?? persisted?.id ?? '',
    userId,
    category,
    name: attributes.name ?? persisted?.name ?? 'Unnamed Companion',
    breed: mergedBreed ?? persisted?.breed ?? null,
    dateOfBirth,
    gender:
      attributes.gender === 'male' || attributes.gender === 'female'
        ? attributes.gender
        : persisted?.gender ?? 'male',
    currentWeight:
      typeof attributes.currentWeight === 'number'
        ? attributes.currentWeight
        : persisted?.currentWeight ?? null,
    color: attributes.colour ?? persisted?.color ?? null,
    allergies: attributes.allergy ?? persisted?.allergies ?? null,
    neuteredStatus: mapBooleanToNeuteredStatus(attributes.isneutered),
    ageWhenNeutered: attributes.ageWhenNeutered ?? persisted?.ageWhenNeutered ?? null,
    bloodGroup: attributes.bloodGroup ?? persisted?.bloodGroup ?? null,
    microchipNumber: attributes.microchipNumber ?? persisted?.microchipNumber ?? null,
    passportNumber: attributes.passportNumber ?? persisted?.passportNumber ?? null,
    insuredStatus: mapBooleanToInsuredStatus(attributes.isInsured),
    insuranceCompany: persisted?.insuranceCompany ?? null,
    insurancePolicyNumber: persisted?.insurancePolicyNumber ?? null,
    countryOfOrigin: attributes.countryOfOrigin ?? persisted?.countryOfOrigin ?? null,
    origin: mapSourceToOrigin(attributes.source),
    profileImage: attributes.photoUrl ?? persisted?.profileImage ?? null,
    createdAt: persisted?.createdAt ?? updatedAt,
    updatedAt,
  };
};

const postCompanion = async (
  payload: CompanionRequestDTO,
  accessToken: string,
): Promise<AxiosResponse<CompanionResponseDTO>> => {
  logCompanionApiEvent('request', {
    method: 'POST',
    endpoint: COMPANION_ENDPOINT,
    payload,
  });
  try {
    const response = await apiClient.post<CompanionResponseDTO>(
      COMPANION_ENDPOINT,
      payload,
      {
        headers: withAuthHeaders(accessToken),
      },
    );
    logCompanionApiEvent('response', {
      method: 'POST',
      endpoint: COMPANION_ENDPOINT,
      status: response.status,
      data: response.data,
    });
    return response;
  } catch (error) {
    logCompanionApiEvent('error', {
      method: 'POST',
      endpoint: COMPANION_ENDPOINT,
      message: error instanceof Error ? error.message : 'Unknown error',
      payload,
    });
    throw error;
  }
};

const putCompanion = async (
  id: string,
  payload: CompanionRequestDTO,
  accessToken: string,
): Promise<AxiosResponse<CompanionResponseDTO>> => {
  const endpoint = `${COMPANION_ENDPOINT}/${id}`;
  logCompanionApiEvent('request', {
    method: 'PUT',
    endpoint,
    payload,
  });
  try {
    const response = await apiClient.put<CompanionResponseDTO>(endpoint, payload, {
      headers: withAuthHeaders(accessToken),
    });
    logCompanionApiEvent('response', {
      method: 'PUT',
      endpoint,
      status: response.status,
      data: response.data,
    });
    return response;
  } catch (error) {
    logCompanionApiEvent('error', {
      method: 'PUT',
      endpoint,
      message: error instanceof Error ? error.message : 'Unknown error',
      payload,
    });
    throw error;
  }
};

const getCompanion = async (
  id: string,
  accessToken: string,
): Promise<AxiosResponse<CompanionResponseDTO>> => {
  const endpoint = `${COMPANION_ENDPOINT}/${id}`;
  logCompanionApiEvent('request', {
    method: 'GET',
    endpoint,
    payload: undefined,
  });
  try {
    const response = await apiClient.get<CompanionResponseDTO>(endpoint, {
      headers: withAuthHeaders(accessToken),
    });
    logCompanionApiEvent('response', {
      method: 'GET',
      endpoint,
      status: response.status,
      data: response.data,
    });
    return response;
  } catch (error) {
    logCompanionApiEvent('error', {
      method: 'GET',
      endpoint,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

const listCompanionsByParent = async (
  userId: string,
  accessToken: string,
): Promise<AxiosResponse<CompanionResponseDTO[] | Record<string, unknown>>> => {
  const endpoint = parentCompanionsEndpoint(userId);
  logCompanionApiEvent('request', {
    method: 'GET',
    endpoint,
    userId,
  });

  try {
    const response = await apiClient.get<CompanionResponseDTO[] | Record<string, unknown>>(
      endpoint,
      {
        headers: withAuthHeaders(accessToken),
      },
    );
    logCompanionApiEvent('response', {
      method: 'GET',
      endpoint,
      status: response.status,
      data: response.data,
    });
    return response;
  } catch (error) {
    logCompanionApiEvent('error', {
      method: 'GET',
      endpoint,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

const deleteCompanionRequest = async (
  id: string,
  accessToken: string,
): Promise<AxiosResponse<void>> => {
  const endpoint = `${COMPANION_ENDPOINT}/${id}`;
  logCompanionApiEvent('request', {
    method: 'DELETE',
    endpoint,
    companionId: id,
  });

  try {
    const response = await apiClient.delete<void>(endpoint, {
      headers: withAuthHeaders(accessToken),
    });
    logCompanionApiEvent('response', {
      method: 'DELETE',
      endpoint,
      status: response.status,
    });
    return response;
  } catch (error) {
    logCompanionApiEvent('error', {
      method: 'DELETE',
      endpoint,
      companionId: id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export interface CompanionCreateParams {
  userId: string;
  payload: AddCompanionPayload;
  accessToken: string;
}

export interface CompanionUpdateParams {
  companion: Companion;
  accessToken: string;
}

export interface CompanionGetParams {
  companionId: string;
  userId: string;
  accessToken: string;
  fallback?: Companion;
}

export interface CompanionListParams {
  userId: string;
  accessToken: string;
}

export interface CompanionDeleteParams {
  companionId: string;
  accessToken: string;
}

export const companionApi = {
  async create(params: CompanionCreateParams): Promise<Companion> {
    const backendCompanion = buildBackendCompanion(params.payload);
    const fhirPayload = toFHIRCompanion(backendCompanion);
    const {data} = await postCompanion(fhirPayload, params.accessToken);
    return mapResponseToAppCompanion(data, params.userId);
  },

  async update(params: CompanionUpdateParams): Promise<Companion> {
    if (!params.companion.id) {
      throw new Error('A companion ID is required to update.');
    }
    const backendCompanion = buildBackendCompanion(params.companion);
    const fhirPayload = toFHIRCompanion(backendCompanion);
    const {data} = await putCompanion(
      params.companion.id,
      fhirPayload,
      params.accessToken,
    );
    return mapResponseToAppCompanion(data, params.companion.userId, params.companion);
  },

  async getById(params: CompanionGetParams): Promise<Companion> {
    const {data} = await getCompanion(params.companionId, params.accessToken);
    return mapResponseToAppCompanion(data, params.userId, params.fallback);
  },

  async listByParent(params: CompanionListParams): Promise<Companion[]> {
    const {data} = await listCompanionsByParent(params.userId, params.accessToken);
    const collection = extractCompanionCollection(data);
    return collection.map(entry => mapResponseToAppCompanion(entry, params.userId));
  },

  async remove(params: CompanionDeleteParams): Promise<void> {
    if (!params.companionId) {
      throw new Error('Companion identifier is required for deletion.');
    }
    await deleteCompanionRequest(params.companionId, params.accessToken);
  },
};
