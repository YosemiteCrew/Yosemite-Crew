import { fetchDocumensoRedirectUrl } from "@/app/features/documents/services/documensoService";

const postDataMock = jest.fn();

jest.mock("@/app/services/axios", () => ({
  postData: (...args: any[]) => postDataMock(...args),
}));

describe("documensoService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchDocumensoRedirectUrl", () => {
    it("fetches redirect URL for organization", async () => {
      const mockResponse = {
        redirectUrl: "https://documenso.example.com/sign/abc123",
      };
      postDataMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchDocumensoRedirectUrl("org-123");

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/documenso/pms/redirect/org-123"
      );
      expect(result).toEqual(mockResponse);
    });

    it("returns redirect URL for different org", async () => {
      const mockResponse = {
        redirectUrl: "https://documenso.example.com/sign/xyz789",
      };
      postDataMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchDocumensoRedirectUrl("org-456");

      expect(postDataMock).toHaveBeenCalledWith(
        "/v1/documenso/pms/redirect/org-456"
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws error when API call fails", async () => {
      postDataMock.mockRejectedValue(new Error("API error"));

      await expect(fetchDocumensoRedirectUrl("org-123")).rejects.toThrow(
        "API error"
      );
    });

    it("handles empty redirect URL", async () => {
      const mockResponse = { redirectUrl: "" };
      postDataMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchDocumensoRedirectUrl("org-789");

      expect(result).toEqual({ redirectUrl: "" });
    });
  });
});
