import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import type {OTFieldType} from '@/features/tasks/types';
import {observationalToolDefinitions} from '@/features/observationalTools/data';

const toolCache: Record<string, ObservationToolDefinitionRemote> = {};
const mongoIdRegex = /^[a-f0-9]{24}$/i;

const normalizeName = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '');

export interface ObservationToolField {
  key: string;
  label: string;
  type: OTFieldType;
  required?: boolean;
  options?: string[];
  scoring?: {
    points?: number;
    map?: Record<string, number>;
  };
}

export interface ObservationToolDefinitionRemote {
  id: string;
  name: string;
  description?: string;
  category: string;
  fields: ObservationToolField[];
  scoringRules?: {
    sumFields?: string[];
    customFormula?: string;
  };
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ObservationToolSubmission {
  id: string;
  toolId: string;
  toolName?: string;
  taskId?: string | null;
  companionId: string;
  filledBy: string;
  answers: Record<string, unknown>;
  score?: number;
  summary?: string;
  evaluationAppointmentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const cacheTools = (tools: ObservationToolDefinitionRemote[]) => {
  tools.forEach(tool => {
    if (tool?.id) {
      toolCache[tool.id] = tool;
    }
  });
};

const getCachedToolByName = (name: string): ObservationToolDefinitionRemote | null => {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const cached = Object.values(toolCache).find(tool => normalizeName(tool.name) === normalized);
  return cached ?? null;
};

const resolveNameFromStatic = (value: string): string | null => {
  const direct = (observationalToolDefinitions as Record<string, any>)[value];
  if (direct?.name) return direct.name;
  const normalized = normalizeName(value);
  const matched = Object.values(observationalToolDefinitions).find(def =>
    normalizeName(def.name) === normalized ||
    normalizeName(def.shortName) === normalized,
  );
  return matched?.name ?? null;
};

const resolveObservationToolId = async (toolId: string): Promise<string> => {
  if (!toolId) return toolId;
  if (mongoIdRegex.test(toolId)) {
    return toolId;
  }
  if (toolCache[toolId]?.id) {
    return toolCache[toolId].id;
  }
  const cachedByName = getCachedToolByName(toolId);
  if (cachedByName?.id) {
    return cachedByName.id;
  }
  const staticName = resolveNameFromStatic(toolId);
  if (staticName) {
    const cachedStatic = getCachedToolByName(staticName);
    if (cachedStatic?.id) {
      return cachedStatic.id;
    }
  }
  try {
    const list = await observationToolApi.list({onlyActive: true});
    const normalizedInput = normalizeName(toolId);
    const match =
      list.find(tool => normalizeName(tool.name) === normalizedInput) ??
      (staticName ? list.find(tool => normalizeName(tool.name) === normalizeName(staticName)) : null);
    return match?.id ?? toolId;
  } catch {
    return toolId;
  }
};

export const resolveObservationToolIdSync = (toolId?: string | null): string | null => {
  if (!toolId) return null;
  if (mongoIdRegex.test(toolId)) {
    return toolId;
  }
  if (toolCache[toolId]?.id) {
    return toolCache[toolId].id;
  }
  const cachedByName = getCachedToolByName(toolId);
  if (cachedByName?.id) {
    return cachedByName.id;
  }
  const staticName = resolveNameFromStatic(toolId);
  if (staticName) {
    const cachedStatic = getCachedToolByName(staticName);
    if (cachedStatic?.id) {
      return cachedStatic.id;
    }
  }
  return toolId;
};

export const getCachedObservationToolName = (toolId?: string | null): string | null => {
  if (!toolId) return null;
  return toolCache[toolId]?.name ?? getCachedToolByName(toolId)?.name ?? null;
};

export const getCachedObservationTool = (toolId?: string | null): ObservationToolDefinitionRemote | null => {
  if (!toolId) return null;
  const direct = toolCache[toolId];
  if (direct) return direct;
  const byName = getCachedToolByName(toolId);
  if (byName) return byName;
  const staticName = resolveNameFromStatic(toolId);
  return staticName ? getCachedToolByName(staticName) : null;
};

const ensureAccessToken = async (): Promise<{accessToken: string; userId?: string}> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;
  const userId = tokens?.userId;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return {accessToken, userId};
};

const createAuthHeaders = async () => {
  const {accessToken, userId} = await ensureAccessToken();
  return {
    ...withAuthHeaders(accessToken),
    ...(userId ? {'x-user-id': userId} : {}),
  };
};

export const observationToolApi = {
  async list({onlyActive}: {onlyActive?: boolean} = {}) {
    const headers = await createAuthHeaders();
    const response = await apiClient.get('/v1/observation-tools/mobile/tools', {
      params: {onlyActive: onlyActive ? 'true' : undefined},
      headers,
    });
    const data = Array.isArray(response.data) ? response.data : [];
    const mapped = data.map((item: any): ObservationToolDefinitionRemote => ({
      id: item._id ?? item.id ?? item.toolId ?? item.key ?? item.name,
      name: item.name,
      description: item.description,
      category: item.category,
      fields: item.fields ?? [],
      scoringRules: item.scoringRules,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    cacheTools(mapped);
    return mapped;
  },

  async get(toolId: string) {
    const headers = await createAuthHeaders();
    const resolvedId = await resolveObservationToolId(toolId);
    const response = await apiClient.get(`/v1/observation-tools/mobile/tools/${resolvedId}`, {
      headers,
    });
    const item = response.data;
    const definition = {
      id: item?._id ?? item?.id ?? resolvedId,
      name: item?.name,
      description: item?.description,
      category: item?.category,
      fields: item?.fields ?? [],
      scoringRules: item?.scoringRules,
      isActive: item?.isActive,
      createdAt: item?.createdAt,
      updatedAt: item?.updatedAt,
    } as ObservationToolDefinitionRemote;
    cacheTools([definition]);
    return definition;
  },

  async submit({
    toolId,
    companionId,
    taskId,
    answers,
    summary,
  }: {
    toolId: string;
    companionId: string;
    taskId?: string | null;
    answers: Record<string, unknown>;
    summary?: string;
  }): Promise<ObservationToolSubmission> {
    const headers = await createAuthHeaders();
    const {userId} = await ensureAccessToken();
    const resolvedId = await resolveObservationToolId(toolId);
    const response = await apiClient.post(
      `/v1/observation-tools/mobile/tools/${resolvedId}/submissions`,
      {companionId, taskId, answers, summary},
      {headers},
    );
    const payload = response.data;
    return {
      id: payload?._id ?? payload?.id,
      toolId: payload?.toolId ?? resolvedId,
      taskId: payload?.taskId,
      companionId: payload?.companionId ?? companionId,
      filledBy: payload?.filledBy ?? userId ?? '',
      answers: payload?.answers ?? {},
      score: payload?.score,
      summary: payload?.summary,
      evaluationAppointmentId: payload?.evaluationAppointmentId,
      createdAt: payload?.createdAt,
      updatedAt: payload?.updatedAt,
    };
  },

  async linkSubmissionToAppointment({
    submissionId,
    appointmentId,
  }: {
    submissionId: string;
    appointmentId: string;
  }): Promise<ObservationToolSubmission> {
    const headers = await createAuthHeaders();
    const {userId} = await ensureAccessToken();
    const response = await apiClient.post(
      `/v1/observation-tools/mobile/submissions/${submissionId}/link-appointment`,
      {appointmentId},
      {headers},
    );
    const payload = response.data;
    return {
      id: payload?._id ?? payload?.id ?? submissionId,
      toolId: payload?.toolId ?? '',
      taskId: payload?.taskId,
      companionId: payload?.companionId ?? '',
      filledBy: payload?.filledBy ?? userId ?? '',
      answers: payload?.answers ?? {},
      score: payload?.score,
      summary: payload?.summary,
      evaluationAppointmentId: payload?.evaluationAppointmentId ?? appointmentId,
      createdAt: payload?.createdAt,
      updatedAt: payload?.updatedAt,
    };
  },

  async getSubmission(submissionId: string): Promise<ObservationToolSubmission> {
    const headers = await createAuthHeaders();
    const {userId} = await ensureAccessToken();
    const response = await apiClient.get(
      `/v1/observation-tools/mobile/submissions/${submissionId}`,
      {headers},
    );
    const payload = response.data;
    return {
      id: payload?._id ?? payload?.id ?? submissionId,
      toolId: payload?.toolId ?? '',
      taskId: payload?.taskId,
      companionId: payload?.companionId ?? '',
      filledBy: payload?.filledBy ?? userId ?? '',
      answers: payload?.answers ?? {},
      score: payload?.score,
      summary: payload?.summary,
      evaluationAppointmentId: payload?.evaluationAppointmentId,
      createdAt: payload?.createdAt,
      updatedAt: payload?.updatedAt,
    };
  },

  async listAppointmentSubmissions(appointmentId: string): Promise<ObservationToolSubmission[]> {
    const headers = await createAuthHeaders();
    const {userId} = await ensureAccessToken();
    const response = await apiClient.get(
      `/v1/observation-tools/mobile/appointments/${appointmentId}/submissions`,
      {headers},
    );
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map((payload: any) => ({
      id: payload?._id ?? payload?.id,
      toolId: payload?.toolId ?? '',
      taskId: payload?.taskId,
      companionId: payload?.companionId ?? '',
      filledBy: payload?.filledBy ?? userId ?? '',
      answers: payload?.answers ?? {},
      score: payload?.score,
      summary: payload?.summary,
      evaluationAppointmentId: payload?.evaluationAppointmentId ?? appointmentId,
      createdAt: payload?.createdAt,
      updatedAt: payload?.updatedAt,
    }));
  },

  async previewTaskSubmission(taskId: string): Promise<ObservationToolSubmission> {
    const headers = await createAuthHeaders();
    const {userId} = await ensureAccessToken();
    const response = await apiClient.get(
      `/v1/observation-tools/mobile/tasks/${taskId}/preview`,
      {headers},
    );
    const payload = response.data;
    return {
      id: payload?._id ?? payload?.id ?? payload?.submissionId ?? '',
      toolId: payload?.toolId ?? '',
      toolName: payload?.toolName ?? payload?.name ?? undefined,
      taskId: payload?.taskId ?? taskId,
      companionId: payload?.companionId ?? '',
      filledBy: payload?.filledBy ?? userId ?? '',
      answers: payload?.answersPreview ?? payload?.answers ?? {},
      score: payload?.score,
      summary: payload?.summary,
      evaluationAppointmentId: payload?.evaluationAppointmentId,
      createdAt: payload?.submittedAt ?? payload?.createdAt,
      updatedAt: payload?.updatedAt,
    };
  },
};
