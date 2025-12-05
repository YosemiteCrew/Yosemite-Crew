import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {documentApi} from '@/features/documents/services/documentService';
import type {DocumentFile} from '@/features/documents/types';
import {ensureAccessContext, toErrorMessage} from '@/shared/utils/serviceHelpers';

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
