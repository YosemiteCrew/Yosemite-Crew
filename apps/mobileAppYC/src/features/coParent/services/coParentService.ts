import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {CoParentPermissions, PendingCoParentInvite} from '../types';

export interface SendInviteParams {
  inviteeName: string;
  email: string;
  companionId: string;
  phoneNumber?: string;
  accessToken: string;
}

export interface ListByCompanionParams {
  companionId: string;
  accessToken: string;
}

export interface ListByParentParams {
  parentId: string;
  accessToken: string;
  companionIds?: string[];
}

export interface UpdatePermissionsParams {
  companionId: string;
  coParentId: string;
  permissions: CoParentPermissions;
  accessToken: string;
}

export interface DeleteCoParentParams {
  companionId: string;
  coParentId: string;
  accessToken: string;
}

export interface InviteActionParams {
  token: string;
  accessToken: string;
}

const buildAuthConfig = (accessToken: string) => ({
  headers: withAuthHeaders(accessToken),
});

export const coParentApi = {
  async sendInvite({
    inviteeName,
    email,
    companionId,
    phoneNumber,
    accessToken,
  }: SendInviteParams) {
    const payload: Record<string, string> = {
      inviteeName,
      email,
      companionId,
    };

    if (phoneNumber) {
      payload.phoneNumber = phoneNumber;
    }

    const {data} = await apiClient.post(
      '/v1/coparent-invite/sent',
      payload,
      buildAuthConfig(accessToken),
    );
    return data;
  },

  async listPendingInvites({accessToken}: {accessToken: string}): Promise<PendingCoParentInvite[]> {
    const {data} = await apiClient.get('/v1/coparent-invite/pending', buildAuthConfig(accessToken));
    return (data?.pendingInvites ?? data ?? []) as PendingCoParentInvite[];
  },

  async acceptInvite({token, accessToken}: InviteActionParams) {
    await apiClient.post(
      '/v1/coparent-invite/accept',
      {token},
      buildAuthConfig(accessToken),
    );
    return token;
  },

  async declineInvite({token, accessToken}: InviteActionParams) {
    await apiClient.post(
      '/v1/coparent-invite/decline',
      {token},
      buildAuthConfig(accessToken),
    );
    return token;
  },

  async listByCompanion({companionId, accessToken}: ListByCompanionParams) {
    const {data} = await apiClient.get(
      `/v1/parent-companion/companion/${companionId}`,
      buildAuthConfig(accessToken),
    );
    return data?.links ?? data ?? [];
  },

  async listByParent({parentId, accessToken}: ListByParentParams) {
    const {data} = await apiClient.get(
      `/v1/parent-companion/parent/${parentId}`,
      buildAuthConfig(accessToken),
    );
    return data?.links ?? data ?? [];
  },

  async updatePermissions({
    companionId,
    coParentId,
    permissions,
    accessToken,
  }: UpdatePermissionsParams) {
    const {data} = await apiClient.patch(
      `/v1/parent-companion/companion/${companionId}/${coParentId}/permissions`,
      permissions,
      buildAuthConfig(accessToken),
    );
    return data;
  },

  async remove({companionId, coParentId, accessToken}: DeleteCoParentParams) {
    await apiClient.delete(
      `/v1/parent-companion/companion/${companionId}/${coParentId}`,
      buildAuthConfig(accessToken),
    );
    return true;
  },
};
