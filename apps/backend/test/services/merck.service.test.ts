jest.mock("src/integrations/merck/merck.client", () => {
  const __searchMock = jest.fn();
  return {
    MerckHealthlinkClient: jest.fn().mockImplementation(() => ({
      search: __searchMock,
    })),
    __searchMock,
  };
});

jest.mock("src/services/integration.service", () => ({
  IntegrationService: {
    ensureMerckAccount: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { MerckService } from "src/services/merck.service";
import { IntegrationService } from "src/services/integration.service";
import { MerckHealthlinkClient } from "src/integrations/merck/merck.client";
import logger from "src/utils/logger";

const mockedLogger = jest.mocked(logger);

const jsonResponse = (payload: unknown) => ({
  data: typeof payload === "string" ? payload : JSON.stringify(payload),
  contentType: "application/json",
  status: 200,
  finalUrl: null,
});

const htmlResponse = (
  data = "<html>blocked</html>",
  contentType: string | null = "text/html",
) => ({ data, contentType, status: 200, finalUrl: null });

const axiosFailure = (response?: { status: number }) =>
  Object.assign(new Error("upstream boom"), {
    isAxiosError: true,
    config: { url: "/infobutton/searchjson" },
    response,
  });

describe("MerckService", () => {
  const originalEnv = process.env;
  const mockedIntegrationService = IntegrationService as unknown as {
    ensureMerckAccount: jest.Mock;
  };
  const mockedClientConstructor = MerckHealthlinkClient as unknown as jest.Mock;
  const getSearchMock = () =>
    // jest.mock factory adds this field at runtime
    (jest.requireMock("src/integrations/merck/merck.client") as any)
      .__searchMock as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
      "https://merckvetmanual.com/infobutton/searchjson";
    process.env.MERCK_HEALTHLINK_USERNAME = "test-user";
    process.env.MERCK_HEALTHLINK_PASSWORD = "test-pass";
    mockedIntegrationService.ensureMerckAccount.mockResolvedValue({
      status: "enabled",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not leak Healthlink credentials when logging Axios search failures", async () => {
    const LEAK_USER = "LEAK_USER_123";
    const LEAK_PASS = "LEAK_PASS_456";

    const axiosError = Object.assign(new Error("boom"), {
      isAxiosError: true,
      code: "ECONNABORTED",
      config: {
        baseURL: "https://merckvetmanual.com/infobutton/searchjson",
        url: "/infobutton/searchjson?holder.assignedEntity.n=" + LEAK_USER,
        method: "get",
        timeout: 1000,
        params: {
          "holder.assignedEntity.n": LEAK_USER,
          "holder.assignedEntity.certificateText": LEAK_PASS,
        },
      },
      response: { status: 401 },
    });

    getSearchMock().mockRejectedValueOnce(axiosError);

    await expect(
      MerckService.searchConsumer({
        query: "canine diabetes",
        requestId: "req-1",
        timezone: "America/New_York",
      }),
    ).rejects.toBe(axiosError);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Merck search failed",
      expect.any(Object),
    );

    const meta = mockedLogger.error.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;

    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(LEAK_USER);
    expect(serialized).not.toContain(LEAK_PASS);
    expect(serialized).not.toContain("holder.assignedEntity");
  });

  it("validates required fields before searching", async () => {
    await expect(
      MerckService.searchConsumer({
        query: "   ",
        requestId: "req-2",
      }),
    ).rejects.toThrow("q is required.");
  });

  it("normalizes JSON feed payloads", async () => {
    getSearchMock().mockResolvedValueOnce({
      data: JSON.stringify({
        feed: {
          id: "feed-1",
          updated: "2026-01-01T00:00:00Z",
          category: [{ "@scheme": "informationrecipient", "@term": "PAT" }],
          entry: [
            {
              id: "topic-1",
              title: { "#text": "  Feline  Diabetes " },
              summary: {
                "#text":
                  '<p>One <a href="https://merckvetmanual.com/topic-a">A</a> and <a href="https://merckvetmanual.com/topic-a/">dup</a></p>',
              },
              updated: "2026-01-02T00:00:00Z",
              link: { "@href": "https://merckvetmanual.com/topic-a/" },
            },
          ],
        },
      }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    const response = await MerckService.searchConsumer({
      query: "feline diabetes",
      requestId: "req-json",
      timezone: "America/New_York",
      media: "full",
      code: "1234",
      codeSystem: "ICD10CM",
      displayName: "  custom name  ",
      originalText: "  original text  ",
      subTopicCode: "M01",
      subTopicDisplay: "sub topic",
    });

    expect(response.meta).toMatchObject({
      requestId: "feed-1",
      source: "merck-live-feed",
      audience: "PAT",
      language: "en",
      totalResults: 1,
    });
    expect(response.entries[0]).toMatchObject({
      id: "topic-1",
      title: "Feline  Diabetes",
      summaryText: "One A and dup",
      audience: "PAT",
      primaryUrl:
        "https://merckvetmanual.com/topic-a/?utm_source=yosemitecrew&utm_medium=Partner",
    });
    expect(response.entries[0].subLinks).toEqual([
      {
        label: "Full Summary",
        url: "https://merckvetmanual.com/topic-a/?utm_source=yosemitecrew&utm_medium=Partner",
      },
    ]);
    expect(getSearchMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        "mainSearchCriteria.v.c": "1234",
        "mainSearchCriteria.v.csn": "ICD10CM",
        "mainSearchCriteria.v.dn": "custom name",
        "mainSearchCriteria.v.ot": "original text",
        "subTopic.v.cs": "2.16.840.1.113883.6.177",
        "subTopic.v.c": "M01",
        "subTopic.v.dn": "sub topic",
      }),
      expect.any(Object),
    );
  });

  it("normalizes XML payloads and retries on HTML", async () => {
    getSearchMock()
      .mockResolvedValueOnce({
        data: "<html>blocked</html>",
        contentType: "text/html",
        status: 200,
        finalUrl: null,
      })
      .mockResolvedValueOnce({
        data: `<?xml version="1.0"?><feed><id>xml-feed</id><updated>2026-01-01</updated><category scheme="informationrecipient" term="PROV"/><entry><id>xml-1</id><title>Canine topic</title><summary><![CDATA[<p><a href="https://msdvetmanual.com/topic-b">Topic B</a></p>]]></summary><link href="https://msdvetmanual.com/topic-b"/></entry></feed>`,
        contentType: "application/atom+xml",
        status: 200,
        finalUrl: null,
      });

    const response = await MerckService.searchConsumer({
      query: "canine topic",
      requestId: "req-xml",
      timezone: "UTC+01:00",
    });

    expect(response.meta).toMatchObject({
      requestId: "xml-feed",
      source: "merck-live-atom",
      audience: "PROV",
      totalResults: 1,
    });
    expect(response.entries[0]).toMatchObject({
      id: "xml-1",
      title: "Canine topic",
      summaryText: "Topic B",
      primaryUrl:
        "https://msdvetmanual.com/topic-b?media=hybrid&utm_source=yosemitecrew&utm_medium=Partner",
    });
    expect(getSearchMock()).toHaveBeenCalledTimes(2);
    expect(mockedLogger.info).toHaveBeenCalledWith(
      "Merck search completed",
      expect.objectContaining({
        requestId: "req-xml",
      }),
    );
  });

  it("throws when Merck integration is disabled for the organisation", async () => {
    mockedIntegrationService.ensureMerckAccount.mockResolvedValueOnce({
      status: "disabled",
    });

    await expect(
      MerckService.search({
        query: "canine topic",
        organisationId: "org-1",
        requestId: "req-disabled",
        timezone: "America/New_York",
      }),
    ).rejects.toThrow("Merck Manuals is disabled for this organization.");
  });

  it("rejects invalid Merck timeout configuration", async () => {
    process.env.MERCK_HEALTHLINK_TIMEOUT_MS = "0";
    await expect(
      MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-timeout",
      }),
    ).rejects.toThrow("Invalid Merck timeout configuration.");
  });

  describe("input validation", () => {
    it("rejects a non-string audience", async () => {
      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-audience-type",
          audience: 5 as never,
        }),
      ).rejects.toMatchObject({
        message: "audience must be a string.",
        statusCode: 400,
      });
      expect(getSearchMock()).not.toHaveBeenCalled();
    });

    it("rejects an audience outside the allowed set", async () => {
      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-audience-value",
          audience: "VET" as never,
        }),
      ).rejects.toThrow("audience must be one of: PROV, PAT.");
    });

    it("rejects a media mode outside the allowed set", async () => {
      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-media",
          media: "audio" as never,
        }),
      ).rejects.toThrow("media must be one of: hybrid, print, full.");
    });

    it("treats a blank optional enum as unset and defaults it", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-blank-enum",
        audience: "  " as never,
        language: "   " as never,
      });

      expect(response.meta.language).toBe("en");
      expect(getSearchMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          informationRecipient: "PROV",
          "informationRecipient.languageCode.c": "en",
        }),
        expect.any(Object),
      );
    });

    it("requires an organisation id on the org-scoped search", async () => {
      await expect(
        MerckService.search({
          query: "canine topic",
          organisationId: "   ",
          requestId: "req-org",
        }),
      ).rejects.toThrow("organisationId is required.");
      expect(
        mockedIntegrationService.ensureMerckAccount,
      ).not.toHaveBeenCalled();
    });
  });

  describe("upstream routing configuration", () => {
    it("throws when neither base URL is configured", async () => {
      delete process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL;
      delete process.env.MERCK_HEALTHLINK_BASE_URL_US_CA;
      delete process.env.MERCK_HEALTHLINK_BASE_URL;

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-nobase",
        }),
      ).rejects.toThrow("Merck Healthlink base URL is not configured.");
    });

    it("throws when the Healthlink credentials are missing", async () => {
      delete process.env.MERCK_HEALTHLINK_USERNAME;

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-nocreds",
        }),
      ).rejects.toThrow("Merck Healthlink credentials are not configured.");
      expect(mockedClientConstructor).not.toHaveBeenCalled();
    });

    it("refuses a base URL outside the veterinary manuals domain", async () => {
      process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
        "https://merckvetmanual.com.attacker.example/infobutton/searchjson";

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-baddomain",
        }),
      ).rejects.toMatchObject({
        message:
          "Merck Healthlink base URL must use the veterinary manuals domain.",
        statusCode: 500,
      });
      expect(getSearchMock()).not.toHaveBeenCalled();
    });

    it("rewrites a trailing-slash legacy search endpoint to the JSON endpoint", async () => {
      process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
        "https://www.msdvetmanual.com/custom/infobutton/search//";
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-rewrite",
      });

      expect(mockedClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://www.msdvetmanual.com/infobutton/searchjson",
          username: "test-user",
          password: "test-pass",
          timeoutMs: 10000,
        }),
      );
    });

    it("routes a US/Canada shorthand timezone to the regional base URL", async () => {
      process.env.MERCK_HEALTHLINK_BASE_URL_US_CA =
        "https://merckvetmanual.com/us/infobutton/searchjson";
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-usca",
        timezone: "US/Eastern",
      });

      expect(mockedClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://merckvetmanual.com/us/infobutton/searchjson",
        }),
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed",
        expect.objectContaining({ routingReason: "timezone-us-canada" }),
      );
    });

    it("falls back to the regional base URL when only it is configured", async () => {
      delete process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL;
      process.env.MERCK_HEALTHLINK_BASE_URL_US_CA =
        "https://merckvetmanual.com/us/infobutton/searchjson";
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-usca-only",
        timezone: "Europe/London",
      });

      expect(mockedClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://merckvetmanual.com/us/infobutton/searchjson",
        }),
      );
    });

    it("marks an unrecognised timezone as invalid without failing the search", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-badtz",
        timezone: "Mars/Olympus",
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed",
        expect.objectContaining({
          routingReason: "timezone-invalid",
          timezone: "Mars/Olympus",
        }),
      );
    });

    it("throws when only the Healthlink password is missing", async () => {
      delete process.env.MERCK_HEALTHLINK_PASSWORD;

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-nopass",
        }),
      ).rejects.toThrow("Merck Healthlink credentials are not configured.");
    });

    it("routes a valid non-US timezone to the global base URL", async () => {
      process.env.MERCK_HEALTHLINK_BASE_URL_US_CA =
        "https://merckvetmanual.com/us/infobutton/searchjson";
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-global",
        timezone: "Europe/London",
      });

      expect(mockedClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://merckvetmanual.com/infobutton/searchjson",
        }),
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed",
        expect.objectContaining({
          routingReason: "timezone-global",
          timezone: "Europe/London",
        }),
      );
    });

    it("reports a missing timezone in the completion log", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-notz",
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed",
        expect.objectContaining({
          routingReason: "timezone-missing",
          timezone: null,
          organisationId: null,
        }),
      );
    });
  });

  describe("search parameter mapping", () => {
    it("sends an OID code system as the coded value and drops unknown names", async () => {
      getSearchMock()
        .mockResolvedValueOnce(jsonResponse({ feed: {} }))
        .mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-oid",
        codeSystem: "2.16.840.1.113883.6.103",
      });
      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-unknown-cs",
        codeSystem: "MYSTERY-SYSTEM",
      });

      const [oidParams] = getSearchMock().mock.calls[0];
      expect(oidParams["mainSearchCriteria.v.cs"]).toBe(
        "2.16.840.1.113883.6.103",
      );
      expect(oidParams["mainSearchCriteria.v.csn"]).toBeUndefined();

      const [unknownParams] = getSearchMock().mock.calls[1];
      expect(unknownParams["mainSearchCriteria.v.cs"]).toBeUndefined();
      expect(unknownParams["mainSearchCriteria.v.csn"]).toBeUndefined();
    });

    it("falls back to the query for display and original text and omits sub-topic params", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "  canine diabetes  ",
        requestId: "req-defaults",
      });

      const [params] = getSearchMock().mock.calls[0];
      expect(params["mainSearchCriteria.v.dn"]).toBe("canine diabetes");
      expect(params["mainSearchCriteria.v.ot"]).toBe("canine diabetes");
      expect(params["mainSearchCriteria.v.c"]).toBeUndefined();
      expect(params["subTopic.v.cs"]).toBeUndefined();
      expect(params).toMatchObject({
        "holder.assignedEntity.n": "test-user",
        "holder.assignedEntity.certificateText": "test-pass",
        "taskContext.c.c": "PROBLISTREV",
        knowledgeResponseType: "text/json",
      });
    });

    it("ignores non-string display and original text overrides", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-nonstring-text",
        displayName: 5 as never,
        originalText: 7 as never,
      });

      const [params] = getSearchMock().mock.calls[0];
      expect(params["mainSearchCriteria.v.dn"]).toBe("canine topic");
      expect(params["mainSearchCriteria.v.ot"]).toBe("canine topic");
    });

    it("ignores whitespace-only optional strings", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-blank-text",
        displayName: "   ",
        code: "  ",
        codeSystem: "   ",
        subTopicCode: "  ",
        subTopicDisplay: "  ",
      });

      const [params] = getSearchMock().mock.calls[0];
      expect(params["mainSearchCriteria.v.dn"]).toBe("canine topic");
      expect(params["mainSearchCriteria.v.c"]).toBeUndefined();
      expect(params["mainSearchCriteria.v.cs"]).toBeUndefined();
      expect(params["subTopic.v.cs"]).toBeUndefined();
    });

    it("sends only the sub-topic code when no sub-topic display is supplied", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-subtopic",
        subTopicCode: "M02",
      });

      const [params] = getSearchMock().mock.calls[0];
      expect(params["subTopic.v.cs"]).toBe("2.16.840.1.113883.6.177");
      expect(params["subTopic.v.c"]).toBe("M02");
      expect(params["subTopic.v.dn"]).toBeUndefined();
    });
  });

  describe("JSON feed normalization", () => {
    it("falls back to the request id and PROV audience for an empty feed", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({}));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-empty-feed",
      });

      expect(response.meta).toEqual({
        requestId: "req-empty-feed",
        source: "merck-live-feed",
        updatedAt: null,
        audience: "PROV",
        language: "en",
        totalResults: 0,
      });
      expect(response.entries).toEqual([]);
    });

    it("normalizes a single entry node with a numeric id, array link and no paragraph markup", async () => {
      getSearchMock().mockResolvedValueOnce(
        jsonResponse({
          feed: {
            category: [
              { "@label": "unrelated" },
              { "@scheme": "informationRecipient", "@term": "prov" },
            ],
            entry: {
              id: 7,
              title: 42,
              summary: {
                "#text":
                  'Intro <a href="https://merckvetmanual.com/topic-x/sub">Sub</a> plus <a href="git://example.com">Odd</a> plus <a href="not a url">Bad</a>',
              },
              link: ["https://merckvetmanual.com/topic-x"],
            },
          },
        }),
      );

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-single-entry",
        media: "print",
      });

      expect(response.meta.audience).toBe("PROV");
      expect(response.entries).toHaveLength(1);
      expect(response.entries[0]).toMatchObject({
        id: "7",
        // readTextNode cannot read a numeric title, so the topic label is used.
        title: "Manual topic",
        summaryText: "Intro Sub plus Odd plus Bad",
        updatedAt: null,
        primaryUrl:
          "https://merckvetmanual.com/topic-x?media=print&utm_source=yosemitecrew&utm_medium=Partner",
      });
      // The distinct Merck sub-link survives; the non-Merck anchors are dropped.
      expect(response.entries[0].subLinks).toEqual([
        {
          label: "Full Summary",
          url: "https://merckvetmanual.com/topic-x?media=print&utm_source=yosemitecrew&utm_medium=Partner",
        },
        {
          label: "Sub",
          url: "https://merckvetmanual.com/topic-x/sub?media=print&utm_source=yosemitecrew&utm_medium=Partner",
        },
      ]);
    });

    it("drops entries without a usable Merck link", async () => {
      getSearchMock().mockResolvedValueOnce(
        jsonResponse({
          feed: {
            id: "feed-drop",
            entry: [
              { id: "no-link", title: "No link", summary: "", link: {} },
              {
                id: "off-domain",
                title: "Off domain",
                summary: "",
                link: { "@href": "https://evil.example.com/topic" },
              },
              {
                id: "unparseable",
                title: "Unparseable",
                summary: "",
                link: { "@href": "http://" },
              },
              {
                id: "",
                title: "Missing id",
                summary: "",
                link: { "@href": "https://merckvetmanual.com/topic-y" },
              },
            ],
          },
        }),
      );

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-drop",
      });

      expect(response.entries).toEqual([]);
      expect(response.meta.totalResults).toBe(0);
      expect(response.meta.requestId).toBe("feed-drop");
    });

    it("collapses mixed whitespace and skips anchors without a label", async () => {
      getSearchMock().mockResolvedValueOnce(
        jsonResponse({
          feed: {
            entry: {
              id: "ws-1",
              title: {},
              summary:
                '<p>\tLine one\r\nLine two <a href="https://merckvetmanual.com/labelless"></a> <a href="https://merckvetmanual.com/ws-1/sub">Sub</a></p>',
              link: "https://merckvetmanual.com/ws-1",
            },
          },
        }),
      );

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-whitespace",
        media: "full",
      });

      // readTextNode cannot read an object without a #text node, so the fallback title is used.
      expect(response.entries[0].title).toBe("Manual topic");
      expect(response.entries[0].summaryText).toBe("Line one Line two Sub");
      // The label-less anchor never becomes a sub-link.
      expect(response.entries[0].subLinks.map((link) => link.label)).toEqual([
        "Full Summary",
        "Sub",
      ]);
    });

    it("drops an entry whose id is null", async () => {
      getSearchMock().mockResolvedValueOnce(
        jsonResponse({
          feed: {
            entry: [
              {
                id: null,
                title: "No id",
                summary: "",
                link: { "@href": "https://merckvetmanual.com/no-id" },
              },
            ],
          },
        }),
      );

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-null-id",
      });

      expect(response.entries).toEqual([]);
    });

    it("keeps the first paragraph when the summary has closing markup and falls back otherwise", async () => {
      getSearchMock().mockResolvedValueOnce(
        jsonResponse({
          feed: {
            entry: [
              {
                id: "closed",
                title: "Closed",
                summary: "<div><p>First para</p><p>Second para</p></div>",
                link: { "@href": "https://merckvetmanual.com/closed" },
              },
              {
                id: "unclosed",
                title: "Unclosed",
                summary: "<p>Unclosed paragraph",
                link: { "@href": "https://merckvetmanual.com/unclosed" },
              },
              {
                id: "truncated",
                title: "Truncated",
                summary: "lead in <p",
                link: { "@href": "https://merckvetmanual.com/truncated" },
              },
            ],
          },
        }),
      );

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-summary",
        media: "full",
      });

      expect(response.entries.map((entry) => entry.summaryText)).toEqual([
        "First para",
        "Unclosed paragraph",
        "lead in",
      ]);
      // media=full strips the media parameter entirely.
      expect(response.entries[0].primaryUrl).toBe(
        "https://merckvetmanual.com/closed?utm_source=yosemitecrew&utm_medium=Partner",
      );
    });
  });

  describe("Atom/XML normalization", () => {
    it("treats a non-object JSON payload as XML", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse("42"));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-scalar",
      });

      expect(response.meta).toMatchObject({
        source: "merck-live-atom",
        requestId: "req-scalar",
        updatedAt: null,
        audience: "PROV",
        totalResults: 0,
      });
    });

    it("recovers the primary URL from the summary anchors and defaults a missing title", async () => {
      getSearchMock().mockResolvedValueOnce({
        data: [
          "<feed>",
          "<category scheme=informationrecipient term=PAT/>",
          '<category scheme="informationRecipient" term="PAT"/>',
          "<entry>",
          "<id>xml-anchor</id>",
          '<summary><![CDATA[<p>Body <a href="https://www.msdvetmanual.com/topic-c">Topic C</a></p>]]></summary>',
          '<link rel="alternate" href="https://not-merck.example.com/topic-c"/>',
          "</entry>",
          "<entry><id>xml-nolink</id></entry>",
          "</feed>",
        ].join(""),
        contentType: "application/atom+xml",
        status: 200,
        finalUrl: null,
      });

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-xml-anchor",
      });

      expect(response.meta).toMatchObject({
        requestId: "req-xml-anchor",
        source: "merck-live-atom",
        audience: "PAT",
        updatedAt: null,
        totalResults: 1,
      });
      expect(response.entries[0]).toMatchObject({
        id: "xml-anchor",
        title: "Manual topic",
        summaryText: "Body Topic C",
        updatedAt: null,
        primaryUrl:
          "https://www.msdvetmanual.com/topic-c?media=hybrid&utm_source=yosemitecrew&utm_medium=Partner",
      });
    });

    it("ignores an information-recipient category with no term", async () => {
      getSearchMock().mockResolvedValueOnce({
        data: [
          "<feed><id>no-term</id>",
          '<category scheme="informationRecipient"/>',
          "</feed>",
        ].join(""),
        contentType: "application/atom+xml",
        status: 200,
        finalUrl: null,
      });

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-noterm",
        audience: "PAT",
      });

      // No usable term, so the requested audience is preserved.
      expect(response.meta.audience).toBe("PAT");
    });

    it("returns no entries for an Atom feed with none", async () => {
      getSearchMock().mockResolvedValueOnce({
        data: "<feed><id>empty-feed</id></feed>",
        contentType: "application/atom+xml",
        status: 200,
        finalUrl: null,
      });

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-xml-empty",
      });

      expect(response.entries).toEqual([]);
      expect(response.meta.requestId).toBe("empty-feed");
    });
  });

  describe("upstream failure handling", () => {
    it("throws a 502 when the alternate endpoint also returns HTML", async () => {
      getSearchMock()
        .mockResolvedValueOnce(htmlResponse())
        .mockResolvedValueOnce(
          htmlResponse("<!DOCTYPE html><body>login</body>", null),
        );

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-html-html",
        }),
      ).rejects.toMatchObject({
        message: "Merck upstream returned HTML instead of Atom/JSON.",
        statusCode: 502,
      });
      expect(getSearchMock()).toHaveBeenCalledTimes(2);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Merck search failed",
        expect.objectContaining({ requestId: "req-html-html" }),
      );
    });

    it("retries the same endpoint when the base URL is not a JSON search endpoint", async () => {
      process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
        "https://merckvetmanual.com/api/search";
      getSearchMock()
        .mockResolvedValueOnce(htmlResponse("<html>blocked</html>", null))
        .mockResolvedValueOnce(jsonResponse({ feed: { id: "alt-feed" } }));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-alt-same",
      });

      expect(response.meta.requestId).toBe("alt-feed");
      expect(mockedClientConstructor).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          baseUrl: "https://merckvetmanual.com/api/search",
        }),
      );
      // The alternate attempt carries the legacy credential parameter aliases.
      const [altParams] = getSearchMock().mock.calls[1];
      expect(altParams["holder.assignedEntity.name.n"]).toBe("test-user");
      expect(altParams["holder.assignedEntity.certificateText.n"]).toBe(
        "test-pass",
      );
    });

    it("retries once after a connection failure and reports the retry in the log", async () => {
      getSearchMock()
        .mockRejectedValueOnce(axiosFailure())
        .mockResolvedValueOnce(jsonResponse({ feed: { id: "retry-feed" } }));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-retry",
        timezone: "America/Chicago",
      });

      expect(response.meta.requestId).toBe("retry-feed");
      expect(getSearchMock()).toHaveBeenCalledTimes(2);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed after retry",
        expect.objectContaining({
          requestId: "req-retry",
          routingReason: "timezone-us-canada",
        }),
      );
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("retries once after a 5xx upstream response", async () => {
      getSearchMock()
        .mockRejectedValueOnce(axiosFailure({ status: 503 }))
        .mockResolvedValueOnce(jsonResponse({ feed: { id: "retry-5xx" } }));

      const response = await MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-retry-5xx",
      });

      expect(response.meta.requestId).toBe("retry-5xx");
      expect(getSearchMock()).toHaveBeenCalledTimes(2);
    });

    it("logs and rethrows when the retry also fails", async () => {
      const retryError = axiosFailure();
      getSearchMock()
        .mockRejectedValueOnce(axiosFailure())
        .mockRejectedValueOnce(retryError);

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-retry-fail",
        }),
      ).rejects.toBe(retryError);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Merck search retry failed",
        expect.objectContaining({ requestId: "req-retry-fail" }),
      );
      expect(mockedLogger.info).not.toHaveBeenCalled();
    });

    it("fails the retry when the retried response is HTML", async () => {
      getSearchMock()
        .mockRejectedValueOnce(axiosFailure())
        .mockResolvedValueOnce(htmlResponse());

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-retry-html",
        }),
      ).rejects.toMatchObject({
        message: "Merck upstream returned HTML instead of Atom/JSON.",
        statusCode: 502,
      });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Merck search retry failed",
        expect.objectContaining({ requestId: "req-retry-html" }),
      );
    });

    it("does not retry a non-Axios failure", async () => {
      const failure = new Error("client blew up");
      getSearchMock().mockRejectedValueOnce(failure);

      await expect(
        MerckService.searchConsumer({
          query: "canine topic",
          requestId: "req-nonaxios",
        }),
      ).rejects.toBe(failure);

      expect(getSearchMock()).toHaveBeenCalledTimes(1);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Merck search failed",
        expect.objectContaining({ requestId: "req-nonaxios" }),
      );
    });

    it("logs the organisation id on the org-scoped search path", async () => {
      getSearchMock().mockResolvedValueOnce(jsonResponse({ feed: {} }));

      await MerckService.search({
        query: "canine topic",
        organisationId: "org-1",
        requestId: "req-org-ok",
      });

      expect(mockedIntegrationService.ensureMerckAccount).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Merck search completed",
        expect.objectContaining({ organisationId: "org-1" }),
      );
    });
  });
});
