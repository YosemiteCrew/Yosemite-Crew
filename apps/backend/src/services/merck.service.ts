import axios from "axios";
import { MerckHealthlinkClient } from "src/integrations/merck/merck.client";
import { IntegrationService } from "src/services/integration.service";
import logger from "src/utils/logger";

type MerckAudience = "PROV" | "PAT";
type MerckLanguage = "en" | "es";
type MerckMedia = "hybrid" | "print" | "full";

export type MerckSearchParams = {
  organisationId: string;
  query: string;
  audience?: MerckAudience;
  language?: MerckLanguage;
  media?: MerckMedia;
  timezone?: string;
  code?: string;
  codeSystem?: string;
  displayName?: string;
  originalText?: string;
  subTopicCode?: string;
  subTopicDisplay?: string;
  requestId: string;
};

export type MerckSearchResponse = {
  meta: {
    requestId: string;
    source: string;
    updatedAt: string | null;
    audience: MerckAudience;
    language: MerckLanguage;
    totalResults: number;
  };
  entries: MerckEntry[];
};

export type MerckEntry = {
  id: string;
  title: string;
  summaryText: string;
  updatedAt: string | null;
  audience: MerckAudience;
  primaryUrl: string;
  subLinks: Array<{ label: string; url: string }>;
};

export class MerckServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MerckServiceError";
  }
}

const ALLOWED_AUDIENCES: MerckAudience[] = ["PROV", "PAT"];
const ALLOWED_LANGUAGES: MerckLanguage[] = ["en", "es"];
const ALLOWED_MEDIA: MerckMedia[] = ["hybrid", "print", "full"];
const MESH_OID = "2.16.840.1.113883.6.177";
const CODE_SYSTEM_NAMES = new Set([
  "ICD9",
  "ICD9CM",
  "ICD10",
  "ICD10CM",
  "LOINC",
  "SNOMED-CT",
]);
const ALLOWED_DOMAINS = ["merckvetmanual.com", "msdvetmanual.com"];
const US_CANADA_TIMEZONES = new Set([
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Los_Angeles",
  "America/Menominee",
  "America/New_York",
  "America/Nome",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Phoenix",
  "America/Sitka",
  "America/Metlakatla",
  "America/Adak",
  "America/Boise",
  "America/Indianapolis",
  "America/Port-au-Prince",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Halifax",
  "America/Winnipeg",
  "America/Regina",
  "America/St_Johns",
  "America/Yellowknife",
  "America/Whitehorse",
  "America/Iqaluit",
  "America/Moncton",
  "America/Atikokan",
  "America/Blanc-Sablon",
  "America/Glace_Bay",
  "America/Goose_Bay",
  "America/Inuvik",
  "America/Rankin_Inlet",
  "America/Swift_Current",
  "America/Thunder_Bay",
  "America/Resolute",
  "America/Ojinaga",
  "America/Pangnirtung",
  "America/Fort_Nelson",
  "America/Creston",
  "America/Dawson",
  "America/Dawson_Creek",
  "America/Cambridge_Bay",
  "America/Nipigon",
  "America/Rainy_River",
]);

const OFFSET_TIMEZONE_REGEX = /^(?:UTC)?[+-](?:0?\d|1\d|2[0-3]):[0-5]\d$/;

const ensureNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new MerckServiceError(`${field} is required.`, 400);
  }
  return value.trim();
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const optionalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined => {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new MerckServiceError(`${field} must be a string.`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = allowed.find((item) => item === trimmed);
  if (!match) {
    throw new MerckServiceError(
      `${field} must be one of: ${allowed.join(", ")}.`,
      400,
    );
  }
  return match;
};

const isAllowedMerckUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};

const isValidIanaTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const isUsCanadaTimezone = (value: string): boolean => {
  if (!value) return false;
  if (OFFSET_TIMEZONE_REGEX.test(value)) return false;
  if (!isValidIanaTimezone(value)) return false;
  if (value.startsWith("US/") || value.startsWith("Canada/")) return true;
  return US_CANADA_TIMEZONES.has(value);
};

const stripHtml = (value: string): string =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractSummaryTextFromHtml = (html: string): string => {
  const match = String(html ?? "").match(/<p[^>]*>(.*?)<\/p>/i);
  if (match?.[1]) {
    return stripHtml(match[1]);
  }
  return stripHtml(html);
};

