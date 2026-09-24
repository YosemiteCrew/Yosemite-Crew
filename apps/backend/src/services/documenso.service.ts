import { Documenso } from "@documenso/sdk-typescript";
import { SDK_METADATA } from "@documenso/sdk-typescript/lib/config.js";
import * as errors from "@documenso/sdk-typescript/models/errors/index.js";
import axios from "axios";
import { z } from "zod";
import type { ClinicalPdfSignaturePlacement } from "@yosemite-crew/lib";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

// Replace with your self-hosted instance's URL, e.g., https://your-documenso-domain.com
const BASE_URL = process.env["DOCUMENSO_BASE_URL"] ?? "";
const API_KEY = process.env["DOCUMENSO_API_KEY"] ?? "";
const PUBLIC_BASE_URL = process.env["DOCUMENSO_HOST_URL"] ?? "";
const EXTERNAL_AUTH_SECRET =
  process.env["DOCUMENSO_EXTERNAL_AUTH_SECRET"] ?? "";

const documensoClients = new Map<string, Documenso>();

// Documenso positions fields as percentages (0–100) of the page from the
// top-left, not PDF points. Last-resort fallback when a caller provides no
// placement; real placements come from the PDF renderers as percentages.
const DEFAULT_SIGNATURE_PLACEMENT: ClinicalPdfSignaturePlacement = {
  pageNumber: 1,
  pageX: 55.44,
  pageY: 83.15,
  width: 36.96,
  height: 11.4,
};

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

const resolveApiKey = (apiKeyOverride?: string) => {
  const apiKey = apiKeyOverride ?? API_KEY;

  if (!apiKey) {
    throw new Error("DOCUMENSO_API_KEY is not set");
  }

  return apiKey;
};

const getDocumensoClient = (apiKeyOverride?: string) => {
  const apiKey = resolveApiKey(apiKeyOverride);

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

export type SignedDocument = {
  downloadUrl?: string;
  filename?: string;
  contentType?: string;
};

export type DocumensoExternalRole = "ADMIN" | "MANAGER" | "MEMBER";

/**
 * What is safe to log about a failed request.
 *
 * The raw error must never be logged here. Axios attaches the outbound request
 * to the error as `config`, so an axios error from this file carries the
 * Documenso API key in `config.headers.Authorization`, and the one from
 * `generateExternalRedirectUrl` carries the external auth secret in
 * `config.data`. The logger does not redact either: its production format is
 * `json()`, which serialises the whole meta object, and the development
 * format's field list replaces `req`, `res`, `request` and `response` but not
 * `config` - it exists to keep log lines small, not to redact.
 *
 * So the first time a Documenso call fails is the first time the credential is
 * written out. The SDK calls in this file log `.message` and `.statusCode`;
 * this is the same treatment for the axios ones.
 */
const describeError = (error: unknown) => {
  // Read the status structurally rather than through `axios.isAxiosError`: the
  // status is worth having and that helper is a module export a test double
  // replaces, so depending on it makes the useful half of this untestable in
  // the suite that has to prove the rest of it.
  const response =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: number } }).response
      : undefined;

  return {
    message: error instanceof Error ? error.message : String(error),
    status: response?.status,
  };
};

/**
 * Not `error.body`: when the SDK cannot parse a 2xx response, that body is the
 * raw response, and an envelope or distribute response lists every
 * recipient's signing token. An APIError's message already carries its error
 * body, which holds no token.
 */
const logDocumensoFailure = (error: unknown) => {
  if (error instanceof errors.DocumensoError) {
    logger.error("API error:", error.message);
    logger.error("Status code:", error.statusCode);
  } else {
    logger.error("An unexpected error occurred:", describeError(error));
  }
};

/*
 * The envelope reads below go around the SDK. SDK 0.9.1's response schemas
 * require fields that the Documenso 2.4.0 production runs does not have
 * (recipients[].expiresAt, documentMeta.envelopeExpirationPeriod,
 * envelopeItems[].documentDataId), so the SDK rejects every envelope 2.4.0
 * returns. The create goes around it too, because its documents.create is
 * deprecated. These schemas hold only what this service reads.
 */
const DocumentCreatedSchema = z.object({
  envelopeId: z.string(),
  id: z.number(),
});

const EnvelopeRecipientsSchema = z.object({
  recipients: z.array(z.looseObject({ token: z.string() })),
});

const DocumentStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);

const EnvelopeStatusesSchema = z.object({
  data: z.array(z.object({ status: DocumentStatusSchema })),
});

// Joined as the SDK joins it: the path goes under the base URL's own path.
const apiUrl = (path: string) => {
  const base = new URL(getBaseUrl());
  if (!base.pathname.endsWith("/")) {
    base.pathname += "/";
  }
  return new URL(path, base).toString();
};

