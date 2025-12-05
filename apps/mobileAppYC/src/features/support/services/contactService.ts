import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {documentApi} from '@/features/documents/services/documentService';
import type {DocumentFile} from '@/features/documents/types';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';

export type ContactType =
  | 'GENERAL_ENQUIRY'
  | 'FEATURE_REQUEST'
  | 'COMPLAINT'
  | 'DSAR';

export interface ContactAttachmentPayload {
  url: string;
  name?: string | null;
}

export interface DsarDetailsPayload {
  requesterType: string;
  lawBasis: string;
  rightsRequested: string[];
  declarationAccepted: boolean;
  otherLawNotes?: string;
  otherRequestNotes?: string;
}

export interface ContactRequestPayload {
  type: ContactType;
  subject: string;
  message: string;
  parentId?: string | null;
  companionId?: string | null;
  source?: string;
  attachments?: ContactAttachmentPayload[];
  dsarDetails?: DsarDetailsPayload;
}

export const CONTACT_SOURCE = 'MOBILE_APP';

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const maybeMessage =
      (error as any)?.response?.data?.message ??
      (error as any)?.message ??
      (error as any)?.error;
    if (maybeMessage && typeof maybeMessage === 'string') {
      return maybeMessage;
    }
  }
  return fallback;
};

const ensureAccessContext = async (): Promise<{
  accessToken: string;
  userId: string | null;
}> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return {accessToken, userId: tokens?.userId ?? null};
};

const ensureFilesReady = (files: DocumentFile[]) => {
  const notReady = files.filter(file => {
    if (file.key) {
      return false;
    }
    if (!file.uri?.trim()) {
      return true;
    }
    if (file.status && file.status !== 'ready') {
      return true;
    }
    return false;
  });

  if (notReady.length) {
    throw new Error(
      'Some files are still preparing or could not be read. Please reselect and try again.',
    );
  }
};

const mapFileToAttachment = (
  file: DocumentFile,
): ContactAttachmentPayload | null => {
  const url = file.downloadUrl ?? file.viewUrl ?? file.s3Url ?? null;
  if (!url) {
    return null;
  }
  return {
    url,
    name: file.name,
  };
};

export const uploadContactAttachments = async ({
  files,
  companionId,
}: {
  files: DocumentFile[];
  companionId: string;
}): Promise<{
  uploaded: DocumentFile[];
  attachments: ContactAttachmentPayload[];
}> => {
  if (!files.length) {
    return {uploaded: [], attachments: []};
  }

  if (!companionId) {
    throw new Error('Please add a pet profile before uploading attachments.');
  }

  ensureFilesReady(files);
  const {accessToken} = await ensureAccessContext();

  const uploaded: DocumentFile[] = [];

  for (const file of files) {
    const uploadedFile = await documentApi.uploadAttachment({
      file,
      companionId,
      accessToken,
    });
    uploaded.push(uploadedFile);
  }

  const attachments = uploaded
    .map(mapFileToAttachment)
    .filter(Boolean) as ContactAttachmentPayload[];

  return {uploaded, attachments};
};

export const contactService = {
  async submitContact(payload: ContactRequestPayload) {
    try {
      const {accessToken, userId} = await ensureAccessContext();
      const body = {
        ...payload,
        source: payload.source ?? CONTACT_SOURCE,
      };

      const headers = withAuthHeaders(
        accessToken,
        userId ? {'x-user-id': userId} : undefined,
      );

      const {data} = await apiClient.post(
        '/v1/contact-us/contact',
        body,
        {headers},
      );
      return data;
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Failed to submit your request.'));
    }
  },
};