const extractAnchorLinksFromHtml = (html: string) => {
  const anchors: Array<{ label: string; url: string }> = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  do {
    match = regex.exec(html);
    if (!match) continue;
    const url = String(match[1] ?? "").trim();
    const label = stripHtml(String(match[2] ?? "")).trim();
    if (!url || !label) continue;
    anchors.push({ label, url });
  } while (match);
  return anchors;
};

const canonicalUrlKey = (value: string): string => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/g, "") || "/";
    return `${parsed.hostname.toLowerCase()}${pathname}${parsed.hash ?? ""}`;
  } catch {
    return value;
  }
};

const dedupeAndOrderSubLinks = (
  primaryUrl: string,
  links: Array<{ label: string; url: string }>,
): Array<{ label: string; url: string }> => {
  const seen = new Set<string>();
  const ordered: Array<{ label: string; url: string }> = [];
  const primaryKey = canonicalUrlKey(primaryUrl);
  ordered.push({ label: "Full Summary", url: primaryUrl });
  seen.add(primaryKey);
  links.forEach((link) => {
    const key = canonicalUrlKey(link.url);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(link);
  });
  return ordered;
};

const readTextNode = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const text = String((value as { "#text"?: string })["#text"] ?? "").trim();
    if (text) return text;
  }
  return "";
};

const readHrefNode = (value: unknown): string => {
  if (Array.isArray(value)) {
    return readHrefNode(value[0]);
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const href = String((value as { "@href"?: string })["@href"] ?? "").trim();
    if (href) return href;
  }
  return "";
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
};

const ensureArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
};

