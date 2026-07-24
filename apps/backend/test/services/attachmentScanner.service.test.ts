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
    const res = await scanAttachmentUrl(
      "https://us-east.stream-io-cdn.com/x.pdf",
    );
    expect(res.clean).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("treats an unknown file (VirusTotal 404) as clean", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce({ status: 404, ok: false });
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/x.pdf"))
        .clean,
    ).toBe(true);
  });

  it("flags a file VirusTotal marks malicious or suspicious", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce(vtStats({ malicious: 5, suspicious: 1 }));
    const res = await scanAttachmentUrl(
      "https://us-east.stream-io-cdn.com/evil.pdf",
    );
    expect(res.clean).toBe(false);
    expect(res.threat).toMatch(/6 VirusTotal/);
  });

  it("treats a clean VirusTotal verdict as clean", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce(vtStats({ malicious: 0, suspicious: 0 }));
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/ok.pdf"))
        .clean,
    ).toBe(true);
  });

  it("is clean when the download fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/x.pdf"))
        .clean,
    ).toBe(true);
  });

  it("is clean (fail-open) when a network error is thrown", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/x.pdf"))
        .clean,
    ).toBe(true);
  });

  it("is clean when the VirusTotal lookup itself errors", async () => {
    mockFetch
      .mockResolvedValueOnce(download())
      .mockResolvedValueOnce({ status: 500, ok: false });
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/x.pdf"))
        .clean,
    ).toBe(true);
  });

  it("skips empty downloads without calling VirusTotal", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.alloc(0),
    });
    expect(
      (await scanAttachmentUrl("https://us-east.stream-io-cdn.com/empty.pdf"))
        .clean,
    ).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not fetch a non-allowlisted host (SSRF guard), and reports it unscannable", async () => {
    const res = await scanAttachmentUrl("https://evil.example.com/x.pdf");
    expect(res.clean).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not fetch an internal metadata URL, and reports it unscannable", async () => {
    const res = await scanAttachmentUrl(
      "http://169.254.169.254/latest/meta-data/",
    );
    expect(res.clean).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not fetch a non-https Stream URL, and reports it unscannable", async () => {
    const res = await scanAttachmentUrl(
      "http://us-east.stream-io-cdn.com/x.pdf",
    );
    expect(res.clean).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not fetch a malformed URL, and reports it unscannable", async () => {
    const res = await scanAttachmentUrl("not a url");
    expect(res.clean).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails closed for a custom CDN host so the attachment cannot skip scanning", async () => {
    // A custom-CDN attachment is never fetchable (the SSRF barrier refuses to leave the
    // Stream CDN), so it is unscannable input rather than a scanner outage.
    const res = await scanAttachmentUrl("https://cdn.customer.example/x.pdf");

    expect(res.clean).toBe(false);
    expect(res.threat).toBe("attachment is not hosted on the Stream CDN");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still fails open when VirusTotal is unreachable", async () => {
    // Outage paths stay fail-open: a VirusTotal incident must not start deleting
    // every attachment that flows through chat.
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("file").buffer,
      })
      .mockRejectedValueOnce(new Error("network down"));

    const res = await scanAttachmentUrl(
      "https://us-east.stream-io-cdn.com/x.pdf",
    );

    expect(res.clean).toBe(true);
  });
});
