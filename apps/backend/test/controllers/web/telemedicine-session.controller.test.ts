import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TelemedicineSessionController } from "src/controllers/web/telemedicine-session.controller";
import {
  TelemedicineSessionService,
  TelemedicineSessionError,
} from "src/services/telemedicine-session.service";

jest.mock("src/services/telemedicine-session.service", () => {
  const actual = jest.requireActual(
    "src/services/telemedicine-session.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    TelemedicineSessionService: {
      schedule: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      start: jest.fn(),
      complete: jest.fn(),
      cancel: jest.fn(),
      markNoShow: jest.fn(),
    },
  };
});

const service = jest.mocked(TelemedicineSessionService);

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

const ORG = "org-telemed-1";
const SESSION_ID = "session-1";
const CLIENT_ID = "client-1";
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

const issuePaths = (res: MockResponse): string[][] => {
  const payload = res.json.mock.calls[0]?.[0] as {
    error: { path: (string | number)[] }[];
  };
  return payload.error.map((issue) => issue.path.map(String));
};

/** Every state transition handler takes (sessionId, organisationId) and 200s. */
const transitions = [
  { handler: "start", method: "start" },
  { handler: "cancel", method: "cancel" },
  { handler: "markNoShow", method: "markNoShow" },
] as const;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TelemedicineSessionController.schedule", () => {
  it("scopes the session to the route organisation and answers 201", async () => {
    const stored = { id: SESSION_ID, status: "SCHEDULED" };
    service.schedule.mockResolvedValue(stored as never);
    const res = buildResponse();

    await TelemedicineSessionController.schedule(
      buildRequest({
        body: {
          clientId: CLIENT_ID,
          patientId: PATIENT_ID,
          appointmentId: "appt-1",
          platform: "VIDEO_CALL",
          conductedBy: "vet-1",
          chiefComplaint: "Persistent cough",
          externalSessionId: "zoom-abc",
        },
      }),
      res,
    );

    expect(service.schedule).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: CLIENT_ID,
      patientId: PATIENT_ID,
      appointmentId: "appt-1",
      platform: "VIDEO_CALL",
      conductedBy: "vet-1",
      chiefComplaint: "Persistent cough",
      externalSessionId: "zoom-abc",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  // A body-supplied organisationId must never win over the RBAC-resolved route
  // param, or a session could be booked into another clinic's calendar.
  it("ignores an organisationId supplied in the body and drops unknown keys", async () => {
    service.schedule.mockResolvedValue({ id: SESSION_ID } as never);

    await TelemedicineSessionController.schedule(
      buildRequest({
        body: {
          organisationId: "org-attacker",
          clientId: CLIENT_ID,
          platform: "PHONE_CALL",
          status: "COMPLETED",
        },
      }),
      buildResponse(),
    );

    const [args] = service.schedule.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(args).toEqual({
      organisationId: ORG,
      clientId: CLIENT_ID,
      platform: "PHONE_CALL",
    });
    expect(args).not.toHaveProperty("status");
  });

  it("rejects a schedule with no client and no platform", async () => {
    const res = buildResponse();

    await TelemedicineSessionController.schedule(
      buildRequest({ body: { chiefComplaint: "Itchy ears" } }),
      res,
    );

    expect(service.schedule).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["clientId"], ["platform"]]);
  });

  it("rejects an unsupported platform", async () => {
    const res = buildResponse();

    await TelemedicineSessionController.schedule(
      buildRequest({ body: { clientId: CLIENT_ID, platform: "SMS" } }),
      res,
    );

    expect(service.schedule).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["platform"]]);
  });
});

