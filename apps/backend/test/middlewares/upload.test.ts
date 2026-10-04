import { Readable } from "node:stream";
import { createServer, request } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { sdkStreamMixin } from "@smithy/util-stream";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  handleFileUpload,
  handleMultipleFileUpload,
  uploadToS3,
  uploadBufferAsFile,
  generatePresignedUrl,
  moveFile,
  deleteFromS3,
  buildS3Key,
  mimeTypeToExtension,
  setupLifecyclePolicy,
  generatePresignedDownloadUrl,
  isAllowedMimeType,
  isValidPdfUpload,
  ATTACHMENT_MIME_TYPES,
  IMAGE_ONLY_MIME_TYPES,
  readObjectBounded,
} from "../../src/middlewares/upload";
import { tempUploadPrefixFor } from "../../src/utils/upload-key";

// --- 1. Mocks ---
// All mocks must be defined INSIDE the factory or via mock variables to avoid hoisting issues.
const mockS3Upload = jest.fn();
const mockGetSignedUrlPromise = jest.fn();
const mockCopyObject = jest.fn();
const mockDeleteObject = jest.fn();
const mockGetBucketLifecycleConfiguration = jest.fn();
const mockPutBucketLifecycleConfiguration = jest.fn();
const mockHeadObject = jest.fn();
const mockGetObject = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  return {
    ...jest.requireActual("@aws-sdk/client-s3"),
    S3: jest.fn().mockImplementation((config) => ({
      config,
      copyObject: (params: unknown) => mockCopyObject(params),
      deleteObject: (params: unknown) => mockDeleteObject(params),
      getBucketLifecycleConfiguration: (params: unknown) =>
        mockGetBucketLifecycleConfiguration(params),
      putBucketLifecycleConfiguration: (params: unknown) =>
        mockPutBucketLifecycleConfiguration(params),
      headObject: (params: unknown) => mockHeadObject(params),
      getObject: (params: unknown) => mockGetObject(params),
    })),
  };
});

