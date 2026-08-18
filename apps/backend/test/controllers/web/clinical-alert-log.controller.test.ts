import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { ClinicalAlertLogController } from "src/controllers/web/clinical-alert-log.controller";
import {
  ClinicalAlertLogService,
  ClinicalAlertLogError,
} from "src/services/clinical-alert-log.service";

jest.mock("src/services/clinical-alert-log.service", () => {
  const actual = jest.requireActual(
    "src/services/clinical-alert-log.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ClinicalAlertLogService: {
      trigger: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      acknowledge: jest.fn(),
      dismiss: jest.fn(),
    },
  };
});

const service = jest.mocked(ClinicalAlertLogService);

type MockResponse = Response & {
  json: jest.Mock;
  send: jest.Mock;
  status: jest.Mock;
};

const buildResponse = (): MockResponse => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as MockResponse;
};

const ORG = "org-alert-1";
const ALERT_ID = "alert-1";
const PATIENT_ID = "patient-1";

const buildRequest = (
  overrides: {
    params?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: unknown;
  } = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  }) as unknown as Request;

/** The zod failure envelope every handler returns: `{ error: ZodIssue[] }`. */
const issuePaths = (res: MockResponse): string[][] => {
  const payload = res.json.mock.calls[0]?.[0] as {
    error: { path: (string | number)[] }[];
  };
  return payload.error.map((issue) => issue.path.map(String));
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ClinicalAlertLogController.trigger", () => {
  it("scopes the alert to the route organisation and answers 201 with the stored record", async () => {
    const stored = { id: ALERT_ID, severity: "CRITICAL" };
    service.trigger.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicalAlertLogController.trigger(
      buildRequest({
        body: {
          patientId: PATIENT_ID,
          encounterId: "enc-1",
          alertType: "DRUG_INTERACTION",
          severity: "CRITICAL",
          title: "NSAID with corticosteroid",
          body: "Concurrent use raises GI ulceration risk.",
          triggeredBy: "user-7",
        },
      }),
      res,
    );

    expect(service.trigger).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: PATIENT_ID,
      encounterId: "enc-1",
      alertType: "DRUG_INTERACTION",
      severity: "CRITICAL",
      title: "NSAID with corticosteroid",
      body: "Concurrent use raises GI ulceration risk.",
      triggeredBy: "user-7",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  // The organisation must come from the resolved route param, never from a
  // client-supplied body key, or an alert could be filed against another clinic.
  it("ignores an organisationId supplied in the body", async () => {
    service.trigger.mockResolvedValue({ id: ALERT_ID } as never);

    await ClinicalAlertLogController.trigger(
      buildRequest({
        body: {
          organisationId: "org-attacker",
          patientId: PATIENT_ID,
          alertType: "OTHER",
          title: "Manual note",
        },
      }),
      buildResponse(),
    );

    expect(service.trigger).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: PATIENT_ID,
      alertType: "OTHER",
      title: "Manual note",
    });
  });

  it("rejects an unknown alert type without reaching the service", async () => {
    const res = buildResponse();

    await ClinicalAlertLogController.trigger(
      buildRequest({
        body: {
          patientId: PATIENT_ID,
          alertType: "MADE_UP",
          title: "Bogus",
        },
      }),
      res,
    );

    expect(service.trigger).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["alertType"]]);
  });

  it("rejects a payload missing the patient and the title", async () => {
    const res = buildResponse();

    await ClinicalAlertLogController.trigger(
      buildRequest({ body: { alertType: "DOSE_CHECK" } }),
      res,
    );

    expect(service.trigger).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["patientId"], ["title"]]);
  });
});

