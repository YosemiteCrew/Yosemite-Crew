import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import SuperTokens from "supertokens-node";
import SuperTokensInstance from "supertokens-node/lib/build/supertokens";
import {
  getSuperTokensConfig,
  registerSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler,
} from "@yosemite-crew/auth";

// A stand-in auth core that records every path the SDK calls. Only the version
// handshake needs a real answer; any other call counts as "reached the core".
const coreCalls: string[] = [];

const readUrl = (request: IncomingMessage) =>
  new URL(request.url ?? "/", "http://core.test").pathname;

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const core = createServer((request, response) => {
  const path = readUrl(request);
  response.setHeader("content-type", "application/json");
  if (path === "/apiversion") {
    response.end(JSON.stringify({ versions: ["5.4"] }));
    return;
  }
  coreCalls.push(path);
  response.end(JSON.stringify({ status: "OK", users: [] }));
});

const unhandled: unknown[] = [];
let api: Server;
let apiUrl = "";

const originalEnv = { ...process.env };

beforeAll(async () => {
  const coreUrl = await listen(core);
  Object.assign(process.env, {
    SUPERTOKENS_CONNECTION_URI: coreUrl,
    AUTH_API_DOMAIN: "http://127.0.0.1",
    AUTH_WEBSITE_DOMAIN: "https://web.example.test",
    SMTP_HOST: "smtp.example.test",
    SMTP_USER: "user",
    SMTP_PASSWORD: "password",
    SMTP_FROM_EMAIL: "noreply@example.test",
    AUTH_GITHUB_CLIENT_ID: "github-client",
    AUTH_GITHUB_CLIENT_SECRET: "github-secret",
  });
  delete process.env.SUPERTOKENS_API_KEY;
  delete process.env.AUTH_API_BASE_PATH;
  delete process.env.TURNSTILE_SECRET_KEY;
  SuperTokens.init(getSuperTokensConfig());

  const app = express();
  registerSuperTokensBeforeRoutes(app);
  registerSuperTokensErrorHandler(app);
  const lastResort: ErrorRequestHandler = (err, _req, res, _next) => {
    unhandled.push(err);
    res.status(500).json({ message: "Internal server error." });
  };
  app.use(lastResort);
  api = createServer(app);
  apiUrl = await listen(api);
});

afterAll(async () => {
  await close(api);
  await close(core);
  process.env = originalEnv;
});

beforeEach(() => {
  coreCalls.length = 0;
  unhandled.length = 0;
});

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

const password = { id: "password", value: "Str0ng-password!" };
const email = { id: "email", value: "person@example.test" };

// [description, method, route after the tenant segment, body]
const routes: Array<[string, string, string, unknown]> = [
  [
    "email verification",
    "POST",
    "/user/email/verify",
    { method: "token", token: "t".repeat(40) },
  ],
  ["sign in", "POST", "/signin", { formFields: [email, password] }],
  ["sign up", "POST", "/signup", { formFields: [email, password] }],
  [
    "password reset",
    "POST",
    "/user/password/reset",
    { method: "token", token: "t".repeat(40), formFields: [password] },
  ],
  [
    "password reset request",
    "POST",
    "/user/password/reset/token",
    { formFields: [email] },
  ],
  [
    "email exists",
    "GET",
    "/emailpassword/email/exists?email=a@b.test",
    undefined,
  ],
  ["passwordless code", "POST", "/signinup/code", { email: email.value }],
  [
    "third-party sign in",
    "POST",
    "/signinup",
    {
      thirdPartyId: "github",
      redirectURIInfo: {
        redirectURIOnProviderDashboard: "x",
        redirectURIQueryParams: {},
      },
    },
  ],
  [
    "third-party authorisation url",
    "GET",
    "/authorisationurl?thirdPartyId=github&redirectURIOnProviderDashboard=x",
    undefined,
  ],
];

describe("recipe routes for the default tenant", () => {
  it.each([
    ["sign in", "/auth/signin", { formFields: [email, password] }],
    [
      "email verification",
      "/auth/user/email/verify",
      { method: "token", token: "t".repeat(40) },
    ],
    [
      "password reset",
      "/auth/user/password/reset",
      { method: "token", token: "t".repeat(40), formFields: [password] },
    ],
    [
      "email verification with an explicit public tenant",
      "/auth/public/user/email/verify",
      { method: "token", token: "t".repeat(40) },
    ],
  ])("%s still reaches the auth core", async (_name, path, body) => {
    const response = await call("POST", path, body);

    expect(response.body).not.toEqual({ message: "Invalid request." });
    expect(coreCalls.length).toBeGreaterThan(0);
    expect(
      coreCalls.every(
        (p) => p.startsWith("/public/") || !p.includes("/recipe/"),
      ),
    ).toBe(true);
    expect(coreCalls.some((p) => p.startsWith("/public/"))).toBe(true);
  });
});

describe("recipe routes naming an unknown tenant", () => {
  it.each(routes)(
    "%s answers 400 without calling the auth core",
    async (_name, method, route, body) => {
      const response = await call(method, `/auth/Zx9unknown${route}`, body);

      expect(response).toEqual({
        status: 400,
        body: { message: "Invalid request." },
      });
      expect(coreCalls).toEqual([]);
      expect(unhandled).toEqual([]);
    },
  );

  it("does not echo the tenant id back to the caller", async () => {
    const response = await call("POST", "/auth/EchoMe123/signin", {
      formFields: [email, password],
    });

    expect(JSON.stringify(response.body)).not.toContain("EchoMe123");
  });
});

describe("recipe route table", () => {
  it("has no route that reads as a tenant segment plus another route", () => {
    const paths =
      SuperTokensInstance.getInstanceOrThrowError().recipeModules.flatMap(
        (recipe) =>
          recipe
            .getAPIsHandled()
            .filter((api) => !api.disabled)
            .map((api) => api.pathWithoutApiBasePath.getAsStringDangerous()),
      );

    expect(paths).toEqual(
      expect.arrayContaining(["/signin", "/user/email/verify"]),
    );
    const shadowed = paths.filter((path) =>
      paths.some(
        (other) =>
          other !== path &&
          path.endsWith(other) &&
          /^\/[a-zA-Z0-9-]+$/.test(path.slice(0, path.length - other.length)),
      ),
    );
    // A route like "/x/signin" would be read as tenant "x" plus "/signin" and
    // refused, so the default tenant check must never see one.
    expect(shadowed).toEqual([]);
  });
});
