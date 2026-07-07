import type { Router } from "express";

const authorizeApiKey = jest.fn((_req, _res, next) => next());
const authorizeApiKeyVerifyOnly = jest.fn((_req, _res, next) => next());
const scopeMiddlewares: Record<string, jest.Mock> = {};
const requireScope = jest.fn((scope: string) => {
  scopeMiddlewares[scope] ??= jest.fn((_req, _res, next) => next());
  return scopeMiddlewares[scope];
});

const DeveloperDataController = {
  listAppointments: jest.fn(),
  getAppointment: jest.fn(),
  listPatients: jest.fn(),
  getPatient: jest.fn(),
  listEncounters: jest.fn(),
  getEncounter: jest.fn(),
  listInvoices: jest.fn(),
  getInvoice: jest.fn(),
  getOrganization: jest.fn(),
  getUsage: jest.fn(),
};

jest.mock("src/middlewares/api-key-auth", () => ({
  authorizeApiKey,
  authorizeApiKeyVerifyOnly,
  requireScope,
}));

jest.mock("src/controllers/web/developer-data.controller", () => ({
  DeveloperDataController,
}));

const DeveloperMcpController = {
  handlePost: jest.fn(),
  methodNotAllowed: jest.fn(),
};

jest.mock("src/controllers/web/developer-mcp.controller", () => ({
  DeveloperMcpController,
}));

const DeveloperFhirController = {
  metadata: jest.fn(),
  searchOrganization: jest.fn(),
  readOrganization: jest.fn(),
  searchPatients: jest.fn(),
  readPatient: jest.fn(),
  searchAppointments: jest.fn(),
  readAppointment: jest.fn(),
  searchEncounters: jest.fn(),
  readEncounter: jest.fn(),
  searchInvoices: jest.fn(),
  readInvoice: jest.fn(),
};

jest.mock("src/controllers/web/developer-fhir.controller", () => ({
  DeveloperFhirController,
}));

const DeveloperEventsController = {
  stream: jest.fn(),
};

jest.mock("src/controllers/web/developer-events.controller", () => ({
  DeveloperEventsController,
}));

const router = jest.requireActual("../../src/routers/developer-data.router")
  .default as Router;