jest.mock("@aws-sdk/lib-storage", () => ({
  Upload: jest
    .fn()
    .mockImplementation(({ params }) => ({ done: () => mockS3Upload(params) })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrlPromise(...args),
}));

jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

describe("Upload Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.AWS_S3_BUCKET_NAME = "test-bucket";
    process.env.AWS_CLOUD_FRONT_BASE_URL = "test-cf.cloudfront.net";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_REGION = "us-east-1";

    // Silence console logs/errors to keep test output clean
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("Environment Variables Validation", () => {
    it("throws if AWS_S3_BUCKET_NAME is missing", async () => {
      delete process.env.AWS_S3_BUCKET_NAME;
      await expect(deleteFromS3("key")).rejects.toThrow(
        "AWS_S3_BUCKET_NAME is not defined",
      );
    });

    it("throws if AWS_CLOUD_FRONT_BASE_URL is missing", async () => {
      delete process.env.AWS_CLOUD_FRONT_BASE_URL;
      await expect(generatePresignedDownloadUrl("key")).rejects.toThrow(
        "AWS_CLOUD_FRONT_BASE_URL is not defined",
      );
    });
  });

  describe("mimeTypeToExtension", () => {
    it("maps all supported mime types correctly", () => {
      expect(mimeTypeToExtension("image/jpeg")).toBe(".jpg");
      expect(mimeTypeToExtension("image/jpg")).toBe(".jpg");
      expect(mimeTypeToExtension("image/png")).toBe(".png");
      expect(mimeTypeToExtension("application/pdf")).toBe(".pdf");
      expect(
        mimeTypeToExtension(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).toBe(".docx");
      expect(mimeTypeToExtension("application/msword")).toBe(".doc");
      expect(mimeTypeToExtension("application/vnd.ms-excel")).toBe(".xls");
      expect(
        mimeTypeToExtension(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe(".xlsx");
      expect(mimeTypeToExtension("application/vnd.ms-powerpoint")).toBe(".ppt");
      expect(
        mimeTypeToExtension(
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
      ).toBe(".pptx");
    });

    it("returns empty string for unknown mime types", () => {
      expect(mimeTypeToExtension("unknown/type")).toBe("");
    });
  });

  describe("isValidPdfUpload", () => {
    it("accepts only real PDF files no larger than 20 MB", () => {
      const validFile = {
        mimetype: "application/pdf",
        size: 8,
        data: Buffer.from("%PDF-1.7"),
      };

      expect(isValidPdfUpload(validFile)).toBe(true);
      expect(
        isValidPdfUpload({ ...validFile, data: Buffer.from("not pdf") }),
      ).toBe(false);
      expect(isValidPdfUpload({ ...validFile, mimetype: "image/png" })).toBe(
        false,
      );
      expect(
        isValidPdfUpload({ ...validFile, size: 20 * 1024 * 1024 + 1 }),
      ).toBe(false);
    });
  });

  describe("buildS3Key", () => {
    it("builds correct paths for all folder types", () => {
      expect(buildS3Key("temp", "123", "image/png")).toBe(
        `${tempUploadPrefixFor("123")}mock-uuid.png`,
      );
      expect(buildS3Key("user", "123", "image/jpeg")).toBe(
        "users/123/mock-uuid.jpg",
      );
      expect(buildS3Key("org", "123", "application/pdf")).toBe(
        "orgs/123/mock-uuid.pdf",
      );
      expect(buildS3Key("parent", "123", undefined)).toBe(
        "parent/123/mock-uuid",
      ); // No mimeType
      expect(buildS3Key("companion", "123")).toBe("companion/123/mock-uuid");
      expect(buildS3Key("custom", "folder")).toBe("folder/mock-uuid");
    });

    it("throws on invalid type", () => {
      expect(() => buildS3Key("invalid" as any, "123")).toThrow(
        "Invalid upload type",
      );
    });

    it.each([
      ["no uploader", undefined],
      ["an empty uploader", ""],
    ])("refuses a fresh upload key for %s", (_label, uploaderId) => {
      expect(() => buildS3Key("temp", uploaderId, "image/png")).toThrow(
        "A fresh upload needs its uploader.",
      );
    });
  });

  describe("uploadToS3", () => {
    it.each([false, true])(
      "handles multipart upload with a failed part: %s",
      async (failPart) => {
        const sdk =
          jest.requireActual<typeof import("@aws-sdk/client-s3")>(
            "@aws-sdk/client-s3",
          );
        const { Upload: ActualUpload } = jest.requireActual(
          "@aws-sdk/lib-storage",
        );
        const { Upload } = jest.requireMock("@aws-sdk/lib-storage");
        const client = new sdk.S3Client({ region: "us-east-1" });
        const body = Buffer.alloc(6 * 1024 * 1024, 7);
        const send = jest
          .spyOn(client, "send")
          .mockImplementation(async (command: unknown) => {
            if (command instanceof sdk.CreateMultipartUploadCommand)
              return { UploadId: "upload-1" };
            if (command instanceof sdk.UploadPartCommand) {
              if (failPart) throw new Error("Part upload failed");
              return { ETag: `part-${command.input.PartNumber}` };
            }
            if (command instanceof sdk.CompleteMultipartUploadCommand)
              return { Location: "https://files.example/report.pdf" };
            if (command instanceof sdk.AbortMultipartUploadCommand) return {};
            throw new Error("Unexpected upload command");
          });
        Upload.mockImplementationOnce(
          ({ params }: { params: unknown }) =>
            new ActualUpload({ client, params }),
        );
        try {
          const upload = uploadToS3("report.pdf", body, "application/pdf");
          if (failPart) {
            await expect(upload).rejects.toThrow("Part upload failed");
            expect(
              send.mock.calls.some(
                ([command]) =>
                  command instanceof sdk.AbortMultipartUploadCommand,
              ),
            ).toBe(true);
            expect(
              send.mock.calls.some(
                ([command]) =>
                  command instanceof sdk.CompleteMultipartUploadCommand,
              ),
            ).toBe(false);
          } else {
            await expect(upload).resolves.toEqual({
              location: "https://files.example/report.pdf",
              key: "report.pdf",
            });
            const parts = send.mock.calls
              .map(([command]) => command)
              .filter((command) => command instanceof sdk.UploadPartCommand);
            expect(
              parts
                .map((part) =>
                  Buffer.isBuffer(part.input.Body)
                    ? part.input.Body.byteLength
                    : 0,
                )
                .sort((a, b) => a - b),
            ).toEqual([1024 * 1024, 5 * 1024 * 1024]);
            expect(
              send.mock.calls
                .map(([command]) => command)
                .find(
                  (command) =>
                    command instanceof sdk.CreateMultipartUploadCommand,
                )?.input,
            ).toMatchObject({
              Bucket: "test-bucket",
              Key: "report.pdf",
              ContentType: "application/pdf",
              ContentDisposition: "inline",
            });
          }
        } finally {
          send.mockRestore();
          client.destroy();
        }
      },
    );
    it("rejects a completed upload without a file location", async () => {
      mockS3Upload.mockResolvedValueOnce({ Key: "file.png" });
      await expect(uploadToS3("file.png", "", "image/png")).rejects.toThrow(
        "Upload location unavailable.",
      );
    });
    it("uploads and returns location and key", async () => {
      mockS3Upload.mockResolvedValueOnce({
        Location: "s3://loc",
        Key: "file.png",
      });
      const res = await uploadToS3(
        "file.png",
        Buffer.from("test"),
        "image/png",
      );
      expect(res).toEqual({ location: "s3://loc", key: "file.png" });
    });

    it("throws and parses generic Error object correctly", async () => {
      mockS3Upload.mockRejectedValueOnce(new Error("Upload Timeout"));
      await expect(uploadToS3("file.png", "", "image/png")).rejects.toThrow(
        "S3 upload failed: Upload Timeout",
      );
    });

    it("throws and parses string error correctly (getErrorMessage fallback)", async () => {
      mockS3Upload.mockRejectedValueOnce("String error");
      await expect(uploadToS3("file.png", "", "image/png")).rejects.toThrow(
        "S3 upload failed: Unknown error",
      );
    });
  });

  describe("uploadBufferAsFile", () => {
    it("throws if mime type is unsupported", async () => {
      await expect(
        uploadBufferAsFile(Buffer.from(""), {
          folderName: "test",
          mimeType: "text/html",
        }),
      ).rejects.toThrow("Unsupported file type.");
    });

    it("uploads buffer and defaults to 'file' if originalName missing", async () => {
      mockS3Upload.mockResolvedValueOnce({ Location: "s3://loc", Key: "key" });
      const res = await uploadBufferAsFile(Buffer.from(""), {
        folderName: "test",
        mimeType: "image/png",
      });
      expect(res.originalname).toBe("file.png");
    });

    it("appends extension if originalName lacks it", async () => {
      mockS3Upload.mockResolvedValueOnce({ Location: "s3://loc", Key: "key" });
      const res = await uploadBufferAsFile(Buffer.from(""), {
        folderName: "test",
        mimeType: "image/png",
        originalName: "my_pic",
      });
      expect(res.originalname).toBe("my_pic.png");
    });

    it("does not duplicate extension if originalName has it", async () => {
      mockS3Upload.mockResolvedValueOnce({ Location: "s3://loc", Key: "key" });
      const res = await uploadBufferAsFile(Buffer.from(""), {
        folderName: "test",
        mimeType: "application/pdf",
        originalName: "doc.pdf",
      });
      expect(res.originalname).toBe("doc.pdf");
    });
  });

  describe("generatePresignedUrl", () => {
    it("allows a non-empty PUT through an installed-client upload URL", async () => {
      const sdk =
        jest.requireActual<typeof import("@aws-sdk/client-s3")>(
          "@aws-sdk/client-s3",
        );
      const { getSignedUrl } = jest.requireActual(
        "@aws-sdk/s3-request-presigner",
      );
      const body = Buffer.from("uploaded picture content");
      let received = Buffer.alloc(0);
      const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        received = Buffer.concat(chunks);
        const url = new URL(req.url!, "http://localhost");
        res.statusCode = url.searchParams.has("x-amz-checksum-crc32")
          ? 400
          : 200;
        res.end();
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      let client: InstanceType<typeof sdk.S3Client> | undefined;
      mockGetSignedUrlPromise.mockImplementationOnce(
        (configured, command, options) => {
          client = new sdk.S3Client({
            ...configured.config,
            region: "us-east-1",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
          });
          return getSignedUrl(client, command, options);
        },
      );
      try {
        const result = await generatePresignedUrl(
          "image/jpeg",
          "user",
          "user-1",
        );
        const signed = new URL(result.url);
        const port = (server.address() as AddressInfo).port;
        const status = await new Promise<number | undefined>(
          (resolve, reject) => {
            const upload = request(
              {
                hostname: "127.0.0.1",
                port,
                path: signed.pathname + signed.search,
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
              },
              (res) => {
                res.resume();
                res.on("end", () => resolve(res.statusCode));
              },
            );
            upload.on("error", reject);
            upload.end(body);
          },
        );
        expect(status).toBe(200);
        expect(received).toEqual(body);
        expect(signed.searchParams.has("x-amz-checksum-crc32")).toBe(false);
      } finally {
        client?.destroy();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });
    it("signs a fifteen-minute upload URL with the installed client", async () => {
      const { S3Client } = jest.requireActual("@aws-sdk/client-s3");
      const { getSignedUrl } = jest.requireActual(
        "@aws-sdk/s3-request-presigner",
      );
      const client = new S3Client({
        region: "us-east-1",
        credentials: { accessKeyId: "test", secretAccessKey: "test" },
      });
      mockGetSignedUrlPromise.mockImplementationOnce(
        (_client, command, options) => getSignedUrl(client, command, options),
      );
      try {
        const result = await generatePresignedUrl(
          "image/jpeg",
          "user",
          "user-1",
        );
        const url = new URL(result.url);
        expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
        expect(url.pathname).toBe("/users/user-1/mock-uuid.jpg");
        expect(url.searchParams.get("X-Amz-Signature")).toMatch(
          /^[a-f0-9]{64}$/,
        );
      } finally {
        client.destroy();
      }
    });
    it("returns url and key", async () => {
      mockGetSignedUrlPromise.mockResolvedValueOnce("https://presigned");
      const res = await generatePresignedUrl("image/jpeg", "user", "user-1");
      expect(res.url).toBe("https://presigned");
      expect(res.key).toBe("users/user-1/mock-uuid.jpg");
      expect(mockGetSignedUrlPromise).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        { expiresIn: 900 },
      );
      expect(mockGetSignedUrlPromise.mock.calls[0][1].input).toEqual({
        Bucket: "test-bucket",
        Key: "users/user-1/mock-uuid.jpg",
        ContentType: "image/jpeg",
      });
    });

    it("handles errors", async () => {
      mockGetSignedUrlPromise.mockRejectedValueOnce(new Error("Sign Error"));
      await expect(
        generatePresignedUrl("image/jpeg", "user", "user-1"),
      ).rejects.toThrow("Failed to generate presigned URL: Sign Error");
    });

    it.each([
      "text/html",
      "application/javascript",
      "image/svg+xml",
      "application/octet-stream",
    ])("refuses to mint an upload URL for %s", async (mimeType) => {
      await expect(
        generatePresignedUrl(mimeType, "custom", "contact-us"),
      ).rejects.toThrow("Unsupported file type.");
      expect(mockGetSignedUrlPromise).not.toHaveBeenCalled();
    });

    it.each([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ])("mints an upload URL for the allowed type %s", async (mimeType) => {
      mockGetSignedUrlPromise.mockResolvedValueOnce("https://presigned");
      await expect(
        generatePresignedUrl(mimeType, "temp", "user-1"),
      ).resolves.toMatchObject({
        url: "https://presigned",
        key: expect.stringMatching(
          new RegExp(`^${tempUploadPrefixFor("user-1")}mock-uuid`),
        ),
      });
    });
  });

  describe("moveFile", () => {
    const mine = `${tempUploadPrefixFor("user-1")}from.jpg`;

    it("copies, deletes, and returns cloudfront url", async () => {
      mockCopyObject.mockResolvedValueOnce({});
      mockDeleteObject.mockResolvedValueOnce({});
      const res = await moveFile(mine, "to.jpg", "user-1");
      expect(res).toBe("https://test-cf.cloudfront.net/to.jpg");
      expect(mockCopyObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        CopySource: `test-bucket/${mine}`,
        Key: "to.jpg",
      });
      expect(mockDeleteObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: mine,
      });
    });

    it("moves a key the upload URL issued to the same uploader", async () => {
      mockCopyObject.mockResolvedValueOnce({});
      mockDeleteObject.mockResolvedValueOnce({});
      const fresh = buildS3Key("temp", "user-1", "image/png");

      await moveFile(fresh, "companion/pet-1/photo.png", "user-1");

      expect(mockDeleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ Key: fresh }),
      );
    });

    it.each([
      ["another person's upload", mine, "user-2"],
      ["an upload with no uploader named", mine, undefined],
      [
        "an upload from before uploads were kept per person",
        "temp/uploads/x.jpg",
        "user-1",
      ],
      ["a stored practice file", "companion/pet-1/report.pdf", "user-1"],
      [
        "a relative path out of the upload folder",
        `${tempUploadPrefixFor("user-1")}../orgs/x`,
        "user-1",
      ],
      [
        "an encoded path",
        `${tempUploadPrefixFor("user-1")}%2e%2e%2forgs%2fx`,
        "user-1",
      ],
      ["a differently cased folder", mine.toUpperCase(), "user-1"],
      ["a leading slash", `/${mine}`, "user-1"],
    ])(
      "refuses %s before any storage call",
      async (_label, fromKey, uploaderId) => {
        delete process.env.AWS_S3_BUCKET_NAME;

        await expect(moveFile(fromKey, "to.jpg", uploaderId)).rejects.toThrow(
          "Invalid upload key.",
        );
        expect(mockCopyObject).not.toHaveBeenCalled();
        expect(mockDeleteObject).not.toHaveBeenCalled();
      },
    );

    it("handles errors", async () => {
      mockCopyObject.mockRejectedValueOnce(new Error("Move failed"));
      await expect(moveFile(mine, "b", "user-1")).rejects.toThrow(
        "Failed to move file: Move failed",
      );
    });
  });

  describe("deleteFromS3", () => {
    it("deletes object", async () => {
      mockDeleteObject.mockResolvedValueOnce({});
      await deleteFromS3("key");
      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it("handles errors", async () => {
      mockDeleteObject.mockRejectedValueOnce(new Error("Delete fail"));
      await expect(deleteFromS3("key")).rejects.toThrow("Delete fail");
    });
  });

  describe("readObjectBounded", () => {
    it("reads all chunks from an allowed stored object", async () => {
      mockHeadObject.mockResolvedValueOnce({ ContentLength: 6 });
      mockGetObject.mockResolvedValueOnce({
        Body: sdkStreamMixin(
          Readable.from([Buffer.from("first"), Buffer.from("!")]),
        ),
      });
      await expect(readObjectBounded("report.csv", 6)).resolves.toEqual(
        Buffer.from("first!"),
      );
      expect(mockHeadObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "report.csv",
      });
      expect(mockGetObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "report.csv",
      });
    });

    it("refuses an oversized object before fetching its body", async () => {
      mockHeadObject.mockResolvedValueOnce({ ContentLength: 7 });
      await expect(readObjectBounded("report.csv", 6)).rejects.toThrow(
        "exceeds",
      );
      expect(mockGetObject).not.toHaveBeenCalled();
    });

    it("returns an empty buffer when the stored object has no body", async () => {
      mockHeadObject.mockResolvedValueOnce({});
      mockGetObject.mockResolvedValueOnce({});
      await expect(readObjectBounded("report.csv", 6)).resolves.toEqual(
        Buffer.alloc(0),
      );
    });
  });

  describe("handleFileUpload", () => {
    it("throws if no file provided", async () => {
      await expect(handleFileUpload(null as any, "folder")).rejects.toThrow(
        "No file uploaded.",
      );
    });

    it("throws if unsupported type", async () => {
      await expect(
        handleFileUpload(
          { name: "test", mimetype: "video/mp4", data: Buffer.from("") },
          "folder",
        ),
      ).rejects.toThrow("Unsupported file type.");
    });

    it("uploads and parses empty/missing filename safely", async () => {
      mockS3Upload.mockResolvedValueOnce({ Location: "loc", Key: "key" });
      const res = await handleFileUpload(
        { name: "", mimetype: "image/png", data: Buffer.from("") },
        "folder",
      );
      expect(res.originalname).toBe(""); // Passed original empty name back
      expect(mockS3Upload).toHaveBeenCalled();
    });
  });

  describe("handleMultipleFileUpload", () => {
    it("resolves all files", async () => {
      mockS3Upload.mockResolvedValue({ Location: "loc", Key: "key" });
      const files = [
        { name: "a.jpg", mimetype: "image/jpeg", data: Buffer.from("") },
        { name: "b.png", mimetype: "image/png", data: Buffer.from("") },
      ];
      const res = await handleMultipleFileUpload(files);
      expect(res).toHaveLength(2);
    });
  });

  describe("generatePresignedDownloadUrl", () => {
    it("generates correctly", async () => {
      const url = await generatePresignedDownloadUrl("test.pdf");
      expect(url).toBe("https://test-cf.cloudfront.net/test.pdf");
    });
  });

  describe("setupLifecyclePolicy", () => {
    it("returns early if rule already exists", async () => {
      mockGetBucketLifecycleConfiguration.mockResolvedValueOnce({
        Rules: [{ ID: "AutoDeleteTempUploads" }],
      });
      await setupLifecyclePolicy(5);
      expect(mockPutBucketLifecycleConfiguration).not.toHaveBeenCalled();
    });

    it("appends rule if other rules exist", async () => {
      mockGetBucketLifecycleConfiguration.mockResolvedValueOnce({
        Rules: [{ ID: "OtherRule" }],
      });
      mockPutBucketLifecycleConfiguration.mockResolvedValueOnce({});

      await setupLifecyclePolicy(3);

      expect(mockPutBucketLifecycleConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          LifecycleConfiguration: {
            Rules: [
              { ID: "OtherRule" },
              expect.objectContaining({
                ID: "AutoDeleteTempUploads",
                Expiration: { Days: 3 },
              }),
            ],
          },
        }),
      );
    });

    it("handles undefined rules array gracefully", async () => {
      mockGetBucketLifecycleConfiguration.mockResolvedValueOnce({}); // No Rules array
      mockPutBucketLifecycleConfiguration.mockResolvedValueOnce({});
      await setupLifecyclePolicy(3);
      expect(mockPutBucketLifecycleConfiguration).toHaveBeenCalled();
    });

    it("creates new config if none exists (NoSuchLifecycleConfiguration)", async () => {
      mockGetBucketLifecycleConfiguration.mockRejectedValueOnce({
        name: "NoSuchLifecycleConfiguration",
      });
      mockPutBucketLifecycleConfiguration.mockResolvedValueOnce({});

      await setupLifecyclePolicy(3);
      expect(mockPutBucketLifecycleConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          LifecycleConfiguration: {
            Rules: [expect.objectContaining({ ID: "AutoDeleteTempUploads" })],
          },
        }),
      );
    });

    it("throws on other errors and covers getErrorCode undefined branches", async () => {
      // 1. Generic object with code
      mockGetBucketLifecycleConfiguration.mockRejectedValueOnce({ code: 500 });
      await expect(setupLifecyclePolicy()).rejects.toThrow();

      // 2. Empty object
      mockGetBucketLifecycleConfiguration.mockRejectedValueOnce({});
      await expect(setupLifecyclePolicy()).rejects.toThrow();

      // 3. Null
      mockGetBucketLifecycleConfiguration.mockRejectedValueOnce(null);
      await expect(setupLifecyclePolicy()).rejects.toThrow();

      // 4. String
      mockGetBucketLifecycleConfiguration.mockRejectedValueOnce("string error");
      await expect(setupLifecyclePolicy()).rejects.toThrow();
    });
  });
});