const applyMediaMode = (url: string, media: MerckMedia): string => {
  try {
    const parsed = new URL(url);
    if (media === "full") {
      parsed.searchParams.delete("media");
    } else {
      parsed.searchParams.set("media", media);
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

const normalizeEntry = (
  entry: {
    id?: unknown;
    title?: unknown;
    summary?: unknown;
    updated?: unknown;
    link?: unknown;
  },
  audience: MerckAudience,
  media: MerckMedia,
): MerckEntry | null => {
  const id = toStringValue(entry.id)?.trim() ?? "";
  const title = readTextNode(entry.title) || "Manual topic";
  const summaryHtml = readTextNode(entry.summary);
  const summaryText = extractSummaryTextFromHtml(summaryHtml);
  const primaryUrl = readHrefNode(entry.link);
  const subLinks = dedupeAndOrderSubLinks(
    primaryUrl,
    extractAnchorLinksFromHtml(summaryHtml),
  ).filter((link) => isAllowedMerckUrl(link.url));

  if (!id || !primaryUrl || !isAllowedMerckUrl(primaryUrl)) return null;

  return {
    id,
    title,
    summaryText,
    updatedAt: toStringValue(entry.updated),
    audience,
    primaryUrl: applyMediaMode(primaryUrl, media),
    subLinks: subLinks.map((link) => ({
      label: link.label,
      url: applyMediaMode(link.url, media),
    })),
  };
};

const normalizeFromFeedObject = (
  payload: unknown,
  params: {
    audience: MerckAudience;
    language: MerckLanguage;
    media: MerckMedia;
  },
  requestId: string,
): MerckSearchResponse => {
  const feed = (payload as { feed?: Record<string, unknown> })?.feed ?? {};
  const entryNodes = ensureArray(
    (feed as { entry?: unknown }).entry as
      | Array<Record<string, unknown>>
      | Record<string, unknown>
      | undefined,
  );

  const categories = ensureArray(
    (feed as { category?: unknown }).category as
      | Array<Record<string, string>>
      | Record<string, string>
      | undefined,
  );
  const recipient = categories.find(
    (category) =>
      String(category?.["@scheme"] ?? "").toLowerCase() ===
      "informationrecipient",
  );
  const inferredAudience =
    String(recipient?.["@term"] ?? "").toUpperCase() === "PAT" ? "PAT" : "PROV";

  const entries = entryNodes
    .map((node) => normalizeEntry(node, inferredAudience, params.media))
    .filter((item): item is MerckEntry => item != null);

  return {
    meta: {
      requestId: toStringValue((feed as { id?: unknown })?.id) ?? requestId,
      source: "merck-live-feed",
      updatedAt: toStringValue((feed as { updated?: unknown })?.updated),
      audience: inferredAudience ?? params.audience,
      language: params.language,
      totalResults: entries.length,
    },
    entries,
  };
};

const extractXmlTagValue = (xml: string, tag: string): string | null => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  if (!match?.[1]) return null;
  return match[1].trim();
};

const parseXmlAttributes = (tag: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z_:.-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  do {
    match = regex.exec(tag);
    if (!match) continue;
    attrs[match[1]] = match[2];
  } while (match);
  return attrs;
};

const normalizeFromXml = (
  xml: string,
  params: {
    audience: MerckAudience;
    language: MerckLanguage;
    media: MerckMedia;
  },
  requestId: string,
): MerckSearchResponse => {
  const header = xml.split(/<entry[\s>]/i)[0] ?? xml;
  const feedId = extractXmlTagValue(header, "id");
  const feedUpdated = extractXmlTagValue(header, "updated");

  let inferredAudience: MerckAudience = params.audience;
  const categoryMatches = header.match(/<category[^>]*>/gi) ?? [];
  for (const tag of categoryMatches) {
    const attrs = parseXmlAttributes(tag);
    if (String(attrs.scheme ?? "").toLowerCase() === "informationrecipient") {
      const term = String(attrs.term ?? "").toUpperCase();
      if (term === "PAT" || term === "PROV") {
        inferredAudience = term;
      }
    }
  }

  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const entries = entryMatches
    .map((entryXml) => {
      const id = extractXmlTagValue(entryXml, "id");
      const updated = extractXmlTagValue(entryXml, "updated");
      const title = extractXmlTagValue(entryXml, "title");
      const summary = (() => {
        const match = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        return match?.[1] ?? "";
      })();
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/i);
      const link = linkMatch?.[1] ?? "";
      const primaryUrl = isAllowedMerckUrl(link)
        ? link
        : (extractAnchorLinksFromHtml(summary)[0]?.url ?? "");

      if (!id || !primaryUrl || !isAllowedMerckUrl(primaryUrl)) return null;

      const summaryText = extractSummaryTextFromHtml(summary);
      const subLinks = dedupeAndOrderSubLinks(
        primaryUrl,
        extractAnchorLinksFromHtml(summary),
      ).filter((subLink) => isAllowedMerckUrl(subLink.url));

      return {
        id,
        title: title || "Manual topic",
        summaryText,
        updatedAt: updated,
        audience: inferredAudience,
        primaryUrl: applyMediaMode(primaryUrl, params.media),
        subLinks: subLinks.map((link) => ({
          label: link.label,
          url: applyMediaMode(link.url, params.media),
        })),
      } as MerckEntry;
    })
    .filter((entry): entry is MerckEntry => entry != null);

  return {
    meta: {
      requestId: feedId ?? requestId,
      source: "merck-live-atom",
      updatedAt: feedUpdated,
      audience: inferredAudience,
      language: params.language,
      totalResults: entries.length,
    },
    entries,
  };
};

const getMerckClient = (baseUrl: string) => {
  const username = process.env.MERCK_HEALTHLINK_USERNAME;
  const password = process.env.MERCK_HEALTHLINK_PASSWORD;
  const timeout = process.env.MERCK_HEALTHLINK_TIMEOUT_MS;

  if (!baseUrl || !username || !password) {
    throw new MerckServiceError(
      "Merck Healthlink credentials are not configured.",
      500,
    );
  }

  const timeoutMs = timeout ? Number(timeout) : 10000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new MerckServiceError("Invalid Merck timeout configuration.", 500);
  }

  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const isVetHost = ALLOWED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
    if (!isVetHost) {
      throw new MerckServiceError(
        "Merck Healthlink base URL must use the veterinary manuals domain.",
        500,
      );
    }
  } catch (error) {
    if (error instanceof MerckServiceError) throw error;
    throw new MerckServiceError("Merck Healthlink base URL is invalid.", 500);
  }

  return new MerckHealthlinkClient({
    baseUrl,
    username,
    password,
    timeoutMs,
  });
};

