import {createAsyncThunk} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {coParentApi} from './services/coParentService';
import type {
  CoParent,
  CoParentInviteRequest,
  CoParentPermissions,
  ParentCompanionAccess,
  PendingCoParentInvite,
} from './types';

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

const normalizePermissions = (
  permissions?: Partial<CoParentPermissions> | null,
): CoParentPermissions => ({
  assignAsPrimaryParent: Boolean(permissions?.assignAsPrimaryParent),
  emergencyBasedPermissions: Boolean(permissions?.emergencyBasedPermissions),
  appointments: Boolean(permissions?.appointments),
  companionProfile: Boolean(permissions?.companionProfile),
  documents: Boolean(permissions?.documents),
  expenses: Boolean(permissions?.expenses),
  tasks: Boolean(permissions?.tasks),
  chatWithVet: Boolean(permissions?.chatWithVet),
});

const normalizeStatus = (status?: string | null): string => {
  const normalized = status?.toLowerCase();
  if (normalized === 'active' || normalized === 'accepted') {
    return 'accepted';
  }
  if (normalized === 'declined' || normalized === 'rejected') {
    return 'declined';
  }
  if (normalized === 'pending' || normalized === 'invited') {
    return 'pending';
  }
  return status ?? 'pending';
};

const normalizeCoParent = (
  link: any,
  companionContext?: {id?: string; name?: string; photoUrl?: string},
): CoParent => {
  const companionId =
    link?.companionId ??
    link?.companion?.id ??
    link?.companion?.companionId ??
    companionContext?.id ??
    '';
  const parentId =
    link?.parentId ?? link?.parent?.id ?? link?.parent?._id ?? link?.userId ?? '';
  const id =
    link?.id ??
    link?._id ??
    link?.linkId ??
    (parentId ? `${parentId}-${companionId || 'companion'}` : `cp_${Date.now()}`);

  const firstName =
    link?.parent?.firstName ??
    link?.firstName ??
    link?.parentFirstName ??
    link?.inviteeName ??
    '';
  const lastName = link?.parent?.lastName ?? link?.lastName ?? link?.parentLastName ?? '';
  const email = link?.parent?.email ?? link?.email ?? link?.parentEmail ?? '';
  const phoneNumber =
    link?.parent?.phoneNumber ?? link?.phoneNumber ?? link?.parentPhone ?? undefined;
  const profilePicture =
    link?.parent?.profileImageUrl ??
    link?.profileImageUrl ??
    link?.parentProfileImage ??
    link?.profilePicture;

  const permissions = normalizePermissions(link?.permissions);

  return {
    id,
    parentId,
    userId: parentId,
    companionId,
    role: link?.role ?? 'CO-PARENT',
    status: normalizeStatus(link?.status),
    email,
    firstName,
    lastName,
    phoneNumber,
    profilePicture,
    profileToken: link?.parent?.profileToken ?? link?.profileToken,
    companions: companionId
      ? [
          {
            companionId,
            companionName:
              companionContext?.name ??
              link?.companion?.name ??
              link?.companionName ??
              'Companion',
            profileImage:
              companionContext?.photoUrl ??
              link?.companion?.photoUrl ??
              link?.companion?.profileImage ??
              undefined,
            hasPermission: true,
          },
        ]
      : [],
    permissions,
    createdAt: link?.createdAt,
    updatedAt: link?.updatedAt,
  };
};

export const fetchCoParents = createAsyncThunk<
  CoParent[],
  {companionId: string; companionName?: string; companionImage?: string},
  {rejectValue: string}
>('coParent/fetchCoParents', async (payload, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const {companionId, companionName, companionImage} = payload;
    const links = await coParentApi.listByCompanion({companionId, accessToken});
    return (links ?? []).map((link: any) =>
      normalizeCoParent(link, {id: companionId, name: companionName, photoUrl: companionImage}),
    );
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch co-parents',
    );
  }
});

export const addCoParent = createAsyncThunk<
  CoParent,
  {inviteRequest: CoParentInviteRequest; companionName?: string; companionImage?: string},
  {rejectValue: string}
>('coParent/addCoParent', async ({inviteRequest, companionName, companionImage}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const response = await coParentApi.sendInvite({
      inviteeName: inviteRequest.candidateName,
      email: inviteRequest.email,
      companionId: inviteRequest.companionId,
      phoneNumber: inviteRequest.phoneNumber,
      accessToken,
    });

    const now = new Date().toISOString();
    const nameParts = inviteRequest.candidateName.trim().split(' ');
    const [firstName, ...rest] = nameParts;

    return normalizeCoParent(
      {
        ...response,
        companionId: inviteRequest.companionId,
        parentId: response?.parentId ?? response?.coParentId ?? response?.id,
        firstName: response?.firstName ?? firstName ?? inviteRequest.candidateName,
        lastName: response?.lastName ?? rest.join(' '),
        email: response?.email ?? inviteRequest.email,
        phoneNumber: response?.phoneNumber ?? inviteRequest.phoneNumber,
        role: response?.role ?? 'CO-PARENT',
        status: normalizeStatus(response?.status ?? 'pending'),
        permissions: normalizePermissions(response?.permissions ?? {}),
        createdAt: response?.createdAt ?? now,
        updatedAt: response?.updatedAt ?? now,
      },
      {
        id: inviteRequest.companionId,
        name: companionName,
        photoUrl: companionImage,
      },
    );
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to send invite',
    );
  }
});

