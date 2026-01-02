import { Documenso } from "@documenso/sdk-typescript";
import * as errors from "@documenso/sdk-typescript/models/errors";
import logger from "src/utils/logger";

// Replace with your self-hosted instance's URL, e.g., https://your-documenso-domain.com
const BASE_URL = process.env["DOCUMENSO_BASE_URL"] ?? "your-documenso-domain.com";

const documenso = new Documenso({
  apiKey: process.env["DOCUMENSO_API_KEY"] ?? "", // Ensure API key is set in environment variables
  serverURL: BASE_URL,
});

async function uploadPdfBuffer(
  pdf: Buffer,
  uploadUrl: string
) {
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
  }: {
    documentId: number;
  }) {
    try {
      const distributeResponse = await documenso.documents.distribute({
        documentId: documentId,
      })
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

  static async downloadSignedDocument(documentId: number) {
    try {
      const downloadResponse = await documenso.documents.download({
        documentId: documentId,
      });
      return downloadResponse;
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
}