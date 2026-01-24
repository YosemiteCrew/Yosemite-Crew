import { Documenso } from "@documenso/sdk-typescript";
import * as errors from "@documenso/sdk-typescript/models/errors/index.js";
import axios from "axios";
import logger from "src/utils/logger";

// Replace with your self-hosted instance's URL, e.g., https://your-documenso-domain.com
const BASE_URL = process.env["DOCUMENSO_BASE_URL"] ?? "";
const API_KEY = process.env["DOCUMENSO_API_KEY"] ?? "";
const PUBLIC_BASE_URL = process.env["DOCUMENSO_HOST_URL"] ?? "";
const EXTERNAL_AUTH_SECRET = process.env["DOCUMENSO_EXTERNAL_AUTH_SECRET"] ?? "";

let documensoClient: Documenso | undefined;

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

const getDocumensoClient = () => {
  documensoClient ??= new Documenso({
      apiKey: API_KEY, // Ensure API key is set in environment variables
      serverURL: getBaseUrl(),
    });

  return documensoClient;
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
  }: {
    pdf: Buffer;
    signerEmail: string;
    signerName?: string;
  }) {
    try {
      const documenso = getDocumensoClient();
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

  static async distributeDocument({ documentId }: { documentId: number }) {
    try {
      const documenso = getDocumensoClient();
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

  static async downloadSignedDocument(
    documentId: number,
  ): Promise<SignedDocument | undefined> {
    try {
      const baseUrl = getBaseUrl();
      const downloadResponse = await axios.get(
        `${baseUrl}/document/${documentId}/download-beta`,
        {
          params: {
            version: "signed",
          },
          headers: {
            Authorization: API_KEY,
          },
        },
      );

      const signeDocument = downloadResponse.data as SignedDocument;
      return signeDocument;
    } catch (error) {
      logger.error("An unexpected error occurred:", error);
    }
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