describe("TelemedicineSessionController.get", () => {
  it("reads the session by id within the route organisation", async () => {
    const session = { id: SESSION_ID };
    service.get.mockResolvedValue(session as never);
    const res = buildResponse();

    await TelemedicineSessionController.get(
      buildRequest({ params: { sessionId: SESSION_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(SESSION_ID, ORG);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(session);
  });

  it("lets the not-found error propagate instead of answering", async () => {
    service.get.mockRejectedValue(
      new TelemedicineSessionError(
        "Telemedicine session not found.",
        404,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      TelemedicineSessionController.get(
        buildRequest({ params: { sessionId: "other-org-session" } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Telemedicine session not found.",
      statusCode: 404,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("TelemedicineSessionController.list", () => {
  it("forwards every supported filter", async () => {
    const sessions = [{ id: SESSION_ID }];
    service.list.mockResolvedValue(sessions as never);
    const res = buildResponse();

    await TelemedicineSessionController.list(
      buildRequest({
        query: {
          clientId: CLIENT_ID,
          patientId: PATIENT_ID,
          status: "IN_PROGRESS",
          platform: "CHAT",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: CLIENT_ID,
      patientId: PATIENT_ID,
      status: "IN_PROGRESS",
      platform: "CHAT",
    });
    expect(res.json).toHaveBeenCalledWith(sessions);
  });

  it("omits every optional filter key when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);

    await TelemedicineSessionController.list(buildRequest(), buildResponse());

    const [args] = service.list.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(args).toEqual({ organisationId: ORG });
    expect(Object.keys(args)).toEqual(["organisationId"]);
  });

  it("rejects an unknown status filter", async () => {
    const res = buildResponse();

    await TelemedicineSessionController.list(
      buildRequest({ query: { status: "ARCHIVED" } }),
      res,
    );

    expect(service.list).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["status"]]);
  });
});

describe("TelemedicineSessionController.complete", () => {
  it("forwards the clinician notes, follow-up flag and recording url", async () => {
    const completed = { id: SESSION_ID, status: "COMPLETED" };
    service.complete.mockResolvedValue(completed as never);
    const res = buildResponse();

    await TelemedicineSessionController.complete(
      buildRequest({
        params: { sessionId: SESSION_ID },
        body: {
          clinicianNotes: "Advised a follow-up in two weeks.",
          followUpRequired: true,
          recordingUrl: "https://recordings.example/session-1",
        },
      }),
      res,
    );

    expect(service.complete).toHaveBeenCalledWith(SESSION_ID, ORG, {
      clinicianNotes: "Advised a follow-up in two weeks.",
      followUpRequired: true,
      recordingUrl: "https://recordings.example/session-1",
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(completed);
  });

  // Every field is optional, so an empty body is a valid completion and must
  // reach the service as an empty patch rather than a 400.
  it("passes an empty patch through when the body is empty", async () => {
    service.complete.mockResolvedValue({ id: SESSION_ID } as never);

    await TelemedicineSessionController.complete(
      buildRequest({ params: { sessionId: SESSION_ID } }),
      buildResponse(),
    );

    expect(service.complete).toHaveBeenCalledWith(SESSION_ID, ORG, {});
  });

  it("rejects a non-boolean followUpRequired", async () => {
    const res = buildResponse();

    await TelemedicineSessionController.complete(
      buildRequest({
        params: { sessionId: SESSION_ID },
        body: { followUpRequired: "yes" },
      }),
      res,
    );

    expect(service.complete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["followUpRequired"]]);
  });

  // Completing a session that never started is a service-side state conflict;
  // the controller must not turn it into a 200.
  it("lets an invalid state transition propagate", async () => {
    service.complete.mockRejectedValue(
      new TelemedicineSessionError(
        "Only an in-progress session can be completed.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      TelemedicineSessionController.complete(
        buildRequest({ params: { sessionId: SESSION_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe.each(transitions)(
  "TelemedicineSessionController.$handler",
  ({ handler, method }) => {
    it("delegates with the session id and route organisation and answers 200", async () => {
      const session = { id: SESSION_ID };
      service[method].mockResolvedValue(session as never);
      const res = buildResponse();

      await TelemedicineSessionController[handler](
        buildRequest({ params: { sessionId: SESSION_ID } }),
        res,
      );

      expect(service[method]).toHaveBeenCalledWith(SESSION_ID, ORG);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(session);
    });

    it("lets a state conflict propagate without answering", async () => {
      service[method].mockRejectedValue(
        new TelemedicineSessionError(
          "Session is not in a state that allows this transition.",
          409,
        ) as never,
      );
      const res = buildResponse();

      await expect(
        TelemedicineSessionController[handler](
          buildRequest({ params: { sessionId: SESSION_ID } }),
          res,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(res.json).not.toHaveBeenCalled();
    });
  },
);