const selectMerckBaseUrl = (timezone?: string) => {
  const usCaBase =
    process.env.MERCK_HEALTHLINK_BASE_URL_US_CA ??
    process.env.MERCK_HEALTHLINK_BASE_URL ??
    "";
  const globalBase =
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL ??
    process.env.MERCK_HEALTHLINK_BASE_URL ??
    "";

  const normalizeBase = (value: string) => {
    const trimmed = value.replace(/\/+$/, "");
    if (trimmed.endsWith("/custom/infobutton/search")) {
      return trimmed.replace(
        "/custom/infobutton/search",
        "/infobutton/searchjson",
      );
    }
    return trimmed;
  };

  if (!globalBase && !usCaBase) {
    throw new MerckServiceError(
      "Merck Healthlink base URL is not configured.",
      500,
    );
  }

  if (timezone && isUsCanadaTimezone(timezone)) {
    const selected = normalizeBase(usCaBase || globalBase);
    return {
      baseUrl: selected,
      host: new URL(selected).hostname,
      reason: "timezone-us-canada",
    };
  }

  const selected = normalizeBase(globalBase || usCaBase);
  const reason = timezone
    ? isValidIanaTimezone(timezone)
      ? "timezone-global"
      : "timezone-invalid"
    : "timezone-missing";

  return { baseUrl: selected, host: new URL(selected).hostname, reason };
};

const buildSearchParams = (input: MerckSearchParams) => {
  const audience =
    input.audience ?? (ALLOWED_AUDIENCES.includes("PROV") ? "PROV" : "PAT");
  const language = input.language ?? "en";
  const media = input.media ?? "hybrid";

  const query = input.query.trim();
  const displayName = optionalString(input.displayName) ?? query;
  const originalText = optionalString(input.originalText) ?? query;
  const code = optionalString(input.code);
  const codeSystem = optionalString(input.codeSystem);
  const subTopicCode = optionalString(input.subTopicCode);
  const subTopicDisplay = optionalString(input.subTopicDisplay);

  const username = process.env.MERCK_HEALTHLINK_USERNAME ?? "";
  const password = process.env.MERCK_HEALTHLINK_PASSWORD ?? "";
  const params: Record<string, string> = {
    "holder.assignedEntity.n": username,
    "holder.assignedEntity.certificateText": password,
    "taskContext.c.c": "PROBLISTREV",
    informationRecipient: audience,
    "informationRecipient.languageCode.c": language,
    knowledgeResponseType: "text/json",
  };

  if (code) params["mainSearchCriteria.v.c"] = code;

  if (codeSystem) {
    if (/^\d+(\.\d+)+$/.test(codeSystem)) {
      params["mainSearchCriteria.v.cs"] = codeSystem;
    } else {
      const normalized = codeSystem.toUpperCase().replace(/\s+/g, "");
      if (CODE_SYSTEM_NAMES.has(normalized)) {
        params["mainSearchCriteria.v.csn"] = normalized;
      }
    }
  }

  if (displayName) params["mainSearchCriteria.v.dn"] = displayName;
  if (originalText) params["mainSearchCriteria.v.ot"] = originalText;

  if (subTopicCode || subTopicDisplay) {
    params["subTopic.v.cs"] = MESH_OID;
    if (subTopicCode) params["subTopic.v.c"] = subTopicCode;
    if (subTopicDisplay) params["subTopic.v.dn"] = subTopicDisplay;
  }

  return { params, audience, language, media, username, password };
};

const buildAlternateBaseUrl = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/infobutton/searchjson")) {
    return trimmed.replace(
      "/infobutton/searchjson",
      "/custom/infobutton/search",
    );
  }
  return trimmed;
};

const buildAlternateParams = (params: Record<string, string>) => {
  const next = { ...params };
  const username = params["holder.assignedEntity.n"] ?? "";
  const password = params["holder.assignedEntity.certificateText"] ?? "";
  if (username) next["holder.assignedEntity.name.n"] = username;
  if (password) next["holder.assignedEntity.certificateText.n"] = password;
  return next;
};

const isHtmlPayload = (contentType: string | null, data: string) => {
  if (contentType && contentType.toLowerCase().includes("text/html"))
    return true;
  const trimmed = data.trim().toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
};

const shouldRetry = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return error.response.status >= 500;
};

const parsePayload = (
  raw: string,
  params: {
    audience: MerckAudience;
    language: MerckLanguage;
    media: MerckMedia;
  },
  requestId: string,
): MerckSearchResponse => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return normalizeFromFeedObject(parsed, params, requestId);
    }
  } catch {
    // Fall through to XML parsing.
  }
  return normalizeFromXml(raw, params, requestId);
};

