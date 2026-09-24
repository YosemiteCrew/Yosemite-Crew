/* eslint-disable @typescript-eslint/no-var-requires */
/*
 * DocumensoService over real HTTP: the real SDK 0.9.1 and the real axios
 * against a local server on 127.0.0.1 that answers the way Documenso 2.4.0
 * (what production runs) answers. Nothing leaves this machine.
 *
 * createDocument used to call the SDK's deprecated documents.create. It now
 * posts to the same route itself, so the first block proves the request did
 * not change: the old call and the new code are sent side by side and what
 * the server received is compared.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Documenso } from "@documenso/sdk-typescript";
import logger from "../../src/utils/logger";

jest.mock("src/config/prisma", () => ({ prisma: {} }));
jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

type Placement = {
  pageNumber: number;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

type CreateInput = {
  pdf: Buffer;
  signerEmail: string;
  signerName?: string;
  apiKey?: string;
  signaturePlacement?: Placement;
  title?: string;
};

type Received = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

const API_KEY = "documenso-api-key-placeholder";
const TOKEN = "recipient-signing-token-placeholder";
const ENVELOPE_ID = "envelope_1";
const ts = "2026-09-24T08:00:00.000Z";

/*
 * Documenso 2.4.0's response shapes (its tRPC output schemas). "newer" adds
 * the fields later releases added and SDK 0.9.1 requires, so both have to
 * parse.
 */
const envelope = (status: string, shape: "2.4.0" | "newer") => {
  const newer = shape === "newer";
  return {
    internalVersion: 1,
    type: "DOCUMENT",
    status,
    source: "DOCUMENT",
    visibility: "EVERYONE",
    templateType: "PRIVATE",
    id: ENVELOPE_ID,
    secondaryId: "document_42",
    externalId: null,
    createdAt: ts,
    updatedAt: ts,
    completedAt: null,
    deletedAt: null,
    title: "Form Submission",
    authOptions: { globalAccessAuth: [], globalActionAuth: [] },
    formValues: null,
    publicTitle: "",
    publicDescription: "",
    userId: 7,
    teamId: 3,
    folderId: null,
    templateId: null,
    documentMeta: {
      signingOrder: "PARALLEL",
      distributionMethod: "EMAIL",
      id: "meta_1",
      subject: null,
      message: null,
      timezone: "Etc/UTC",
      dateFormat: "yyyy-MM-dd hh:mm a",
      redirectUrl: null,
      typedSignatureEnabled: true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
      allowDictateNextSigner: false,
      language: "en",
      emailSettings: null,
      emailId: null,
      emailReplyTo: null,
      ...(newer
        ? { envelopeExpirationPeriod: null, reminderSettings: null }
        : {}),
    },
    recipients: [
      {
        envelopeId: ENVELOPE_ID,
        role: "SIGNER",
        readStatus: "NOT_OPENED",
        signingStatus: "NOT_SIGNED",
        sendStatus: "NOT_SENT",
        id: 11,
        email: "vet@example.com",
        name: "Vet",
        token: TOKEN,
        documentDeletedAt: null,
        expired: null,
        signedAt: null,
        authOptions: { accessAuth: [], actionAuth: [] },
        signingOrder: null,
        rejectionReason: null,
        ...(newer ? { expiresAt: null, expirationNotifiedAt: null } : {}),
      },
    ],
    fields: [],
    envelopeItems: [
      {
        envelopeId: ENVELOPE_ID,
        id: "item_1",
        title: "document.pdf",
        order: 1,
        ...(newer ? { documentDataId: "data_1" } : {}),
      },
    ],
    directLink: null,
    team: { id: 3, url: "team" },
    user: { id: 7, name: "Owner", email: "owner@example.com" },
  };
};

const distributed = {
  success: true,
  id: ENVELOPE_ID,
  recipients: [
    {
      id: 11,
      name: "Vet",
      email: "vet@example.com",
      token: TOKEN,
      role: "SIGNER",
      signingOrder: null,
      signingUrl: `http://127.0.0.1/sign/${TOKEN}`,
    },
  ],
};

// Module loading under ts-jest is slow on a busy runner; the requests are not.
const TIMEOUT_MS = 30_000;

