import { scanAttachmentUrl } from "src/services/attachmentScanner.service";

const origKey = process.env.VIRUSTOTAL_API_KEY;
const origFetch = global.fetch;
const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VIRUSTOTAL_API_KEY = "vt-key";
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  process.env.VIRUSTOTAL_API_KEY = origKey;
  global.fetch = origFetch;
});

const download = (bytes = "data") => ({
  ok: true,
  arrayBuffer: async () => Buffer.from(bytes),
});
const vtStats = (stats: Record<string, number>) => ({
  status: 200,
  ok: true,
  json: async () => ({ data: { attributes: { last_analysis_stats: stats } } }),
});

describe("scanAttachmentUrl", () => {
  it("skips (clean) when no API key is configured", async () => {
    delete process.env.VIRUSTOTAL_API_KEY;
    const res = await scanAttachmentUrl("https://files/x.pdf");
    expect(res.clean).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("treats an unknown file (VirusTotal 404) as clean", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce({ status: 404, ok: false });
    expect((await scanAttachmentUrl("https://files/x.pdf")).clean).toBe(true);
  });

  it("flags a file VirusTotal marks malicious or suspicious", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce(vtStats({ malicious: 5, suspicious: 1 }));
    const res = await scanAttachmentUrl("https://files/evil.pdf");
    expect(res.clean).toBe(false);
    expect(res.threat).toMatch(/6 VirusTotal/);
  });

  it("treats a clean VirusTotal verdict as clean", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce(vtStats({ malicious: 0, suspicious: 0 }));
    expect((await scanAttachmentUrl("https://files/ok.pdf")).clean).toBe(true);
  });

  it("is clean when the download fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    expect((await scanAttachmentUrl("https://files/x.pdf")).clean).toBe(true);
  });

  it("is clean (fail-open) when a network error is thrown", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    expect((await scanAttachmentUrl("https://files/x.pdf")).clean).toBe(true);
  });

  it("is clean when the VirusTotal lookup itself errors", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce({ status: 500, ok: false });
    expect((await scanAttachmentUrl("https://files/x.pdf")).clean).toBe(true);
  });

  it("skips empty downloads without calling VirusTotal", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.alloc(0),
    });
    expect((await scanAttachmentUrl("https://files/empty.pdf")).clean).toBe(
      true,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
