import {
  startFormSigning,
  fetchSignedDocument,
  downloadSubmissionPdf,
} from "@/app/services/formSigningService";

const getDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock("@/app/services/axios", () => ({
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("formSigningService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startFormSigning", () => {
    it("posts to sign endpoint and returns response", async () => {
      const mockResponse = {
        documentId: 123,
        signingUrl: "https://example.com/sign",
      };
      postDataMock.mockResolvedValue({ data: mockResponse });

      const result = await startFormSigning("submission-123");

      expect(postDataMock).toHaveBeenCalledWith(
        "/fhir/v1/form/form-submissions/submission-123/sign"
      );
      expect(result).toEqual(mockResponse);
    });

    it("returns empty response when no data", async () => {
      postDataMock.mockResolvedValue({ data: {} });

      const result = await startFormSigning("submission-456");

      expect(result).toEqual({});
    });
  });

  describe("fetchSignedDocument", () => {
    it("fetches signed document details", async () => {
      const mockResponse = {
        pdf: {
          downloadUrl: "https://s3.example.com/doc.pdf",
          filename: "document.pdf",
          contentType: "application/pdf",
        },
      };
      getDataMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchSignedDocument("submission-123");

      expect(getDataMock).toHaveBeenCalledWith(
        "/fhir/v1/form/form-submissions/submission-123/signed-document"
      );
      expect(result).toEqual(mockResponse);
    });

    it("returns empty response when no pdf data", async () => {
      getDataMock.mockResolvedValue({ data: {} });

      const result = await fetchSignedDocument("submission-456");

      expect(result).toEqual({});
    });
  });

  describe("downloadSubmissionPdf", () => {
    it("downloads PDF blob from signed document URL", async () => {
      const mockPdfBlob = new Blob(["pdf content"], {
        type: "application/pdf",
      });
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: "https://s3.example.com/doc.pdf",
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockPdfBlob),
      });

      const result = await downloadSubmissionPdf("submission-123");

      expect(getDataMock).toHaveBeenCalledWith(
        "/fhir/v1/form/form-submissions/submission-123/signed-document"
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "https://s3.example.com/doc.pdf",
        {
          method: "GET",
          credentials: "omit",
          headers: {
            Accept: "*/*",
          },
        }
      );
      expect(result).toBe(mockPdfBlob);
    });

    it("throws error when download URL is not available", async () => {
      getDataMock.mockResolvedValue({ data: {} });

      await expect(downloadSubmissionPdf("submission-456")).rejects.toThrow(
        "Signed PDF not available"
      );
    });

    it("throws error when pdf object exists but downloadUrl is missing", async () => {
      getDataMock.mockResolvedValue({ data: { pdf: {} } });

      await expect(downloadSubmissionPdf("submission-456")).rejects.toThrow(
        "Signed PDF not available"
      );
    });

    it("throws error when fetch fails", async () => {
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: "https://s3.example.com/doc.pdf",
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(downloadSubmissionPdf("submission-789")).rejects.toThrow(
        "Failed to download signed PDF (404)"
      );
    });

    it("throws error when fetch returns 500", async () => {
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: "https://s3.example.com/doc.pdf",
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(downloadSubmissionPdf("submission-123")).rejects.toThrow(
        "Failed to download signed PDF (500)"
      );
    });
  });
});