export const MerckService = {
  async search(input: MerckSearchParams): Promise<MerckSearchResponse> {
    const organisationId = ensureNonEmptyString(
      input.organisationId,
      "organisationId",
    );
    const query = ensureNonEmptyString(input.query, "q");

    const audience = optionalEnum(
      input.audience,
      ALLOWED_AUDIENCES,
      "audience",
    );
    const language = optionalEnum(
      input.language,
      ALLOWED_LANGUAGES,
      "language",
    );
    const media = optionalEnum(input.media, ALLOWED_MEDIA, "media");

    const merck = (await IntegrationService.ensureMerckAccount(
      organisationId,
    )) as { status?: string };
    if (merck.status === "disabled") {
      throw new MerckServiceError(
        "Merck Manuals is disabled for this organization.",
        403,
      );
    }

    const {
      params,
      audience: resolvedAudience,
      language: resolvedLanguage,
      media: resolvedMedia,
    } = buildSearchParams({
      ...input,
      query,
      audience: audience ?? "PROV",
      language: language ?? "en",
      media: media ?? "hybrid",
    });

    const routing = selectMerckBaseUrl(input.timezone);
    const client = getMerckClient(routing.baseUrl);
    const start = Date.now();
    try {
      const upstream = await client.search(params, {
        Accept:
          "application/json, application/atom+xml, text/xml;q=0.9, */*;q=0.1",
      });

      let responsePayload = upstream.data;
      if (isHtmlPayload(upstream.contentType, upstream.data)) {
        const altBaseUrl = buildAlternateBaseUrl(routing.baseUrl);
        const altParams = buildAlternateParams(params);
        const altClient = getMerckClient(altBaseUrl);
        const altUpstream = await altClient.search(altParams, {
          Accept:
            "application/json, application/atom+xml, text/xml;q=0.9, */*;q=0.1",
        });
        if (isHtmlPayload(altUpstream.contentType, altUpstream.data)) {
          throw new MerckServiceError(
            "Merck upstream returned HTML instead of Atom/JSON.",
            502,
          );
        }
        responsePayload = altUpstream.data;
      }

      const response = parsePayload(
        responsePayload,
        {
          audience: resolvedAudience,
          language: resolvedLanguage,
          media: resolvedMedia,
        },
        input.requestId,
      );
      logger.info("Merck search completed", {
        organisationId,
        upstreamHost: routing.host,
        upstreamBaseUrl: routing.baseUrl,
        routingReason: routing.reason,
        timezone: input.timezone ?? null,
        audience: resolvedAudience,
        language: resolvedLanguage,
        media: resolvedMedia,
        durationMs: Date.now() - start,
        requestId: input.requestId,
      });
      return response;
    } catch (error) {
      if (shouldRetry(error)) {
        try {
          const upstream = await client.search(params, {
            Accept:
              "application/json, application/atom+xml, text/xml;q=0.9, */*;q=0.1",
          });
          if (isHtmlPayload(upstream.contentType, upstream.data)) {
            throw new MerckServiceError(
              "Merck upstream returned HTML instead of Atom/JSON.",
              502,
            );
          }
          const response = parsePayload(
            upstream.data,
            {
              audience: resolvedAudience,
              language: resolvedLanguage,
              media: resolvedMedia,
            },
            input.requestId,
          );
          logger.info("Merck search completed after retry", {
            organisationId,
            upstreamHost: routing.host,
            upstreamBaseUrl: routing.baseUrl,
            routingReason: routing.reason,
            timezone: input.timezone ?? null,
            audience: resolvedAudience,
            language: resolvedLanguage,
            media: resolvedMedia,
            durationMs: Date.now() - start,
            requestId: input.requestId,
          });
          return response;
        } catch (retryError) {
          logger.error("Merck search retry failed", {
            organisationId,
            requestId: input.requestId,
            upstreamHost: routing.host,
            upstreamBaseUrl: routing.baseUrl,
            routingReason: routing.reason,
            timezone: input.timezone ?? null,
            error: retryError,
          });
          throw retryError;
        }
      }

      logger.error("Merck search failed", {
        organisationId,
        requestId: input.requestId,
        upstreamHost: routing.host,
        upstreamBaseUrl: routing.baseUrl,
        routingReason: routing.reason,
        timezone: input.timezone ?? null,
        error,
      });
      throw error;
    }
  },
};
