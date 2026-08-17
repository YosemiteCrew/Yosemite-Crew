import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

/**
 * Shared driver for the clinical CRUD controllers built on
 * `createClinicalHandlers` (src/controllers/web/shared/clinical-controller.helpers.ts).
 *
 * Those controllers are declarative: each handler owns a zod schema, a success
 * status, a fallback message and a `run` closure that maps the validated
 * request onto one service call. The behaviour worth pinning down is therefore
 * the mapping itself - which service method is reached, the exact argument
 * shape it receives (organisation scoping, `userId` stamping, ISO string to
 * `Date` coercion, query-string to boolean transforms), the success status, and
 * the two error routes. This driver asserts all of that per handler so the
 * per-controller test files only have to describe the contract.
 */

/** A valid uuid used as the RBAC-resolved organisation on every request. */
export const ORG_ID = "11111111-1111-4111-8111-111111111111";
/** The authenticated user id the handlers stamp onto create payloads. */
export const USER_ID = "user_clinical_1";
/** Spare uuids for route params and payload references. */
export const RECORD_ID = "22222222-2222-4222-8222-222222222222";
export const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
export const ENCOUNTER_ID = "44444444-4444-4444-8444-444444444444";
export const SECOND_ID = "55555555-5555-4555-8555-555555555555";

type ClinicalHandler = (req: Request, res: Response) => Promise<Response>;

export type ServiceErrorCtor = new (
  message: string,
  statusCode: number,
) => Error;

export type ClinicalCase = {
  /** Key of the handler on the controller object. */
  handler: string;
  /** Route params after RBAC resolution. */
  params: Record<string, string>;
  /** Request body, for handlers that declare a `body` schema. */
  body?: unknown;
  /** Request query, for handlers that declare a `query` schema. */
  query?: Record<string, unknown>;
  /** Name of the service method the handler must delegate to. */
  serviceMethod: string;
  /** Exact arguments the service method must be called with. */
  expectArgs: unknown[];
  /** Success status; defaults to 200. */
  status?: 200 | 201 | 204;
  /** The handler's own `fallback` message, returned on an unknown error. */
  fallback: string;
  /**
   * A body/query payload the handler's own schema must reject. Only meaningful
   * for handlers that declare one.
   */
  invalidPayload?: unknown;
  /** Value the mocked service resolves with; defaults to a sentinel record. */
  resolved?: unknown;
  /**
   * Drives the handler with no authenticated user on the request, for the
   * handlers that substitute a placeholder when `userId` is absent.
   */
  withoutUser?: boolean;
};

export type ClinicalSuiteSpec = {
  /** Name of the exported controller, used for the describe block. */
  name: string;
  controller: Record<string, unknown>;
  /** The jest-mocked service object the controller delegates to. */
  service: Record<string, unknown>;
  /** The service's error class, still the real one via `jest.requireActual`. */
  errorClass: ServiceErrorCtor;
  cases: ClinicalCase[];
};

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
};

const buildResponse = (): MockResponse => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as MockResponse;
};

const buildRequest = (testCase: ClinicalCase): Request =>
  ({
    params: testCase.params,
    query: testCase.query ?? {},
    body: testCase.body ?? {},
    ...(testCase.withoutUser ? {} : { userId: USER_ID }),
  }) as unknown as Request;

const statusOf = (res: MockResponse): unknown => res.status.mock.calls[0]?.[0];

/**
 * Breaks one route param so the shared params guard rejects the request before
 * any controller-specific parsing runs.
 */
const withBrokenParams = (testCase: ClinicalCase): ClinicalCase => ({
  ...testCase,
  params: { ...testCase.params, organisationId: "not-a-uuid" },
});

export const runClinicalControllerSuite = (spec: ClinicalSuiteSpec): void => {
  const handlerOf = (name: string): ClinicalHandler => {
    const handler = spec.controller[name];
    if (typeof handler !== "function") {
      throw new Error(`${spec.name} has no handler named "${name}"`);
    }
    return handler as ClinicalHandler;
  };

  const serviceMock = (name: string): jest.Mock => {
    const method = spec.service[name];
    if (typeof method !== "function") {
      throw new Error(`${spec.name} service has no mock named "${name}"`);
    }
    return method as jest.Mock;
  };

  describe(spec.name, () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("exposes every handler named in the contract", () => {
      for (const testCase of spec.cases) {
        expect(typeof spec.controller[testCase.handler]).toBe("function");
      }
    });

    describe.each(spec.cases.map((c) => [c.handler, c] as const))(
      "%s",
      (_name, testCase) => {
        const expectedStatus = testCase.status ?? 200;

        it(`delegates to ${testCase.serviceMethod} and answers ${expectedStatus}`, async () => {
          const resolved =
            testCase.resolved ?? ({ id: RECORD_ID } as Record<string, unknown>);
          const service = serviceMock(testCase.serviceMethod);
          service.mockResolvedValue(resolved as never);
          const res = buildResponse();

          await handlerOf(testCase.handler)(buildRequest(testCase), res);

          expect(service).toHaveBeenCalledTimes(1);
          expect(service).toHaveBeenCalledWith(...testCase.expectArgs);
          expect(statusOf(res)).toBe(expectedStatus);
          if (expectedStatus === 204) {
            expect(res.send).toHaveBeenCalledWith();
            expect(res.json).not.toHaveBeenCalled();
          } else {
            expect(res.json).toHaveBeenCalledWith(resolved);
          }
        });

        it("answers 400 and never reaches the service when a route param is malformed", async () => {
          const service = serviceMock(testCase.serviceMethod);
          const res = buildResponse();

          await handlerOf(testCase.handler)(
            buildRequest(withBrokenParams(testCase)),
            res,
          );

          expect(statusOf(res)).toBe(400);
          expect(res.json).toHaveBeenCalledWith({
            message: "Invalid route parameters",
          });
          expect(service).not.toHaveBeenCalled();
        });

        if (testCase.invalidPayload !== undefined) {
          const key = testCase.body !== undefined ? "body" : "query";
          it(`answers 400 and never reaches the service when the ${key} fails validation`, async () => {
            const service = serviceMock(testCase.serviceMethod);
            const res = buildResponse();
            const broken: ClinicalCase =
              key === "body"
                ? { ...testCase, body: testCase.invalidPayload }
                : {
                    ...testCase,
                    query: testCase.invalidPayload as Record<string, unknown>,
                  };

            await handlerOf(testCase.handler)(buildRequest(broken), res);

            expect(statusOf(res)).toBe(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ message: expect.any(String) }),
            );
            expect(service).not.toHaveBeenCalled();
          });
        }

        it("passes the service error status and message straight through", async () => {
          const service = serviceMock(testCase.serviceMethod);
          service.mockRejectedValue(
            new spec.errorClass("Record not found", 404) as never,
          );
          const res = buildResponse();

          await handlerOf(testCase.handler)(buildRequest(testCase), res);

          expect(statusOf(res)).toBe(404);
          expect(res.json).toHaveBeenCalledWith({
            message: "Record not found",
          });
        });

        it("answers 500 with its own fallback message on an unexpected error", async () => {
          const service = serviceMock(testCase.serviceMethod);
          service.mockRejectedValue(new Error("connection reset") as never);
          const res = buildResponse();

          await handlerOf(testCase.handler)(buildRequest(testCase), res);

          expect(statusOf(res)).toBe(500);
          expect(res.json).toHaveBeenCalledWith({
            message: testCase.fallback,
          });
        });
      },
    );
  });
};