let received: Received[] = [];
let shape: "2.4.0" | "newer" = "2.4.0";
let createStatus = 200;
let server: http.Server;
let base = "";
let Service: any;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? "";
      received.push({
        method: req.method ?? "",
        url,
        headers: req.headers,
        body,
      });
      const json = (status: number, out: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
      };
      if (req.headers.authorization !== API_KEY) {
        return json(401, { message: "Unauthorized", code: "UNAUTHORIZED" });
      }
      if (req.method === "POST" && url === "/api/v2/document/create") {
        return createStatus === 200
          ? json(200, { envelopeId: ENVELOPE_ID, id: 42 })
          : json(createStatus, { message: "Bad request", code: "BAD_REQUEST" });
      }
      if (req.method === "GET" && url === `/api/v2/envelope/${ENVELOPE_ID}`) {
        return json(200, envelope("DRAFT", shape));
      }
      if (req.method === "POST" && url === "/api/v2/envelope/distribute") {
        return json(200, distributed);
      }
      if (req.method === "POST" && url === "/api/v2/envelope/get-many") {
        const { ids } = JSON.parse(body.toString());
        const hit = ids?.type === "documentId" && ids.ids?.[0] === 42;
        return json(200, { data: hit ? [envelope("COMPLETED", shape)] : [] });
      }
      return json(404, { message: "Not found", code: "NOT_FOUND" });
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2`;
  Service = loadService();
}, TIMEOUT_MS);

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  jest.clearAllMocks();
  received = [];
  shape = "2.4.0";
  createStatus = 200;
});

const loadService = () => {
  let mod: any;
  jest.isolateModules(() => {
    const original = process.env;
    process.env = {
      ...original,
      DOCUMENSO_BASE_URL: base,
      DOCUMENSO_API_KEY: API_KEY,
    };
    mod = require("../../src/services/documenso.service");
    process.env = original;
  });
  return mod.DocumensoService;
};

/*
 * The request side of the previous createDocument, unchanged: the payload it
 * built and the deprecated SDK call it made with it. This is the oracle.
 */
const legacyCreate = ({
  pdf,
  signerEmail,
  signerName,
  apiKey,
  signaturePlacement,
  title,
}: CreateInput) => {
  const placement = signaturePlacement ?? {
    pageNumber: 1,
    pageX: 55.44,
    pageY: 83.15,
    width: 36.96,
    height: 11.4,
  };
  const documenso = new Documenso({
    apiKey: apiKey ?? API_KEY,
    serverURL: base,
  });
  return documenso.documents.create({
    payload: {
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
    },
    file: { fileName: "document.pdf", content: new Uint8Array(pdf) },
  });
};

const createRequest = () => {
  const found = received.filter((r) => r.url.endsWith("/document/create"));
  expect(found).toHaveLength(1);
  return found[0];
};

const boundaryOf = (request: Received) =>
  /^multipart\/form-data; boundary=(.+)$/.exec(
    request.headers["content-type"] ?? "",
  )?.[1];

// The body with its random multipart boundary replaced by a fixed marker.
const bodyWithoutBoundary = (request: Received) => {
  const boundary = boundaryOf(request);
  expect(boundary).toBeTruthy();
  return request.body
    .toString("latin1")
    .split(boundary as string)
    .join("<boundary>");
};

/*
 * Headers each HTTP client sets for itself, which do not change what Documenso
 * does with the request: the multipart boundary and length, compression,
 * fetch's own defaults, and the empty cookie header the SDK always adds
 * (asserted empty below).
 */
const CLIENT_HEADERS = new Set([
  "host",
  "connection",
  "content-type",
  "content-length",
  "accept-encoding",
  "accept-language",
  "sec-fetch-mode",
  "cookie",
]);

// Binary on purpose: CR, LF, NUL, 0xFF and a boundary-like "--" line.
const binaryPdf = () =>
  Buffer.concat([
    Buffer.from("%PDF-1.4\r\n%âãÏÓ\n--\r\n", "latin1"),
    Buffer.from([0x00, 0xff, 0x0d, 0x0a, 0x2d, 0x2d, 0x7f]),
    Buffer.from("\n%%EOF\n"),
  ]);

describe("DocumensoService.createDocument request", () => {
  it.each<[string, () => CreateInput]>([
    [
      "defaults (no name, placement or title)",
      () => ({ pdf: binaryPdf(), signerEmail: "vet@example.com" }),
    ],
    [
      "every option set, non-ASCII text, an organisation key",
      () => ({
        pdf: binaryPdf(),
        signerEmail: "ana@example.com",
        signerName: "Dr. Ana Núñez 🐾",
        apiKey: API_KEY,
        title: 'Vaccination record, Rex "the brave"\nline two',
        signaturePlacement: {
          pageNumber: 2,
          pageX: 59.66,
          pageY: 60.21,
          width: 36.97,
          height: 2.85,
        },
      }),
    ],
    [
      "a PDF larger than one buffer pool",
      () => ({
        pdf: Buffer.from(
          Array.from({ length: 200_000 }, (_, i) => (i * 31 + 7) % 256),
        ),
        signerEmail: "vet@example.com",
      }),
    ],
  ])(
    "is the request the SDK's documents.create sent: %s",
    async (_label, input) => {
      await expect(legacyCreate(input())).resolves.toEqual({
        envelopeId: ENVELOPE_ID,
        id: 42,
      });
      const legacy = createRequest();

      received = [];
      const result = await Service.createDocument(input());
      expect(result).toEqual(
        expect.objectContaining({ id: 42, envelopeId: ENVELOPE_ID }),
      );
      const next = createRequest();

      expect(next.method).toBe("POST");
      expect(next.method).toBe(legacy.method);
      expect(next.url).toBe("/api/v2/document/create");
      expect(next.url).toBe(legacy.url);

      // What Documenso reads: the key, what the client accepts, the agent it
      // writes into the document's audit log, and the body's media type.
      expect(next.headers.authorization).toBe(API_KEY);
      expect(next.headers.accept).toBe("application/json");
      for (const name of ["authorization", "accept", "user-agent"]) {
        expect(next.headers[name]).toBe(legacy.headers[name]);
      }
      expect(next.headers["user-agent"]).toMatch(/@documenso\/sdk-typescript$/);
      expect(boundaryOf(next)).toBeTruthy();

      // No other header differs, and the SDK's cookie header carried nothing.
      expect(legacy.headers.cookie ?? "").toBe("");
      const names = new Set([
        ...Object.keys(legacy.headers),
        ...Object.keys(next.headers),
      ]);
      const differing = [...names].filter(
        (name) =>
          String(legacy.headers[name]) !== String(next.headers[name]) &&
          !CLIENT_HEADERS.has(name),
      );
      expect(differing).toEqual([]);

      // The body, byte for byte, but for the random boundary.
      expect(bodyWithoutBoundary(next)).toBe(bodyWithoutBoundary(legacy));

      // And parsed the way Documenso's route parses it (fetch FormData).
      const form = await new Response(new Uint8Array(next.body), {
        headers: { "content-type": next.headers["content-type"] as string },
      }).formData();
      expect([...form.keys()]).toEqual(["file", "payload"]);
      const file = form.get("file") as File;
      expect(file.name).toBe("document.pdf");
      expect(file.type).toBe("application/pdf");
      expect(Buffer.from(await file.arrayBuffer()).equals(input().pdf)).toBe(
        true,
      );
      expect(JSON.parse(form.get("payload") as string)).toEqual(
        expect.objectContaining({
          title: input().title ?? "Form Submission",
          recipients: [expect.objectContaining({ email: input().signerEmail })],
        }),
      );
    },
    TIMEOUT_MS,
  );
});

describe("DocumensoService against Documenso 2.4.0 responses", () => {
  it.each(["2.4.0", "newer"] as const)(
    "creates, distributes and reads the status (%s shape)",
    async (serverShape) => {
      shape = serverShape;

      const created = await Service.createDocument({
        pdf: binaryPdf(),
        signerEmail: "vet@example.com",
      });
      expect(created).toEqual({
        id: 42,
        envelopeId: ENVELOPE_ID,
        recipients: [expect.objectContaining({ id: 11, token: TOKEN })],
      });

      await expect(
        Service.distributeDocument({ envelopeId: created.envelopeId }),
      ).resolves.toEqual(expect.objectContaining({ success: true }));

      await expect(
        Service.getDocumentStatus({ documentId: created.id }),
      ).resolves.toBe("COMPLETED");

      expect(received.map((r) => `${r.method} ${r.url}`)).toEqual([
        "POST /api/v2/document/create",
        `GET /api/v2/envelope/${ENVELOPE_ID}`,
        "POST /api/v2/envelope/distribute",
        "POST /api/v2/envelope/get-many",
      ]);
      expect(logger.error).not.toHaveBeenCalled();
      const logged = JSON.stringify([
        (logger.info as jest.Mock).mock.calls,
        (logger.error as jest.Mock).mock.calls,
      ]);
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(API_KEY);
    },
    TIMEOUT_MS,
  );

  it.each([400, 401])(
    "returns nothing and logs no key or body when the create answers %i",
    async (status) => {
      createStatus = status;

      const created = await Service.createDocument({
        pdf: binaryPdf(),
        signerEmail: "vet@example.com",
        apiKey: status === 401 ? "revoked-key-placeholder" : API_KEY,
      });

      expect(created).toBeUndefined();
      expect(received.map((r) => `${r.method} ${r.url}`)).toEqual([
        "POST /api/v2/document/create",
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        { message: `Request failed with status code ${status}`, status },
      );
      const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
      expect(logged).not.toContain(API_KEY);
      expect(logged).not.toContain("revoked-key-placeholder");
      expect(logged).not.toContain("Bad request");
    },
    TIMEOUT_MS,
  );
});
