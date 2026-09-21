import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { Querier } from "supertokens-node/lib/build/querier";
import NormalisedURLDomain from "supertokens-node/lib/build/normalisedURLDomain";
import NormalisedURLPath from "supertokens-node/lib/build/normalisedURLPath";
import {
  configureAuthAccountLinkingControl,
  isAccountLinkingUnavailableError,
} from "src/config/auth-account-linking";
import {
  getControlReports,
  resetControlsForTest,
} from "src/config/startup-controls";

const originalEnv = { ...process.env };

const withCore = async (
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
) => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const report = () =>
  getControlReports().find(({ name }) => name === "auth-account-linking");

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.SUPERTOKENS_API_KEY;
  resetControlsForTest();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

afterAll(() => {
  process.env = originalEnv;
});

describe("configureAuthAccountLinkingControl", () => {
  it.each([
    ["account linking", ["account_linking"]],
    ["MFA", ["mfa"]],
    ["the deployed dev feature set", ["mfa", "multi_tenancy"]],
  ])("records applied when the core enables %s", async (_name, features) => {
    await withCore(
      (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ features }));
      },
      async (baseUrl) => {
        process.env.SUPERTOKENS_CONNECTION_URI = `${baseUrl};https://ignored.test`;
        await configureAuthAccountLinkingControl(true);
      },
    );

    expect(report()).toMatchObject({ state: "applied" });
  });

  it.each([{ features: [] }, { features: ["multi_tenancy"] }])(
    "records failed when the core only reports $features",
    async ({ features }) => {
      await withCore(
        (_request, response) => {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ features }));
        },
        async (baseUrl) => {
          process.env.SUPERTOKENS_CONNECTION_URI = baseUrl;
          await configureAuthAccountLinkingControl(true);
        },
      );

      expect(report()).toMatchObject({
        state: "failed",
        detail: "core does not enable account linking",
      });
    },
  );

  it("uses the first configured core and sends the API key only when set", async () => {
    const headers: Array<string | undefined> = [];
    await withCore(
      (request, response) => {
        headers.push(request.headers["api-key"] as string | undefined);
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ features: ["mfa"] }));
      },
      async (baseUrl) => {
        process.env.SUPERTOKENS_CONNECTION_URI = `${baseUrl};https://ignored.test`;
        await configureAuthAccountLinkingControl(true);
        process.env.SUPERTOKENS_API_KEY = "test-api-key";
        await configureAuthAccountLinkingControl(true);
      },
    );

    expect(headers).toEqual([undefined, "test-api-key"]);
  });

  it.each([
    ["a non-200 response", 500, { features: ["mfa"] }],
    ["invalid JSON", 200, "not json"],
    ["an invalid body", 200, { features: "mfa" }],
  ])("records an unavailable probe for %s", async (_name, status, body) => {
    await withCore(
      (_request, response) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        response.end(typeof body === "string" ? body : JSON.stringify(body));
      },
      async (baseUrl) => {
        process.env.SUPERTOKENS_CONNECTION_URI = baseUrl;
        await configureAuthAccountLinkingControl(true);
      },
    );

    expect(report()).toMatchObject({
      state: "failed",
      detail: "core feature probe unavailable",
    });
  });

  it("records skipped without contacting the core when auth is off", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    await configureAuthAccountLinkingControl(false);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(report()).toMatchObject({
      state: "skipped",
      detail: "authentication not enabled",
    });
    fetchSpy.mockRestore();
  });

  it("records unavailable when an enabled auth gate has no core URI", async () => {
    delete process.env.SUPERTOKENS_CONNECTION_URI;

    await configureAuthAccountLinkingControl(true);

    expect(report()).toMatchObject({
      state: "failed",
      detail: "core feature probe unavailable",
    });
  });

  it("records unavailable on a network error", async () => {
    process.env.SUPERTOKENS_CONNECTION_URI = "https://core.example.test";
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("network down"));

    await configureAuthAccountLinkingControl(true);

    expect(report()).toMatchObject({
      state: "failed",
      detail: "core feature probe unavailable",
    });
    fetchSpy.mockRestore();
  });

  it("aborts an unavailable core after five seconds", async () => {
    jest.useFakeTimers();
    process.env.SUPERTOKENS_CONNECTION_URI = "https://core.example.test";
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const probe = configureAuthAccountLinkingControl(true);
    await jest.advanceTimersByTimeAsync(5_000);
    await probe;

    expect(report()).toMatchObject({
      state: "failed",
      detail: "core feature probe unavailable",
    });
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("never exposes the core URI, key, or response body in a report", async () => {
    await withCore(
      (_request, response) => {
        response.statusCode = 401;
        response.end("private core response");
      },
      async (baseUrl) => {
        process.env.SUPERTOKENS_CONNECTION_URI = baseUrl;
        process.env.SUPERTOKENS_API_KEY = "private-api-key";
        await configureAuthAccountLinkingControl(true);

        const detail = report()?.detail ?? "";
        expect(detail).not.toContain(baseUrl);
        expect(detail).not.toContain("private-api-key");
        expect(detail).not.toContain("private core response");
      },
    );
  });
});

describe("isAccountLinkingUnavailableError", () => {
  it("matches the real SDK error raised by a 402 account-linking response", async () => {
    await withCore(
      (request, response) => {
        if (request.url?.startsWith("/apiversion")) {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ versions: ["5.4"] }));
          return;
        }
        response.statusCode = 402;
        response.setHeader("content-type", "text/plain");
        response.end("Account linking feature is not enabled for this app.");
      },
      async (baseUrl) => {
        process.env.TEST_MODE = "testing";
        Querier.reset();
        Querier.init([
          {
            domain: new NormalisedURLDomain(baseUrl),
            basePath: new NormalisedURLPath(""),
          },
        ]);
        const domain = new NormalisedURLDomain("https://api.example.test");
        const querier = Querier.getNewInstanceOrThrowError({
          appInfo: {
            apiDomain: domain,
            getOrigin: () => domain,
          },
          getRequestFromUserContext: () => undefined,
        } as never);

        const error = await querier
          .sendPostRequest(
            "/recipe/accountlinking/user/primary",
            { recipeUserId: "missing-user" },
            { _default: {} } as never,
          )
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(Error);
        expect(isAccountLinkingUnavailableError(error)).toBe(true);
      },
    );
    Querier.reset();
    delete process.env.TEST_MODE;
  });

  it("matches only a 402 from an account-linking path", () => {
    expect(
      isAccountLinkingUnavailableError(
        new Error(
          "SuperTokens core responded 402 for /recipe/accountlinking/user/primary",
        ),
      ),
    ).toBe(true);
    expect(
      isAccountLinkingUnavailableError(
        new Error(
          "SuperTokens core responded 500 for /recipe/accountlinking/user/primary",
        ),
      ),
    ).toBe(false);
    expect(
      isAccountLinkingUnavailableError(
        new Error("SuperTokens core responded 402 for /recipe/session/refresh"),
      ),
    ).toBe(false);
  });
});
