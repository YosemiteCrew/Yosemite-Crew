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
  const res = await api.get<Blob>(
    `/fhir/v1/form/form-submissions/${submissionId}/pdf`,
    {
      responseType: "blob",
    },
  );
  return res.data;
};
