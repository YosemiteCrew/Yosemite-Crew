import { Documenso } from "@documenso/sdk-typescript";
import * as errors from "@documenso/sdk-typescript/models/errors/index.js";
import axios from "axios";
import { Types } from "mongoose";
import OrganizationModel from "src/models/organization";
import logger from "src/utils/logger";

// Replace with your self-hosted instance's URL, e.g., https://your-documenso-domain.com
const BASE_URL = process.env["DOCUMENSO_BASE_URL"] ?? "";
const API_KEY = process.env["DOCUMENSO_API_KEY"] ?? "";
const PUBLIC_BASE_URL = process.env["DOCUMENSO_HOST_URL"] ?? "";
const EXTERNAL_AUTH_SECRET = process.env["DOCUMENSO_EXTERNAL_AUTH_SECRET"] ?? "";

const documensoClients = new Map<string, Documenso>();

const getBaseUrl = () => {
  if (!BASE_URL) {
    throw new Error("DOCUMENSO_BASE_URL is not set");
  }

  try {
    return new URL(BASE_URL).toString();
  } catch {
    throw new Error("DOCUMENSO_BASE_URL is invalid");
  }
};

const getPublicBaseUrl = () => {
  if (!PUBLIC_BASE_URL) {
    throw new Error("DOCUMENSO_URL or DOCUMENSO_BASE_URL is not set");
  }

  try {
    new URL(PUBLIC_BASE_URL);
    return PUBLIC_BASE_URL;
  } catch {
    throw new Error("DOCUMENSO_URL is invalid");
  }
};

const getExternalAuthSecret = () => {
  if (!EXTERNAL_AUTH_SECRET) {
    throw new Error(
      "DOCUMENSO_EXTERNAL_AUTH_SECRET or EXTERNAL_AUTH_SECRET is not set",
    );
  }

  return EXTERNAL_AUTH_SECRET;
};

const getDocumensoClient = (apiKeyOverride?: string) => {
  const apiKey = apiKeyOverride ?? API_KEY;

  if (!apiKey) {
    throw new Error("DOCUMENSO_API_KEY is not set");
  }

  const cached = documensoClients.get(apiKey);

  if (cached) {
    return cached;
  }

  const client = new Documenso({
    apiKey,
    serverURL: getBaseUrl(),
  });

  documensoClients.set(apiKey, client);

  return client;
};

const buildOrganizationLookupQuery = (reference: string) => {
  const queries: Array<Record<string, string>> = [];

  if (Types.ObjectId.isValid(reference)) {
    queries.push({ _id: reference });
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(reference)) {
    queries.push({ fhirId: reference });
  }

  if (!queries.length) {
    return null;
  }

  return queries.length === 1 ? queries[0] : { $or: queries };
};

async function uploadPdfBuffer(pdf: Buffer, uploadUrl: string) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: new Uint8Array(pdf),
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": pdf.length.toString(),
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

export type SignedDocument = {
  downloadUrl?: string;
  filename?: string;
  contentType?: string;
};

export type DocumensoExternalRole = "ADMIN" | "MANAGER" | "MEMBER";

export class DocumensoService {
  static async createDocument({
    pdf,
    signerEmail,
    signerName,
    apiKey,
  }: {
    pdf: Buffer;
    signerEmail: string;
    signerName?: string;
    apiKey?: string;
  }) {
    try {
      const documenso = getDocumensoClient(apiKey);
      const createDocumentResponse = await documenso.documents.createV0({
        title: "Form Submission",
        recipients: [
          {
            email: signerEmail,
            name: signerName ?? signerEmail,
            role: "SIGNER",
            fields: [
              {
                type: "SIGNATURE",
                pageNumber: 1,
                pageX: 100,
                pageY: 100,
                width: 20,
                height: 10,
              },
            ],
          },
        ],
      });

      const { document, uploadUrl } = createDocumentResponse;

      await uploadPdfBuffer(pdf, uploadUrl);

      return document;
    } catch (error) {
      if (error instanceof errors.DocumensoError) {
        logger.error("API error:", error.message);
        logger.error("Status code:", error.statusCode);
        logger.error("Body:", error.body);
      } else {
        logger.error("An unexpected error occurred:", error);
      }
    }
  }

  static async distributeDocument({
    documentId,
    apiKey,
  }: {
    documentId: number;
    apiKey?: string;
  }) {
    try {
      const documenso = getDocumensoClient(apiKey);
      const distributeResponse = await documenso.documents.distribute({
        documentId: documentId,
      });
      console.log("Distribute Response:", distributeResponse);
      return distributeResponse;
    } catch (error) {
      if (error instanceof errors.DocumensoError) {
        logger.error("API error:", error.message);
        logger.error("Status code:", error.statusCode);
        logger.error("Body:", error.body);
      } else {
        logger.error("An unexpected error occurred:", error);
      }
    }
  }

  static async downloadSignedDocument({
    documentId,
    apiKey,
  }: {
    documentId: number;
    apiKey?: string;
  }): Promise<SignedDocument | undefined> {
    try {
      const baseUrl = getBaseUrl();
      const resolvedApiKey = apiKey ?? API_KEY;

      if (!resolvedApiKey) {
        throw new Error("DOCUMENSO_API_KEY is not set");
      }

      const downloadResponse = await axios.get(
        `${baseUrl}/document/${documentId}/download-beta`,
        {
          params: {
            version: "signed",
          },
          headers: {
            Authorization: resolvedApiKey,
          },
        },
      );

      const signeDocument = downloadResponse.data as SignedDocument;
      return signeDocument;
    } catch (error) {
      logger.error("An unexpected error occurred:", error);
    }
  }

  static async resolveOrganisationApiKey(organisationId: string) {
    const query = buildOrganizationLookupQuery(organisationId);

    if (!query) {
      throw new Error("Invalid organisation id");
    }

    const organisation = await OrganizationModel.findOne(query, {
      documensoApiKey: 1,
    }).lean();

    return organisation?.documensoApiKey ?? null;
  }

  static async generateExternalRedirectUrl({
    email,
    name,
    businessId,
    businessName,
    role,
  }: {
    email: string;
    name: string;
    businessId: string;
    businessName: string;
    role: DocumensoExternalRole;
  }): Promise<string> {
    try {
      const baseUrl = getPublicBaseUrl();
      const externalSecret = getExternalAuthSecret();

      const response = await axios.post(
        `${baseUrl}/api/auth/external/generate-token`,
        {
          email,
          name,
          businessId,
          businessName,
          role,
          externalSecret,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const data = response.data as { redirectUrl?: string };

      if (!data?.redirectUrl) {
        throw new Error("Documenso redirect url missing");
      }

      return `${baseUrl}${data.redirectUrl}`;
    } catch (error) {
      logger.error("Documenso external auth error:", error);
      throw error;
    }
  }
}
