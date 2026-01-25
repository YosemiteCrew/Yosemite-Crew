import { CompanionRecord, SignedFile } from "../types/companionDocuments";
import { getData, postData } from "./axios";

export const createCompanionDocument = async (
  document: CompanionRecord,
  companionId: string,
) => {
  try {
    if (!companionId) {
      throw new Error("Companion ID missing");
    }
    await postData("/v1/document/pms/" + companionId, document);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const loadCompanionDocument = async (
  companionId: string,
): Promise<CompanionRecord[]> => {
  try {
    if (!companionId) {
      throw new Error("Companion ID missing");
    }
    const res = await getData<CompanionRecord[]>(
      "/v1/document/pms/" + companionId,
    );
    return res.data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const loadDocumentDetails = async (
  documentId: string,
): Promise<CompanionRecord> => {
  try {
    if (!documentId) {
      throw new Error("Document ID missing");
    }
    const res = await getData<CompanionRecord>(
      "/v1/document/pms/details/" + documentId,
    );
    return res.data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const loadDocumentDownloadURL = async (
  documentId: string | undefined,
): Promise<SignedFile[]> => {
  try {
    if (!documentId) {
      throw new Error("Document ID missing");
    }
    const res = await getData<SignedFile[]>(
      "/v1/document/pms/view/" + documentId,
    );
    return res.data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
