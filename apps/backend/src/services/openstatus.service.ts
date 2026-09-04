import axios from "axios";
import { z } from "zod";
import logger from "src/utils/logger";

const DEFAULT_BASE_URL = "https://api.openstatus.dev/v1";
const REQUEST_TIMEOUT_MS = 10000;

// Shape of the payload OpenStatus POSTs to a webhook notification channel.
// Mirrors PayloadSchema in the OpenStatus webhook provider.
export const openStatusMonitorEventSchema = z.object({
  monitor: z.object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
  }),
  cronTimestamp: z.number(),
  status: z.enum(["degraded", "error", "recovered"]),
  statusCode: z.number().optional(),
  latency: z.number().optional(),
  errorMessage: z.string().optional(),
});

export type OpenStatusMonitorEvent = z.infer<
  typeof openStatusMonitorEventSchema
>;

type StatusReportStatus =
  "investigating" | "identified" | "monitoring" | "resolved";

interface StatusReport {
  id: number;
  title: string;
  status: StatusReportStatus;
  monitorIds?: number[];
  pageId: number;
}

const getApiKey = (): string => {
  const apiKey = process.env.OPENSTATUS_API_KEY;
  if (!apiKey) throw new Error("OPENSTATUS_API_KEY is not set");
  return apiKey;
};

const getBaseUrl = (): string =>
  process.env.OPENSTATUS_API_BASE_URL ?? DEFAULT_BASE_URL;

const getPageId = (): number => {
  const raw = process.env.OPENSTATUS_PAGE_ID;
  const pageId = Number(raw);
  if (!raw || Number.isNaN(pageId)) {
    throw new Error("OPENSTATUS_PAGE_ID is not set or is not a number");
  }
  return pageId;
};

const authHeaders = () => ({
  "x-openstatus-key": getApiKey(),
  "Content-Type": "application/json",
});

const isRecovery = (event: OpenStatusMonitorEvent): boolean =>
  event.status === "recovered";

const buildIncidentTitle = (event: OpenStatusMonitorEvent): string => {
  const suffix =
    event.status === "degraded" ? "degraded performance" : "outage";
  return `${event.monitor.name} ${suffix}`;
};

const buildIncidentMessage = (event: OpenStatusMonitorEvent): string => {
  const parts = [
    `We are investigating a problem detected on ${event.monitor.name}.`,
  ];
  if (typeof event.statusCode === "number") {
    parts.push(`The monitor returned HTTP ${event.statusCode}.`);
  }
  if (event.errorMessage) {
    parts.push(event.errorMessage);
  }
  return parts.join(" ");
};

const buildRecoveryMessage = (event: OpenStatusMonitorEvent): string =>
  `${event.monitor.name} has recovered and is operating normally again.`;

const listStatusReports = async (): Promise<StatusReport[]> => {
  const response = await axios.get<StatusReport[]>(
    `${getBaseUrl()}/status_report`,
    { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS },
  );
  return Array.isArray(response.data) ? response.data : [];
};

const findOpenReportsForMonitor = (
  reports: StatusReport[],
  monitorId: number,
): StatusReport[] =>
  reports.filter(
    (report) =>
      report.status !== "resolved" &&
      (report.monitorIds ?? []).includes(monitorId),
  );

const createStatusReport = async (
  event: OpenStatusMonitorEvent,
): Promise<StatusReport> => {
  const response = await axios.post<StatusReport>(
    `${getBaseUrl()}/status_report`,
    {
      title: buildIncidentTitle(event),
      status: "investigating",
      monitorIds: [event.monitor.id],
      pageId: getPageId(),
      message: buildIncidentMessage(event),
    },
    { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS },
  );
  return response.data;
};

const resolveStatusReport = async (
  report: StatusReport,
  event: OpenStatusMonitorEvent,
): Promise<void> => {
  await axios.post(
    `${getBaseUrl()}/status_report/${report.id}/update`,
    { status: "resolved", message: buildRecoveryMessage(event) },
    { headers: authHeaders(), timeout: REQUEST_TIMEOUT_MS },
  );
};

// Open an incident, unless one is already open for this monitor (idempotent
// against repeated failure webhooks and replays).
const openIncident = async (
  event: OpenStatusMonitorEvent,
): Promise<{ created: boolean }> => {
  const openReports = findOpenReportsForMonitor(
    await listStatusReports(),
    event.monitor.id,
  );

  if (openReports.length > 0) {
    logger.info("OpenStatus: incident already open, skipping create", {
      monitorId: event.monitor.id,
      reportId: openReports[0].id,
    });
    return { created: false };
  }

  const report = await createStatusReport(event);
  logger.info("OpenStatus: opened incident report", {
    monitorId: event.monitor.id,
    reportId: report.id,
  });
  return { created: true };
};

// Resolve every open incident for the monitor. OpenStatus is the source of
// truth, so no local incident state is kept.
const resolveIncident = async (
  event: OpenStatusMonitorEvent,
): Promise<{ resolved: number }> => {
  const openReports = findOpenReportsForMonitor(
    await listStatusReports(),
    event.monitor.id,
  );

  if (openReports.length === 0) {
    logger.info("OpenStatus: no open incident to resolve", {
      monitorId: event.monitor.id,
    });
    return { resolved: 0 };
  }

  for (const report of openReports) {
    await resolveStatusReport(report, event);
  }

  logger.info("OpenStatus: resolved incident report(s)", {
    monitorId: event.monitor.id,
    count: openReports.length,
  });
  return { resolved: openReports.length };
};

export const OpenStatusService = {
  async handleMonitorEvent(event: OpenStatusMonitorEvent) {
    return isRecovery(event) ? resolveIncident(event) : openIncident(event);
  },
};
