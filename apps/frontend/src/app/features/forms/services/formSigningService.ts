import axios from 'axios';
import api, { getData, postData } from '@/app/services/axios';

type StartSigningResponse = {
  documentId?: number | string;
  signingUrl?: string;
};

type SignedDocumentResponse = {
  pdf?: {
    downloadUrl?: string;
    filename?: string;
    contentType?: string;
  };
};

const isSubmissionNotSignedYetError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  if (status !== 400) {
    return false;
  }

  const responseData = error.response?.data;
  if (!responseData || typeof responseData !== 'object') {
    return false;
  }

  return (responseData as { message?: string }).message === 'Submission is not signed yet';
};

export const startFormSigning = async (submissionId: string): Promise<StartSigningResponse> => {
  const res = await postData<StartSigningResponse>(
    `/fhir/v1/form/form-submissions/${submissionId}/sign`
  );
  return res.data;
};

export const fetchSignedDocument = async (
  submissionId: string
): Promise<SignedDocumentResponse> => {
  const res = await getData<SignedDocumentResponse>(
    `/fhir/v1/form/form-submissions/${submissionId}/signed-document`
  );
  return res.data;
};

export const fetchSignedDocumentIfReady = async (
  submissionId: string
): Promise<SignedDocumentResponse | null> => {
  try {
    const res = await api.get<SignedDocumentResponse>(
      `/fhir/v1/form/form-submissions/${submissionId}/signed-document`
    );
    return res.data;
  } catch (error) {
    if (isSubmissionNotSignedYetError(error)) {
      return null;
    }
    throw error;
  }
};

export const downloadSubmissionPdf = async (submissionId: string): Promise<Blob> => {
  const signed = await fetchSignedDocument(submissionId);
  const downloadUrl = signed?.pdf?.downloadUrl;
  if (!downloadUrl) {
    throw new Error('Signed PDF not available');
  }
  const res = await fetch(downloadUrl, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      // Do not attach auth/org headers to S3 presigned URLs
      Accept: '*/*',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download signed PDF (${res.status})`);
  }
  return await res.blob();
};