describe("ClinicalAlertLogController.get", () => {
  it("reads the alert by id within the route organisation", async () => {
    const alert = { id: ALERT_ID };
    service.get.mockResolvedValue(alert as never);
    const res = buildResponse();

    await ClinicalAlertLogController.get(
      buildRequest({ params: { alertId: ALERT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(ALERT_ID, ORG);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(alert);
  });

  // No try/catch in the controller: a cross-organisation read has to reach the
  // express error handler as the service's 404, not be answered with a body.
  it("lets the service 404 propagate instead of answering", async () => {
    service.get.mockRejectedValue(
      new ClinicalAlertLogError("Clinical alert not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      ClinicalAlertLogController.get(
        buildRequest({ params: { alertId: "other-org-alert" } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Clinical alert not found.",
      statusCode: 404,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("ClinicalAlertLogController.list", () => {
  it("transforms dismissed=true into a boolean filter and forwards the rest", async () => {
    const alerts = [{ id: ALERT_ID }];
    service.list.mockResolvedValue(alerts as never);
    const res = buildResponse();

    await ClinicalAlertLogController.list(
      buildRequest({
        query: {
          patientId: PATIENT_ID,
          encounterId: "enc-1",
          severity: "WARNING",
          alertType: "ABNORMAL_VITALS",
          dismissed: "true",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: PATIENT_ID,
      encounterId: "enc-1",
      severity: "WARNING",
      alertType: "ABNORMAL_VITALS",
      dismissed: true,
    });
    expect(res.json).toHaveBeenCalledWith(alerts);
  });

  it("transforms dismissed=false into false rather than dropping the filter", async () => {
    service.list.mockResolvedValue([] as never);

    await ClinicalAlertLogController.list(
      buildRequest({ query: { dismissed: "false" } }),
      buildResponse(),
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      dismissed: false,
    });
  });

  it("omits every optional filter key when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);

    await ClinicalAlertLogController.list(buildRequest(), buildResponse());

    const [args] = service.list.mock.calls[0] as [Record<string, unknown>];
    expect(args).toEqual({ organisationId: ORG });
    expect(Object.keys(args)).toEqual(["organisationId"]);
  });

  it("rejects a dismissed value that is not the string true or false", async () => {
    const res = buildResponse();

    await ClinicalAlertLogController.list(
      buildRequest({ query: { dismissed: "1" } }),
      res,
    );

    expect(service.list).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["dismissed"]]);
  });

  it("rejects an unknown severity", async () => {
    const res = buildResponse();

    await ClinicalAlertLogController.list(
      buildRequest({ query: { severity: "FATAL" } }),
      res,
    );

    expect(service.list).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["severity"]]);
  });
});

describe("ClinicalAlertLogController.acknowledge", () => {
  it("passes the acknowledging user and note as positional arguments", async () => {
    const acknowledged = { id: ALERT_ID, acknowledgedBy: "user-7" };
    service.acknowledge.mockResolvedValue(acknowledged as never);
    const res = buildResponse();

    await ClinicalAlertLogController.acknowledge(
      buildRequest({
        params: { alertId: ALERT_ID },
        body: { acknowledgedBy: "user-7", note: "Dose adjusted." },
      }),
      res,
    );

    expect(service.acknowledge).toHaveBeenCalledWith(
      ALERT_ID,
      ORG,
      "user-7",
      "Dose adjusted.",
    );
    expect(res.json).toHaveBeenCalledWith(acknowledged);
  });

  it("passes undefined for an omitted note", async () => {
    service.acknowledge.mockResolvedValue({ id: ALERT_ID } as never);

    await ClinicalAlertLogController.acknowledge(
      buildRequest({
        params: { alertId: ALERT_ID },
        body: { acknowledgedBy: "user-7" },
      }),
      buildResponse(),
    );

    expect(service.acknowledge).toHaveBeenCalledWith(
      ALERT_ID,
      ORG,
      "user-7",
      undefined,
    );
  });

  // An acknowledgement is an audit trail entry, so it is worthless without the
  // acknowledging user - the handler must refuse rather than record an anonymous one.
  it("rejects an acknowledgement with no acknowledgedBy", async () => {
    const res = buildResponse();

    await ClinicalAlertLogController.acknowledge(
      buildRequest({
        params: { alertId: ALERT_ID },
        body: { note: "Seen it." },
      }),
      res,
    );

    expect(service.acknowledge).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["acknowledgedBy"]]);
  });
});

describe("ClinicalAlertLogController.dismiss", () => {
  it("dismisses the alert within the route organisation", async () => {
    const dismissed = { id: ALERT_ID, dismissed: true };
    service.dismiss.mockResolvedValue(dismissed as never);
    const res = buildResponse();

    await ClinicalAlertLogController.dismiss(
      buildRequest({ params: { alertId: ALERT_ID } }),
      res,
    );

    expect(service.dismiss).toHaveBeenCalledWith(ALERT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(dismissed);
  });

  it("lets the already-dismissed conflict propagate", async () => {
    service.dismiss.mockRejectedValue(
      new ClinicalAlertLogError("Alert is already dismissed.", 409) as never,
    );
    const res = buildResponse();

    await expect(
      ClinicalAlertLogController.dismiss(
        buildRequest({ params: { alertId: ALERT_ID } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Alert is already dismissed.",
      statusCode: 409,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});
