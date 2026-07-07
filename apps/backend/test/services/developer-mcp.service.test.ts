import { DeveloperMcpService } from "../../src/services/developer-mcp.service";
import { DeveloperDataService } from "../../src/services/developer-data.service";
import { DeveloperUsageService } from "../../src/services/developer-usage.service";
import { InvalidCursorError } from "../../src/utils/cursor-pagination";

// Capture registerTool calls instead of standing up a real MCP transport:
// what matters here is the tool surface (names/schemas mirroring the stdio
// package) and that every handler is bound to the request's org and scopes.
type RegisteredTool = {
  config: { description?: string; inputSchema?: Record<string, unknown> };
  handler: (args: Record<string, unknown>) => Promise<{
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  }>;
};

const registered = new Map<string, RegisteredTool>();

jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool(
      name: string,
      config: RegisteredTool["config"],
      handler: RegisteredTool["handler"],
    ) {
      registered.set(name, { config, handler });
    }
  },
}));

jest.mock("src/services/developer-data.service", () => ({
  DeveloperDataService: {
    listAppointments: jest.fn(),
    getAppointment: jest.fn(),
    listPatients: jest.fn(),
    getPatient: jest.fn(),
    listEncounters: jest.fn(),
    getEncounter: jest.fn(),
    listInvoices: jest.fn(),
    getInvoice: jest.fn(),
    getOrganization: jest.fn(),
  },
}));

jest.mock("src/services/developer-usage.service", () => ({
  DeveloperUsageService: { getUsage: jest.fn() },
}));

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const mockData = DeveloperDataService as unknown as Record<string, jest.Mock>;
const mockUsage = DeveloperUsageService as unknown as { getUsage: jest.Mock };

const ALL_SCOPES = [
  "appointments:read",
  "patients:read",
  "encounters:read",
  "invoices:read",
  "organization:read",
];

const buildTools = (scopes: string[] = ALL_SCOPES, orgId = "org-1") => {
  registered.clear();
  DeveloperMcpService.buildServer({ organisationId: orgId, scopes });
  return registered;
};

const emptyPage = {
  items: [],
  pagination: { nextCursor: null, hasMore: false, limit: 50 },
};

describe("DeveloperMcpService.buildServer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registers exactly the stdio package's tool set", () => {
    const tools = buildTools();
    expect([...tools.keys()].sort()).toEqual(
      [
        "list_appointments",
        "get_appointment",
        "list_patients",
        "get_patient",
        "list_encounters",
        "get_encounter",
        "list_invoices",
        "get_invoice",
        "get_organization",
        "get_usage",
      ].sort(),
    );
  });

  it("threads the key's organisationId into every list query", async () => {
    mockData.listAppointments.mockResolvedValue(emptyPage);
    const tools = buildTools(ALL_SCOPES, "org-42");

    await tools.get("list_appointments")!.handler({
      limit: 10,
      status: "UPCOMING",
    });

    expect(mockData.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-42",
        limit: 10,
        status: "UPCOMING",
      }),
    );
  });

  it("returns list results in the { data, pagination } envelope", async () => {
    mockData.listPatients.mockResolvedValue({
      items: [{ id: "p1" }],
      pagination: { nextCursor: "abc", hasMore: true, limit: 50 },
    });
    const tools = buildTools();

    const result = await tools.get("list_patients")!.handler({ limit: 50 });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({
      data: [{ id: "p1" }],
      pagination: { nextCursor: "abc", hasMore: true, limit: 50 },
    });
  });

  it.each([
    ["list_appointments", "appointments:read"],
    ["get_appointment", "appointments:read"],
    ["list_patients", "patients:read"],
    ["get_patient", "patients:read"],
    ["list_encounters", "encounters:read"],
    ["get_encounter", "encounters:read"],
    ["list_invoices", "invoices:read"],
    ["get_invoice", "invoices:read"],
    ["get_organization", "organization:read"],
  ])(
    "%s returns an insufficient_scope error without touching data when %s is missing",
    async (tool, scope) => {
      const tools = buildTools([]);

      const result = await tools.get(tool)!.handler({ id: "x", limit: 50 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("insufficient_scope");
      expect(result.content[0].text).toContain(scope);
      for (const fn of Object.values(mockData)) {
        expect(fn).not.toHaveBeenCalled();
      }
    },
  );

  it("honours the wildcard scope", async () => {
    mockData.getOrganization.mockResolvedValue({ id: "org-1" });
    const tools = buildTools(["*"]);

    const result = await tools.get("get_organization")!.handler({});

    expect(result.isError).toBeUndefined();
    expect(mockData.getOrganization).toHaveBeenCalledWith("org-1");
  });

  it("get_usage requires no scope and reads the key's own org", async () => {
    mockUsage.getUsage.mockResolvedValue({
      billingPeriod: "2026-07",
      callCount: 3,
      limit: 1000,
    });
    const tools = buildTools([]);

    const result = await tools.get("get_usage")!.handler({});

    expect(result.isError).toBeUndefined();
    expect(mockUsage.getUsage).toHaveBeenCalledWith("org-1");
    expect(JSON.parse(result.content[0].text)).toEqual({
      data: { billingPeriod: "2026-07", callCount: 3, limit: 1000 },
    });
  });

  it.each([
    ["get_appointment", "getAppointment"],
    ["get_patient", "getPatient"],
    ["get_encounter", "getEncounter"],
    ["get_invoice", "getInvoice"],
  ])("%s maps a null row to a not_found error", async (tool, serviceFn) => {
    mockData[serviceFn].mockResolvedValue(null);
    const tools = buildTools();

    const result = await tools
      .get(tool)!
      .handler({ id: "5e0a3a1e-0000-4000-8000-000000000000" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not_found");
    expect(mockData[serviceFn]).toHaveBeenCalledWith(
      "org-1",
      "5e0a3a1e-0000-4000-8000-000000000000",
    );
  });

  it("surfaces a tampered cursor as an actionable invalid_request error", async () => {
    mockData.listInvoices.mockRejectedValue(new InvalidCursorError());
    const tools = buildTools();

    const result = await tools
      .get("list_invoices")!
      .handler({ limit: 50, cursor: "forged" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("invalid_request");
  });

  it("hides unexpected failures behind an opaque internal error", async () => {
    mockData.listEncounters.mockRejectedValue(new Error("pg exploded"));
    const tools = buildTools();

    const result = await tools.get("list_encounters")!.handler({ limit: 50 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("internal_error");
    expect(result.content[0].text).not.toContain("pg exploded");
  });

  it("every tool is declared read-only and list tools accept limit/cursor", () => {
    const tools = buildTools();
    for (const [name, tool] of tools) {
      expect(
        (tool.config as { annotations?: { readOnlyHint?: boolean } })
          .annotations?.readOnlyHint,
      ).toBe(true);
      if (name.startsWith("list_")) {
        expect(tool.config.inputSchema).toHaveProperty("limit");
        expect(tool.config.inputSchema).toHaveProperty("cursor");
      }
    }
  });
});
