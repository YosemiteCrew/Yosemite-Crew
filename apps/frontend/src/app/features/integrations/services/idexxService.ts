import api, { getData, postData } from '@/app/services/axios';
import axios from 'axios';
import {
  AddCensusPayload,
  CensusEntry,
  CreateLabOrderPayload,
  IdexxTestsResponse,
  IntegrationProvider,
  IvlsDevicesResponse,
  LabOrder,
  LabResult,
  OrgIntegration,
  StoreCredentialsPayload,
  ValidateCredentialsResponse,
} from '@/app/features/integrations/services/types';

const IDEX_PROVIDER: IntegrationProvider = 'IDEXX';

const endpointProvider = (provider: IntegrationProvider) => provider.toLowerCase();

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) return fallback;
  const status = error.response?.status;
  const data = error.response?.data as { message?: string; error?: string } | undefined;
  const backendMessage = data?.message || data?.error;
  if (status === 403) {
    return backendMessage
      ? `Forbidden (403): ${backendMessage}`
      : 'Forbidden (403): You are not authorized for this organization/resource.';
  }
  if (status) {
    return backendMessage
      ? `${fallback} (${status}): ${backendMessage}`
      : `${fallback} (${status})`;
  }
  return fallback;
};

export const getOrgIntegrations = async (organisationId: string): Promise<OrgIntegration[]> => {
  try {
    const res = await getData<OrgIntegration[]>(
      `/v1/integration/pms/organisation/${organisationId}`
    );
    return res.data ?? [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

export const getIntegrationByProvider = async (
  organisationId: string,
  provider: IntegrationProvider = IDEX_PROVIDER
): Promise<OrgIntegration | null> => {
  const integrations = await getOrgIntegrations(organisationId);
  const normalizedProvider = provider.toLowerCase();
  const match = integrations.find(
    (integration) =>
      String(integration?.provider ?? '')
        .trim()
        .toLowerCase() === normalizedProvider
  );
  return match ?? null;
};

export const storeIntegrationCredentials = async (
  organisationId: string,
  payload: StoreCredentialsPayload,
  provider: IntegrationProvider = IDEX_PROVIDER
): Promise<OrgIntegration> => {
  const res = await postData<OrgIntegration, StoreCredentialsPayload>(
    `/v1/integration/pms/organisation/${organisationId}/${provider}/credentials`,
    payload
  );
  return res.data;
};

export const validateIntegrationCredentials = async (
  organisationId: string,
  provider: IntegrationProvider = IDEX_PROVIDER
): Promise<ValidateCredentialsResponse> => {
  const res = await postData<ValidateCredentialsResponse>(
    `/v1/integration/pms/organisation/${organisationId}/${provider}/validate`
  );
  return res.data;
};

export const enableIntegration = async (
  organisationId: string,
  provider: IntegrationProvider = IDEX_PROVIDER
): Promise<OrgIntegration> => {
  const res = await postData<OrgIntegration>(
    `/v1/integration/pms/organisation/${organisationId}/${endpointProvider(provider)}/enable`
  );
  return res.data;
};

export const disableIntegration = async (
  organisationId: string,
  provider: IntegrationProvider = IDEX_PROVIDER
): Promise<OrgIntegration> => {
  const res = await postData<OrgIntegration>(
    `/v1/integration/pms/organisation/${organisationId}/${endpointProvider(provider)}/disable`
  );
  return res.data;
};

export const listIdexxTests = async (opts: {
  organisationId: string;
  query?: string;
  page?: number;
  limit?: number;
}): Promise<IdexxTestsResponse> => {
  const { organisationId, query = '', page = 1, limit = 25 } = opts;
  const res = await getData<IdexxTestsResponse>(
    `/v1/labs/pms/organisation/${organisationId}/idexx/tests`,
    {
      query,
      page,
      limit,
    }
  );
  return res.data;
};

export const getIdexxCensus = async (organisationId: string): Promise<CensusEntry[]> => {
  const res = await getData<CensusEntry[]>(
    `/v1/labs/pms/organisation/${organisationId}/idexx/census`
  );
  return res.data ?? [];
};

export const addPatientToIdexxCensus = async (opts: {
  organisationId: string;
  payload: AddCensusPayload;
}): Promise<CensusEntry> => {
  const res = await postData<CensusEntry, AddCensusPayload>(
    `/v1/labs/pms/organisation/${opts.organisationId}/idexx/census`,
    opts.payload
  );
  return res.data;
};

export const createIdexxLabOrder = async (opts: {
  organisationId: string;
  payload: CreateLabOrderPayload;
}): Promise<LabOrder> => {
  const res = await postData<LabOrder, CreateLabOrderPayload>(
    `/v1/labs/pms/organisation/${opts.organisationId}/idexx/orders`,
    opts.payload
  );
  return res.data;
};

export const getIdexxOrderById = async (opts: {
  organisationId: string;
  idexxOrderId: string;
}): Promise<LabOrder> => {
  const res = await getData<LabOrder>(
    `/v1/labs/pms/organisation/${opts.organisationId}/idexx/orders/${opts.idexxOrderId}`
  );
  return res.data;
};

export const listIdexxOrders = async (opts: {
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
  status?: string;
  limit?: number;
}): Promise<LabOrder[]> => {
  const { organisationId, appointmentId, companionId, status, limit } = opts;
  const res = await postData<LabOrder[] | { orders?: LabOrder[] }, Record<string, string | number>>(
    `/v1/labs/pms/organisation/${organisationId}/idexx/orders/search`,
    {
      ...(appointmentId ? { appointmentId } : {}),
      ...(companionId ? { companionId } : {}),
      ...(status ? { status } : {}),
      ...(limit !== undefined ? { limit } : {}),
    }
  );
  const payload = res.data;
  if (Array.isArray(payload)) return payload;
  return payload?.orders ?? [];
};

export const listIdexxIvlsDevices = async (
  organisationId: string
): Promise<IvlsDevicesResponse> => {
  const res = await getData<IvlsDevicesResponse>(
    `/v1/labs/pms/organisation/${organisationId}/idexx/ivls/devices`
  );
  return res.data;
};

export const listIdexxResults = async (organisationId: string): Promise<LabResult[]> => {
  const res = await getData<LabResult[]>(
    `/v1/labs/pms/organisation/${organisationId}/IDEXX/results`
  );
  return res.data ?? [];
};

export const getIdexxResultById = async (opts: {
  organisationId: string;
  resultId: string;
}): Promise<LabResult> => {
  const res = await getData<LabResult>(
    `/v1/labs/pms/organisation/${opts.organisationId}/IDEXX/results/${opts.resultId}`
  );
  return res.data;
};

export const getIdexxResultPdfUrl = (opts: { organisationId: string; resultId: string }) =>
  `${process.env.NEXT_PUBLIC_BASE_URL}/v1/labs/pms/organisation/${opts.organisationId}/IDEXX/results/${opts.resultId}/pdf`;

const looksLikeHex = (value: string) => /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;

const hexToPdfBlob = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return new Blob([bytes], { type: 'application/pdf' });
};

export const getIdexxResultPdfBlob = async (opts: {
  organisationId: string;
  resultId: string;
}): Promise<Blob> => {
  const endpoint = `/v1/labs/pms/organisation/${opts.organisationId}/IDEXX/results/${opts.resultId}/pdf`;
  const res = await api.get<Blob>(endpoint, { responseType: 'blob' });
  const blob = res.data;

  const type = String(blob.type ?? '').toLowerCase();
  if (type.includes('application/pdf')) {
    return blob;
  }

  const text = (await blob.text()).trim();
  if (!text) {
    throw new Error('Empty PDF response');
  }

  try {
    const parsed = JSON.parse(text) as { hex?: string; data?: string; file?: string };
    const candidate = String(parsed.hex ?? parsed.data ?? parsed.file ?? '').trim();
    if (candidate && looksLikeHex(candidate)) {
      return hexToPdfBlob(candidate);
    }
  } catch {
    // Non-JSON fallback below.
  }

  if (looksLikeHex(text)) {
    return hexToPdfBlob(text);
  }

  return new Blob([blob], { type: 'application/pdf' });
};
