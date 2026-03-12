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

describe("MerckService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MERCK_HEALTHLINK_BASE_URL =
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

    mockSearch.mockResolvedValueOnce(JSON.stringify(payload));

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

    mockSearch.mockResolvedValueOnce(xml);

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

  it("initializes Merck client with env config", async () => {
    (IntegrationService.ensureMerckAccount as jest.Mock).mockResolvedValue({
      status: "enabled",
    });

    mockSearch.mockResolvedValueOnce(
      JSON.stringify({ feed: { id: "feed-1", entry: [] } }),
    );

    await MerckService.search({
      organisationId: "org-1",
      query: "test",
      requestId: "req-5",
    });

    expect(MerckHealthlinkClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: process.env.MERCK_HEALTHLINK_BASE_URL,
        username: process.env.MERCK_HEALTHLINK_USERNAME,
        password: process.env.MERCK_HEALTHLINK_PASSWORD,
      }),
    );
  });
});
