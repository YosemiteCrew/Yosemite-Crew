import api, { getData, postData } from "./axios";

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

export const startFormSigning = async (
  submissionId: string,
): Promise<StartSigningResponse> => {
  const res = await postData<StartSigningResponse>(
    `/fhir/v1/form/form-submissions/${submissionId}/sign`,
  );
  return res.data;
};

export const fetchSignedDocument = async (
  submissionId: string,
): Promise<SignedDocumentResponse> => {
  const res = await getData<SignedDocumentResponse>(
    `/fhir/v1/form/form-submissions/${submissionId}/signed-document`,
  );
  return res.data;
};

export const downloadSubmissionPdf = async (
  submissionId: string,
): Promise<Blob> => {
  const signed = await fetchSignedDocument(submissionId);
  const downloadUrl = signed?.pdf?.downloadUrl;
  if (!downloadUrl) {
    throw new Error("Signed PDF not available");
  }
  const res = await fetch(downloadUrl, {
    method: "GET",
    credentials: "omit",
    headers: {
      // Do not attach auth/org headers to S3 presigned URLs
      Accept: "*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download signed PDF (${res.status})`);
  }
  return await res.blob();
};