type Layer = {
  handle: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const layers = (router as unknown as { stack: Layer[] }).stack ?? [];

const findRoute = (path: string, method: string) =>
  layers.find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("developer-data.router", () => {
  it("registers the six read-only v1 resources", () => {
    for (const path of [
      "/appointments",
      "/appointments/:id",
      "/patients",
      "/patients/:id",
      "/encounters",
      "/encounters/:id",
      "/invoices",
      "/invoices/:id",
      "/organization",
      "/usage",
    ]) {
      expect(findRoute(path, "get")).toBeDefined();
    }
  });

  it("exempts GET /usage from the quota by registering it before authorizeApiKey", () => {
    const usageIndex = layers.findIndex(
      (entry) => entry.route?.path === "/usage",
    );
    const quotaIndex = layers.findIndex(
      (entry) => entry.handle === authorizeApiKey,
    );
    expect(usageIndex).toBeGreaterThanOrEqual(0);
    expect(quotaIndex).toBeGreaterThanOrEqual(0);
    expect(usageIndex).toBeLessThan(quotaIndex);
  });

  it("guards GET /usage with the verify-only variant and no scope", () => {
    const route = findRoute("/usage", "get");
    expect(route?.stack[0]?.handle).toBe(authorizeApiKeyVerifyOnly);
    expect(route?.stack.at(-1)?.handle).toBe(DeveloperDataController.getUsage);
    expect(
      route?.stack.some((entry) =>
        Object.values(scopeMiddlewares).includes(entry.handle as jest.Mock),
      ),
    ).toBe(false);
  });

  it("wires each resource to its contract scope", () => {
    const cases: Array<[string, string]> = [
      ["/appointments", "appointments:read"],
      ["/appointments/:id", "appointments:read"],
      ["/patients", "patients:read"],
      ["/patients/:id", "patients:read"],
      ["/encounters", "encounters:read"],
      ["/encounters/:id", "encounters:read"],
      ["/invoices", "invoices:read"],
      ["/invoices/:id", "invoices:read"],
      ["/organization", "organization:read"],
    ];
    for (const [path, scope] of cases) {
      const route = findRoute(path, "get");
      expect(route?.stack[0]?.handle).toBe(scopeMiddlewares[scope]);
    }
  });

  it("routes each path to the matching controller action", () => {
    const cases: Array<[string, jest.Mock]> = [
      ["/appointments", DeveloperDataController.listAppointments],
      ["/appointments/:id", DeveloperDataController.getAppointment],
      ["/patients", DeveloperDataController.listPatients],
      ["/patients/:id", DeveloperDataController.getPatient],
      ["/encounters", DeveloperDataController.listEncounters],
      ["/encounters/:id", DeveloperDataController.getEncounter],
      ["/invoices", DeveloperDataController.listInvoices],
      ["/invoices/:id", DeveloperDataController.getInvoice],
      ["/organization", DeveloperDataController.getOrganization],
    ];
    for (const [path, handler] of cases) {
      const route = findRoute(path, "get");
      expect(route?.stack.at(-1)?.handle).toBe(handler);
    }
  });

  describe("FHIR dialect", () => {
    it("registers /fhir/metadata quota-exempt with the verify-only variant and no scope", () => {
      const route = findRoute("/fhir/metadata", "get");
      expect(route?.stack[0]?.handle).toBe(authorizeApiKeyVerifyOnly);
      expect(route?.stack.at(-1)?.handle).toBe(
        DeveloperFhirController.metadata,
      );
      const metadataIndex = layers.findIndex(
        (entry) => entry.route?.path === "/fhir/metadata",
      );
      const quotaIndex = layers.findIndex(
        (entry) => entry.handle === authorizeApiKey,
      );
      expect(metadataIndex).toBeGreaterThanOrEqual(0);
      expect(metadataIndex).toBeLessThan(quotaIndex);
      expect(
        route?.stack.some((entry) =>
          Object.values(scopeMiddlewares).includes(entry.handle as jest.Mock),
        ),
      ).toBe(false);
    });

    it("wires each FHIR resource to the SAME scope as its JSON sibling", () => {
      const cases: Array<[string, string, jest.Mock]> = [
        [
          "/fhir/Organization",
          "organization:read",
          DeveloperFhirController.searchOrganization,
        ],
        [
          "/fhir/Organization/:id",
          "organization:read",
          DeveloperFhirController.readOrganization,
        ],
        [
          "/fhir/Patient",
          "patients:read",
          DeveloperFhirController.searchPatients,
        ],
        [
          "/fhir/Patient/:id",
          "patients:read",
          DeveloperFhirController.readPatient,
        ],
        [
          "/fhir/Appointment",
          "appointments:read",
          DeveloperFhirController.searchAppointments,
        ],
        [
          "/fhir/Appointment/:id",
          "appointments:read",
          DeveloperFhirController.readAppointment,
        ],
        [
          "/fhir/Encounter",
          "encounters:read",
          DeveloperFhirController.searchEncounters,
        ],
        [
          "/fhir/Encounter/:id",
          "encounters:read",
          DeveloperFhirController.readEncounter,
        ],
        [
          "/fhir/Invoice",
          "invoices:read",
          DeveloperFhirController.searchInvoices,
        ],
        [
          "/fhir/Invoice/:id",
          "invoices:read",
          DeveloperFhirController.readInvoice,
        ],
      ];
      const quotaIndex = layers.findIndex(
        (entry) => entry.handle === authorizeApiKey,
      );
      for (const [path, scope, handler] of cases) {
        const route = findRoute(path, "get");
        expect(route).toBeDefined();
        expect(route?.stack[0]?.handle).toBe(scopeMiddlewares[scope]);
        expect(route?.stack.at(-1)?.handle).toBe(handler);
        // Behind authorizeApiKey: a FHIR call is one metered unit like JSON.
        const index = layers.findIndex((entry) => entry.route?.path === path);
        expect(index).toBeGreaterThan(quotaIndex);
      }
    });
  });

  describe("SSE events endpoint", () => {
    it("registers GET /events quota-exempt with the verify-only variant and no scope", () => {
      const route = findRoute("/events", "get");
      expect(route?.stack[0]?.handle).toBe(authorizeApiKeyVerifyOnly);
      expect(route?.stack.at(-1)?.handle).toBe(
        DeveloperEventsController.stream,
      );
      const eventsIndex = layers.findIndex(
        (entry) => entry.route?.path === "/events",
      );
      const quotaIndex = layers.findIndex(
        (entry) => entry.handle === authorizeApiKey,
      );
      expect(eventsIndex).toBeGreaterThanOrEqual(0);
      expect(eventsIndex).toBeLessThan(quotaIndex);
      expect(
        route?.stack.some((entry) =>
          Object.values(scopeMiddlewares).includes(entry.handle as jest.Mock),
        ),
      ).toBe(false);
    });
  });

  describe("remote MCP endpoint", () => {
    it("registers POST /mcp behind authorizeApiKey (one quota unit per MCP call)", () => {
      const route = findRoute("/mcp", "post");
      expect(route?.stack.at(-1)?.handle).toBe(
        DeveloperMcpController.handlePost,
      );
      const mcpPostIndex = layers.findIndex(
        (entry) =>
          entry.route?.path === "/mcp" && Boolean(entry.route?.methods?.post),
      );
      const quotaIndex = layers.findIndex(
        (entry) => entry.handle === authorizeApiKey,
      );
      expect(mcpPostIndex).toBeGreaterThan(quotaIndex);
    });

    it("applies no route-level scope to POST /mcp (tools enforce their own)", () => {
      const route = findRoute("/mcp", "post");
      expect(
        route?.stack.some((entry) =>
          Object.values(scopeMiddlewares).includes(entry.handle as jest.Mock),
        ),
      ).toBe(false);
    });

    it("registers GET and DELETE /mcp as 405s before the quota middleware", () => {
      const quotaIndex = layers.findIndex(
        (entry) => entry.handle === authorizeApiKey,
      );
      for (const method of ["get", "delete"]) {
        const route = findRoute("/mcp", method);
        expect(route?.stack.at(-1)?.handle).toBe(
          DeveloperMcpController.methodNotAllowed,
        );
        const index = layers.findIndex(
          (entry) =>
            entry.route?.path === "/mcp" &&
            Boolean(entry.route?.methods?.[method]),
        );
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(quotaIndex);
      }
    });
  });
});