export class DocumensoService {
  static async createDocument({
    pdf,
    signerEmail,
    signerName,
    apiKey,
    signaturePlacement,
    title,
  }: {
    pdf: Buffer;
    signerEmail: string;
    signerName?: string;
    apiKey?: string;
    signaturePlacement?: ClinicalPdfSignaturePlacement;
    title?: string;
  }) {
    try {
      const Authorization = resolveApiKey(apiKey);
      const url = apiUrl("document/create");
      const placement = signaturePlacement ?? DEFAULT_SIGNATURE_PLACEMENT;
      logger.info("Creating document with signature placement", {
        placement,
      });
      const payload = {
        title: title ?? "Form Submission",
        recipients: [
          {
            email: signerEmail,
            name: signerName ?? signerEmail,
            role: "SIGNER" as const,
            fields: [
              {
                type: "SIGNATURE" as const,
                pageNumber: placement.pageNumber,
                pageX: placement.pageX,
                pageY: placement.pageY,
                width: placement.width,
                height: placement.height,
              },
            ],
          },
        ],
      };
      // The request the SDK's deprecated documents.create sent, part for part:
      // the same route, which makes an internalVersion 1 envelope. The SDK's
      // envelopes.create makes an internalVersion 2 one, which Documenso signs
      // through a different page and seals differently.
      const form = new FormData();
      // Copied, as the SDK did: a Buffer can be a view into a larger pool.
      const file = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
      form.append("file", file, "document.pdf");
      form.append("payload", JSON.stringify(payload));
      const { data: createResponse } = await axios.post<unknown>(url, form, {
        headers: {
          Accept: "application/json",
          Authorization,
          // Documenso writes the user agent into the document's audit log.
          "User-Agent": SDK_METADATA.userAgent,
        },
      });
      const created = DocumentCreatedSchema.parse(createResponse);
      const { data: envelope } = await axios.get<unknown>(
        apiUrl(`envelope/${encodeURIComponent(created.envelopeId)}`),
        { headers: { Authorization } },
      );
      const { recipients } = EnvelopeRecipientsSchema.parse(envelope);

      // Callers persist the numeric document id (webhooks carry it) and hand
      // the envelope id straight back to distributeDocument.
      return {
        id: created.id,
        envelopeId: created.envelopeId,
        recipients,
      };
    } catch (error) {
      logDocumensoFailure(error);
    }
  }

  static async distributeDocument({
    envelopeId,
    apiKey,
  }: {
    envelopeId: string;
    apiKey?: string;
  }) {
    try {
      const documenso = getDocumensoClient(apiKey);
      const distributeResponse = await documenso.envelopes.distribute({
        envelopeId,
      });
      // Not the response itself: it carries each recipient's signing token.
      logger.info("Documenso envelope distributed", { envelopeId });
      return distributeResponse;
    } catch (error) {
      logDocumensoFailure(error);
    }
  }

  /**
   * Read a document's authoritative signing state from Documenso.
   *
   * Unlike the other read paths in this service, a failure here is rethrown
   * rather than swallowed: the returned status gates whether a packet may be
   * recorded as legally signed, so "Documenso could not be asked" must never be
   * collapsible into an answer. Callers decide what a non-COMPLETED status
   * means; they may not mistake an outage for one.
   */
  static async getDocumentStatus({
    documentId,
    apiKey,
  }: {
    documentId: number;
    apiKey?: string;
  }): Promise<z.infer<typeof DocumentStatusSchema>> {
    try {
      const Authorization = resolveApiKey(apiKey);
      // The only lookup the envelope API offers by the numeric id we persist.
      const { data: response } = await axios.post<unknown>(
        apiUrl("envelope/get-many"),
        { ids: { type: "documentId", ids: [documentId] } },
        { headers: { Authorization } },
      );
      const [envelope] = EnvelopeStatusesSchema.parse(response).data;
      if (!envelope) {
        throw new Error(`Documenso document ${documentId} not found`);
      }
      return envelope.status;
    } catch (error) {
      logDocumensoFailure(error);
      // Not the axios error itself: its request config holds the API key, and
      // callers log what they catch.
      throw new Error(describeError(error).message);
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
      logger.error(
        "Documenso signed-document download failed",
        describeError(error),
      );
    }
  }

  static async resolveOrganisationApiKey(organisationId: string) {
    const organisation = await prisma.organization.findFirst({
      where: {
        OR: [{ id: organisationId }, { fhirId: organisationId }],
      },
      select: { documensoApiKey: true },
    });

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
      logger.error("Documenso external auth error", describeError(error));
      throw error;
    }
  }
}