describe("presigned upload mime allowlists", () => {
  it.each([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/heic",
    "image/webp",
  ])("accepts %s for a document upload", (mimeType) => {
    expect(isAllowedMimeType(mimeType)).toBe(true);
  });

  it("takes a gif wherever a picture is taken", () => {
    expect(isAllowedMimeType("image/gif")).toBe(true);
    expect(isAllowedMimeType("image/gif", ATTACHMENT_MIME_TYPES)).toBe(true);
    expect(isAllowedMimeType("image/gif", IMAGE_ONLY_MIME_TYPES)).toBe(true);
  });

  it.each(["text/html", "application/javascript", "image/svg+xml"])(
    "rejects %s everywhere",
    (mimeType) => {
      expect(isAllowedMimeType(mimeType)).toBe(false);
      expect(isAllowedMimeType(mimeType, ATTACHMENT_MIME_TYPES)).toBe(false);
      expect(isAllowedMimeType(mimeType, IMAGE_ONLY_MIME_TYPES)).toBe(false);
    },
  );

  it("keeps documents out of the narrower attachment and image sets", () => {
    const doc = "application/msword";
    expect(isAllowedMimeType(doc)).toBe(true);
    expect(isAllowedMimeType(doc, ATTACHMENT_MIME_TYPES)).toBe(false);
    expect(isAllowedMimeType(doc, IMAGE_ONLY_MIME_TYPES)).toBe(false);
    expect(isAllowedMimeType("application/pdf", ATTACHMENT_MIME_TYPES)).toBe(
      true,
    );
    expect(isAllowedMimeType("application/pdf", IMAGE_ONLY_MIME_TYPES)).toBe(
      false,
    );
  });
});