export const updateCoParentPermissions = createAsyncThunk<
  CoParent,
  {companionId: string; coParentId: string; permissions: CoParentPermissions},
  {rejectValue: string; state: RootState}
>(
  'coParent/updateCoParentPermissions',
  async ({companionId, coParentId, permissions}, {rejectWithValue, getState}) => {
    try {
      const accessToken = await ensureAccessToken();
      const response = await coParentApi.updatePermissions({
        companionId,
        coParentId,
        permissions,
        accessToken,
      });

      const state = getState();
      const existing =
        state.coParent?.coParents.find(cp => cp.id === coParentId) ?? null;

      return normalizeCoParent(
        response && Object.keys(response || {}).length
          ? response
          : {...existing, permissions, companionId},
        {
          id: companionId,
          name: existing?.companions?.[0]?.companionName,
          photoUrl: existing?.companions?.[0]?.profileImage,
        },
      );
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update permissions',
      );
    }
  },
);

export const deleteCoParent = createAsyncThunk<
  {coParentId: string},
  {companionId: string; coParentId: string},
  {rejectValue: string}
>('coParent/deleteCoParent', async ({companionId, coParentId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await coParentApi.remove({companionId, coParentId, accessToken});
    return {coParentId};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete co-parent',
    );
  }
});

export const promoteCoParentToPrimary = createAsyncThunk<
  void,
  {companionId: string; coParentId: string},
  {rejectValue: string}
>('coParent/promoteCoParentToPrimary', async ({companionId, coParentId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await coParentApi.promoteToPrimary({companionId, coParentId, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to promote co-parent',
    );
  }
});

export const fetchPendingInvites = createAsyncThunk<
  PendingCoParentInvite[],
  void,
  {rejectValue: string}
>('coParent/fetchPendingInvites', async (_, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await coParentApi.listPendingInvites({accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to load pending invites',
    );
  }
});

export const acceptCoParentInvite = createAsyncThunk<
  string,
  {token: string},
  {rejectValue: string}
>('coParent/acceptCoParentInvite', async ({token}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await coParentApi.acceptInvite({token, accessToken});
    return token;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to accept invite',
    );
  }
});

export const declineCoParentInvite = createAsyncThunk<
  string,
  {token: string},
  {rejectValue: string}
>('coParent/declineCoParentInvite', async ({token}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await coParentApi.declineInvite({token, accessToken});
    return token;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to decline invite',
    );
  }
});

export const fetchParentAccess = createAsyncThunk<
  ParentCompanionAccess[],
  {parentId: string; companionIds?: string[]},
  {rejectValue: string}
>('coParent/fetchParentAccess', async ({parentId, companionIds}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const links = await coParentApi.listByParent({parentId, accessToken});
    const normalized: ParentCompanionAccess[] = (links ?? []).map((link: any) => ({
      companionId: link?.companionId ?? link?.companion?.id ?? undefined,
      parentId: link?.parentId ?? parentId,
      role: link?.role ?? 'CO-PARENT',
      status: normalizeStatus(link?.status),
      permissions: normalizePermissions(link?.permissions),
    }));

    // If no companionId provided in links, resolve per companion in parallel
    if (companionIds && companionIds.length > 0) {
      const companionLinksPromises = companionIds.map(cid =>
        coParentApi
          .listByCompanion({companionId: cid, accessToken})
          .then(linksForCompanion => ({cid, linksForCompanion}))
          .catch(() => ({cid, linksForCompanion: []})),
      );

      const companionLinksResults = await Promise.all(companionLinksPromises);

      for (const {cid, linksForCompanion} of companionLinksResults) {
        const match = (linksForCompanion ?? []).find(
          (l: any) => (l?.parentId ?? l?.parent?.id) === parentId,
        );
        if (!match) {
          continue;
        }
        const alreadyMapped = normalized.some(entry => entry.companionId === cid);
        if (alreadyMapped) {
          continue;
        }
        normalized.push({
          companionId: cid,
          parentId,
          role: match.role ?? 'CO-PARENT',
          status: normalizeStatus(match.status),
          permissions: normalizePermissions(match.permissions),
        });
      }
    }

    return normalized;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch permissions',
    );
  }
});
