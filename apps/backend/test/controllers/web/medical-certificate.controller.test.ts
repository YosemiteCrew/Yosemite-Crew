import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { MedicalCertificateController } from "../../../src/controllers/web/medical-certificate.controller";
import {
  MedicalCertificateService,
  MedicalCertificateError,
} from "../../../src/services/medical-certificate.service";

jest.mock("../../../src/services/medical-certificate.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/medical-certificate.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    MedicalCertificateService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      issue: jest.fn(),
      revoke: jest.fn(),
      expire: jest.fn(),
    },
  };
});

const service = jest.mocked(MedicalCertificateService);

const buildResponse = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as Response & {
    json: jest.Mock;
    send: jest.Mock;
    status: jest.Mock;
  };
};

const ORG = "org-1";
const CERT_ID = "cert-1";

const buildRequest = (
  overrides: Partial<{
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
  }> = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("MedicalCertificateController.create", () => {
  it("stamps the organisation from the route and answers 201", async () => {
    const stored = { id: CERT_ID, status: "DRAFT" };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await MedicalCertificateController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          certificateType: "FIT_FOR_TRAVEL",
          validForTravel: true,
          destinationCountry: "FR",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      clientId: "client-1",
      certificateType: "FIT_FOR_TRAVEL",
      validForTravel: true,
      destinationCountry: "FR",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an unknown certificate type with 400 and never calls the service", async () => {
    const res = buildResponse();

    await MedicalCertificateController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          certificateType: "PET_OF_THE_MONTH",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: expect.any(Array) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await MedicalCertificateController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          certificateType: "OTHER",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("MedicalCertificateController.get", () => {
  it("looks the certificate up inside the organisation", async () => {
    const stored = { id: CERT_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await MedicalCertificateController.get(
      buildRequest({ params: { certId: CERT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(CERT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      new MedicalCertificateError("Certificate not found.", 404) as never,
    );
    const res = buildResponse();

    await MedicalCertificateController.get(
      buildRequest({ params: { certId: CERT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Certificate not found.",
    });
  });
});

describe("MedicalCertificateController.list", () => {
  it("forwards a recognised status and certificate type", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await MedicalCertificateController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          clientId: "client-1",
          status: "ISSUED",
          certificateType: "EXPORT_CERTIFICATE",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      clientId: "client-1",
      status: "ISSUED",
      certificateType: "EXPORT_CERTIFICATE",
    });
  });

  it("drops unrecognised filters instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await MedicalCertificateController.list(
      buildRequest({ query: { status: "PRINTED", certificateType: "POSTER" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: undefined,
      clientId: undefined,
      status: undefined,
      certificateType: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await MedicalCertificateController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("MedicalCertificateController.issue", () => {
  it("coerces the expiry date", async () => {
    const stored = { id: CERT_ID, status: "ISSUED" };
    service.issue.mockResolvedValue(stored as never);
    const res = buildResponse();

    await MedicalCertificateController.issue(
      buildRequest({
        params: { certId: CERT_ID },
        body: {
          issuedBy: "Dr Ito",
          expiresAt: "2026-09-01T00:00:00.000Z",
          clinicalFindings: "Healthy on examination",
        },
      }),
      res,
    );

    expect(service.issue).toHaveBeenCalledWith(CERT_ID, ORG, {
      issuedBy: "Dr Ito",
      clinicalFindings: "Healthy on examination",
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves the expiry undefined when the certificate does not expire", async () => {
    service.issue.mockResolvedValue({ id: CERT_ID } as never);
    const res = buildResponse();

    await MedicalCertificateController.issue(
      buildRequest({
        params: { certId: CERT_ID },
        body: { issuedBy: "Dr Ito" },
      }),
      res,
    );

    expect(service.issue).toHaveBeenCalledWith(CERT_ID, ORG, {
      issuedBy: "Dr Ito",
      expiresAt: undefined,
    });
  });

  it("requires an issuer", async () => {
    const res = buildResponse();

    await MedicalCertificateController.issue(
      buildRequest({ params: { certId: CERT_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.issue).not.toHaveBeenCalled();
  });

  it("passes an already-issued conflict through", async () => {
    service.issue.mockRejectedValue(
      new MedicalCertificateError("Certificate already issued.", 409) as never,
    );
    const res = buildResponse();

    await MedicalCertificateController.issue(
      buildRequest({
        params: { certId: CERT_ID },
        body: { issuedBy: "Dr Ito" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Certificate already issued.",
    });
  });
});

describe("MedicalCertificateController.revoke", () => {
  it("forwards the revoking user and reason", async () => {
    const stored = { id: CERT_ID, status: "REVOKED" };
    service.revoke.mockResolvedValue(stored as never);
    const res = buildResponse();

    await MedicalCertificateController.revoke(
      buildRequest({
        params: { certId: CERT_ID },
        body: { revokedBy: "Dr Ito", revokedReason: "Issued in error" },
      }),
      res,
    );

    expect(service.revoke).toHaveBeenCalledWith(
      CERT_ID,
      ORG,
      "Dr Ito",
      "Issued in error",
    );
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("revokes without a reason when none is given", async () => {
    service.revoke.mockResolvedValue({ id: CERT_ID } as never);
    const res = buildResponse();

    await MedicalCertificateController.revoke(
      buildRequest({
        params: { certId: CERT_ID },
        body: { revokedBy: "Dr Ito" },
      }),
      res,
    );

    expect(service.revoke).toHaveBeenCalledWith(
      CERT_ID,
      ORG,
      "Dr Ito",
      undefined,
    );
  });

  it("requires a revoking user", async () => {
    const res = buildResponse();

    await MedicalCertificateController.revoke(
      buildRequest({ params: { certId: CERT_ID }, body: { revokedBy: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.revoke).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.revoke.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await MedicalCertificateController.revoke(
      buildRequest({
        params: { certId: CERT_ID },
        body: { revokedBy: "Dr Ito" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("MedicalCertificateController.expire", () => {
  it("expires the certificate", async () => {
    const stored = { id: CERT_ID, status: "EXPIRED" };
    service.expire.mockResolvedValue(stored as never);
    const res = buildResponse();

    await MedicalCertificateController.expire(
      buildRequest({ params: { certId: CERT_ID } }),
      res,
    );

    expect(service.expire).toHaveBeenCalledWith(CERT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.expire.mockRejectedValue(
      new MedicalCertificateError("Certificate not found.", 404) as never,
    );
    const res = buildResponse();

    await MedicalCertificateController.expire(
      buildRequest({ params: { certId: CERT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Certificate not found.",
    });
  });
});
