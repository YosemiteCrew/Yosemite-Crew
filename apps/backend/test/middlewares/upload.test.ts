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
} from "../../src/middlewares/upload";

// --- 1. Mocks ---
// All mocks must be defined INSIDE the factory or via mock variables to avoid hoisting issues.
const mockS3Upload = jest.fn();
const mockGetSignedUrlPromise = jest.fn();
const mockCopyObject = jest.fn();
const mockDeleteObject = jest.fn();
const mockGetBucketLifecycleConfiguration = jest.fn();
const mockPutBucketLifecycleConfiguration = jest.fn();

jest.mock("aws-sdk", () => {
  return {
    S3: jest.fn().mockImplementation(() => ({
      upload: (params: any) => ({ promise: () => mockS3Upload(params) }),
      getSignedUrlPromise: (...args: any[]) => mockGetSignedUrlPromise(...args),
      copyObject: (params: any) => ({ promise: () => mockCopyObject(params) }),
      deleteObject: (params: any) => ({
        promise: () => mockDeleteObject(params),
      }),
      getBucketLifecycleConfiguration: (params: any) => ({
        promise: () => mockGetBucketLifecycleConfiguration(params),
      }),
      putBucketLifecycleConfiguration: (params: any) => ({
        promise: () => mockPutBucketLifecycleConfiguration(params),
      }),
    })),
  };
});

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

  describe("buildS3Key", () => {
    it("builds correct paths for all folder types", () => {
      expect(buildS3Key("temp", "123", "image/png")).toBe(
        "temp/uploads/mock-uuid.png",
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
  });

  describe("uploadToS3", () => {
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
    it("returns url and key", async () => {
      mockGetSignedUrlPromise.mockResolvedValueOnce("https://presigned");
      const res = await generatePresignedUrl("image/jpeg", "user", "user-1");
      expect(res.url).toBe("https://presigned");
      expect(res.key).toBe("users/user-1/mock-uuid.jpg");
    });

    it("handles errors", async () => {
      mockGetSignedUrlPromise.mockRejectedValueOnce(new Error("Sign Error"));
      await expect(
        generatePresignedUrl("image/jpeg", "user", "user-1"),
      ).rejects.toThrow("Failed to generate presigned URL: Sign Error");
    });
  });

  describe("moveFile", () => {
    it("copies, deletes, and returns cloudfront url", async () => {
      mockCopyObject.mockResolvedValueOnce({});
      mockDeleteObject.mockResolvedValueOnce({});
      const res = await moveFile("from.jpg", "to.jpg");
      expect(res).toBe("https://test-cf.cloudfront.net/to.jpg");
      expect(mockCopyObject).toHaveBeenCalled();
      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it("handles errors", async () => {
      mockCopyObject.mockRejectedValueOnce(new Error("Move failed"));
      await expect(moveFile("a", "b")).rejects.toThrow(
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
        code: "NoSuchLifecycleConfiguration",
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
