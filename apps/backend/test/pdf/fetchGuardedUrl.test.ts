import axios from "axios";
import dns from "node:dns";

import {
  fetchPublicUrlAsBuffer,
  GuardedFetchError,
} from "../../../../packages/lib/src/pdf/fetchGuardedUrl";

jest.mock("axios", () => ({ get: jest.fn() }));

const mockedAxiosGet = axios.get as jest.Mock;

// Security boundary for the stored-document PDF fetch (SSRF guard). The URL is
// read back from a document record, so it is untrusted: the guard must refuse
// anything that could reach an internal service before axios is ever called.
describe("fetchPublicUrlAsBuffer (SSRF guard)", () => {
  let lookupSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedAxiosGet.mockReset();
    delete process.env.PDF_REMOTE_ALLOWED_HOSTS;
    lookupSpy = jest.spyOn(dns.promises, "lookup");
  });

  afterEach(() => {
    lookupSpy.mockRestore();
    delete process.env.PDF_REMOTE_ALLOWED_HOSTS;
  });

  it("rejects a malformed URL", async () => {
    await expect(fetchPublicUrlAsBuffer("not a url")).rejects.toThrow(
      GuardedFetchError,
    );
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it.each(["file:///etc/passwd", "ftp://example.com/a.pdf"])(
    "rejects unsupported protocol %s",
    async (url) => {
      await expect(fetchPublicUrlAsBuffer(url)).rejects.toThrow(
        /unsupported protocol/i,
      );
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["http://127.0.0.1/a.pdf", "loopback"],
    ["http://169.254.169.254/latest/meta-data", "cloud metadata"],
    ["http://10.0.0.5/a.pdf", "private range"],
  ])("rejects %s (%s)", async (url) => {
    await expect(fetchPublicUrlAsBuffer(url)).rejects.toThrow(
      /private address/i,
    );
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("rejects a hostname whose DNS answers include a private address", async () => {
    lookupSpy.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(
      fetchPublicUrlAsBuffer("https://rebind.example/a.pdf"),
    ).rejects.toThrow(/private address/i);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("rejects a host outside the allowlist when one is configured", async () => {
    process.env.PDF_REMOTE_ALLOWED_HOSTS = "cdn.allowed.example";

    await expect(
      fetchPublicUrlAsBuffer("https://cdn.other.example/a.pdf"),
    ).rejects.toThrow(/allowlist/i);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it("fetches a public host and returns the body as a Buffer", async () => {
    lookupSpy.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    mockedAxiosGet.mockResolvedValueOnce({ data: Buffer.from("pdf-bytes") });

    const result = await fetchPublicUrlAsBuffer("https://cdn.example/a.pdf");

    expect(result).toEqual(Buffer.from("pdf-bytes"));
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      "https://cdn.example/a.pdf",
      expect.objectContaining({
        responseType: "arraybuffer",
        maxRedirects: 0,
      }),
    );
  });

  it("pins the request to the validated address and caps the response size", async () => {
    lookupSpy.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    mockedAxiosGet.mockResolvedValueOnce({ data: Buffer.from("pdf-bytes") });

    await fetchPublicUrlAsBuffer("https://cdn.example/a.pdf", {
      maxBytes: 1234,
      timeoutMs: 999,
    });

    const config = mockedAxiosGet.mock.calls[0][1];
    expect(config.maxContentLength).toBe(1234);
    expect(config.maxBodyLength).toBe(1234);
    expect(config.timeout).toBe(999);
    expect(config.httpsAgent).toBeDefined();
    expect(config.validateStatus(204)).toBe(true);
    expect(config.validateStatus(302)).toBe(false);
    expect(config.validateStatus(500)).toBe(false);
  });

  it("allows a host that is on the allowlist", async () => {
    process.env.PDF_REMOTE_ALLOWED_HOSTS = "cdn.allowed.example, other.example";
    lookupSpy.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    mockedAxiosGet.mockResolvedValueOnce({ data: Buffer.from("ok") });

    await expect(
      fetchPublicUrlAsBuffer("https://cdn.allowed.example/a.pdf"),
    ).resolves.toEqual(Buffer.from("ok"));
  });

  it("rejects when DNS resolution fails", async () => {
    lookupSpy.mockRejectedValueOnce(new Error("ENOTFOUND"));

    await expect(
      fetchPublicUrlAsBuffer("https://missing.example/a.pdf"),
    ).rejects.toThrow(/private address/i);
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });
});
