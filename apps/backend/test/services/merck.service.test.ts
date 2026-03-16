import {
  MerckService,
  MerckServiceError,
} from "../../src/services/merck.service";
import { IntegrationService } from "../../src/services/integration.service";
import { MerckHealthlinkClient } from "../../src/integrations/merck/merck.client";

jest.mock("../../src/services/integration.service", () => ({
  IntegrationService: {
    ensureMerckAccount: jest.fn(),
  },
}));

const mockSearch = jest.fn();
jest.mock("../../src/integrations/merck/merck.client", () => ({
  MerckHealthlinkClient: jest.fn().mockImplementation(() => ({
    search: mockSearch,
  })),
}));

const normalizeBase = (value?: string) => {
  const trimmed = String(value ?? "").replace(/\/+$/, "");
  if (trimmed.endsWith("/custom/infobutton/search")) {
    return trimmed.replace(
      "/custom/infobutton/search",
      "/infobutton/searchjson",
    );
  }
  return trimmed;
};

describe("MerckService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MERCK_HEALTHLINK_BASE_URL =
      "https://www.msdvetmanual.com/custom/infobutton/search";
    process.env.MERCK_HEALTHLINK_BASE_URL_US_CA =
      "https://www.merckvetmanual.com/custom/infobutton/search";
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
      "https://www.msdvetmanual.com/custom/infobutton/search";
    process.env.MERCK_HEALTHLINK_USERNAME = "user";
    process.env.MERCK_HEALTHLINK_PASSWORD = "pass";
    process.env.MERCK_HEALTHLINK_TIMEOUT_MS = "10000";
  });

  it("normalizes JSON feed payload", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    const payload = {
      feed: {
        id: "feed-1",
        updated: "2025-01-01T00:00:00Z",
        category: { "@scheme": "informationRecipient", "@term": "PROV" },
        entry: {
          id: "entry-1",
          title: { "#text": "Manual Topic" },
          summary: {
            "#text":
              '<p>Summary text</p><a href="https://www.msdvetmanual.com/topic#sub">Sub</a>',
          },
          updated: "2025-01-01T00:00:00Z",
          link: { "@href": "https://www.msdvetmanual.com/topic" },
        },
      },
    };

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify(payload),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    const result = await MerckService.search({
      organisationId: "org-1",
      query: "test",
      audience: "PROV",
      language: "en",
      media: "hybrid",
      requestId: "req-1",
    });

    expect(result.meta.totalResults).toBe(1);
    expect(result.entries[0]?.primaryUrl).toContain("msdvetmanual.com");
    expect(result.entries[0]?.subLinks.length).toBeGreaterThan(0);
  });

  it("normalizes Atom XML payload", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>feed-xml</id>
  <updated>2025-01-02T00:00:00Z</updated>
  <category scheme="informationRecipient" term="PAT" />
  <entry>
    <id>entry-xml-1</id>
    <updated>2025-01-02T00:00:00Z</updated>
    <summary type="html">
      <div><h2><a href="https://www.msdvetmanual.com/topic-xml">Topic</a></h2>
      <p>XML summary</p>
      <a href="https://www.msdvetmanual.com/topic-xml#sub">Sub</a></div>
    </summary>
    <link href="https://www.msdvetmanual.com/topic-xml" rel="alternate" />
  </entry>
</feed>`;

    mockSearch.mockResolvedValueOnce({
      data: xml,
      contentType: "application/xml",
      status: 200,
      finalUrl: null,
    });

    const result = await MerckService.search({
      organisationId: "org-1",
      query: "test",
      audience: "PAT",
      language: "en",
      media: "hybrid",
      requestId: "req-2",
    });

    expect(result.meta.totalResults).toBe(1);
    expect(result.meta.audience).toBe("PAT");
    expect(result.entries[0]?.primaryUrl).toContain("msdvetmanual.com");
  });

  it("rejects search when integration is disabled", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "disabled",
    });

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        requestId: "req-3",
      }),
    ).rejects.toBeInstanceOf(MerckServiceError);
  });

  it("requires a query", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "",
        requestId: "req-4",
      }),
    ).rejects.toThrow("q is required.");
  });

  it("rejects invalid audience values", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        audience: "ALIEN" as any,
        requestId: "req-4b",
      }),
    ).rejects.toThrow("audience must be one of: PROV, PAT.");
  });

  it("rejects non-string language values", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        language: 123 as any,
        requestId: "req-4c",
      }),
    ).rejects.toThrow("language must be a string.");
  });

  it("filters entries with invalid primary URLs", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    const payload = {
      feed: {
        id: "feed-invalid",
        entry: {
          id: "entry-bad",
          title: { "#text": "Bad" },
          summary: { "#text": "<div>No links</div>" },
          link: { "@href": "not-a-url" },
        },
      },
    };

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify(payload),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    const result = await MerckService.search({
      organisationId: "org-1",
      query: "test",
      requestId: "req-4d",
    });

    expect(result.meta.totalResults).toBe(0);
  });

  it("extracts summary text and dedupes sublinks", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    const payload = {
      feed: {
        id: "feed-links",
        entry: {
          id: "entry-links",
          title: { "#text": "Topic" },
          summary: {
            "#text":
              '<div>Some <b>text</b> <a href="not-a-url">Bad</a> <a href="https://www.merckvetmanual.com/topic#sub">Sub</a></div>',
          },
          link: { "@href": "https://www.merckvetmanual.com/topic" },
        },
      },
    };

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify(payload),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    const result = await MerckService.search({
      organisationId: "org-1",
      query: "test",
      requestId: "req-4e",
    });

    expect(result.entries[0]?.summaryText).toContain("Some text");
    expect(result.entries[0]?.subLinks[0]?.label).toBe("Full Summary");
    expect(result.entries[0]?.subLinks.length).toBe(2);
  });

  it("initializes Merck client with env config", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify({ feed: { id: "feed-1", entry: [] } }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    await MerckService.search({
      organisationId: "org-1",
      query: "test",
      timezone: "America/New_York",
      requestId: "req-5",
    });

    expect(MerckHealthlinkClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: normalizeBase(process.env.MERCK_HEALTHLINK_BASE_URL_US_CA),
        username: process.env.MERCK_HEALTHLINK_USERNAME,
        password: process.env.MERCK_HEALTHLINK_PASSWORD,
      }),
    );
  });

  it("routes to US/Canada base URL when timezone is US", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify({ feed: { id: "feed-2", entry: [] } }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    await MerckService.search({
      organisationId: "org-1",
      query: "test",
      timezone: "America/Los_Angeles",
      requestId: "req-6",
    });

    expect(MerckHealthlinkClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: normalizeBase(process.env.MERCK_HEALTHLINK_BASE_URL_US_CA),
      }),
    );
  });

  it("routes to US/Canada base URL when timezone is Canada", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify({ feed: { id: "feed-canada", entry: [] } }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    await MerckService.search({
      organisationId: "org-1",
      query: "test",
      timezone: "Canada/Pacific",
      requestId: "req-6b",
    });

    expect(MerckHealthlinkClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: normalizeBase(process.env.MERCK_HEALTHLINK_BASE_URL_US_CA),
      }),
    );
  });

  it("routes to global base URL when timezone is invalid", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    mockSearch.mockResolvedValueOnce({
      data: JSON.stringify({ feed: { id: "feed-3", entry: [] } }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    await MerckService.search({
      organisationId: "org-1",
      query: "test",
      timezone: "Invalid/Timezone",
      requestId: "req-7",
    });

    expect(MerckHealthlinkClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: normalizeBase(process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL),
      }),
    );
  });

  it("throws when Merck credentials are missing", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    process.env.MERCK_HEALTHLINK_USERNAME = "";

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        requestId: "req-7b",
      }),
    ).rejects.toThrow("Merck Healthlink credentials are not configured.");
  });

  it("throws when timeout is invalid", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    process.env.MERCK_HEALTHLINK_TIMEOUT_MS = "bad";

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        requestId: "req-7c",
      }),
    ).rejects.toThrow("Invalid Merck timeout configuration.");
  });

  it("throws when base URL domain is invalid", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    process.env.MERCK_HEALTHLINK_BASE_URL = "https://example.com/infobutton";
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
      "https://example.com/infobutton";

    await expect(
      MerckService.search({
        organisationId: "org-1",
        query: "test",
        timezone: "Invalid/Timezone",
        requestId: "req-7d",
      }),
    ).rejects.toThrow(
      "Merck Healthlink base URL must use the veterinary manuals domain.",
    );
  });
});
