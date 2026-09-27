import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import type { Route } from "playwright";
import { resolveLogoSource } from "@yosemite-crew/lib";
import { serveRenderRequest } from "../../src/services/formPDF.service";

jest.mock("playwright", () => ({
  chromium: { launch: jest.fn() },
}));

// The real branding fetch stays in place, so the address checks below run for
// real; a test that needs a successful fetch overrides one call.
jest.mock("@yosemite-crew/lib", () => {
  const actual =
    jest.requireActual<typeof import("@yosemite-crew/lib")>(
      "@yosemite-crew/lib",
    );
  return {
    ...actual,
    resolveLogoSource: jest.fn(actual.resolveLogoSource),
  };
});

const mockedResolveLogoSource = jest.mocked(resolveLogoSource);

type RouteCall = (...args: unknown[]) => Promise<void>;

const fakeRoute = (url: string) => {
  const route = {
    request: () => ({ url: () => url }),
    continue: jest.fn<RouteCall>(async () => undefined),
    fulfill: jest.fn<RouteCall>(async () => undefined),
    abort: jest.fn<RouteCall>(async () => undefined),
  };
  return { route, asRoute: route as unknown as Route };
};

describe("serveRenderRequest", () => {
  const originalAllowedHosts = process.env.PDF_LOGO_ALLOWED_HOSTS;

  beforeEach(() => {
    delete process.env.PDF_LOGO_ALLOWED_HOSTS;
    mockedResolveLogoSource.mockClear();
  });

  afterEach(() => {
    if (originalAllowedHosts === undefined) {
      delete process.env.PDF_LOGO_ALLOWED_HOSTS;
    } else {
      process.env.PDF_LOGO_ALLOWED_HOSTS = originalAllowedHosts;
    }
  });

  it("lets an inline image load as it is", async () => {
    const { route, asRoute } = fakeRoute("data:image/png;base64,iVBORw0KGgo=");

    await serveRenderRequest(asRoute);

    expect(route.continue).toHaveBeenCalledTimes(1);
    expect(route.fulfill).not.toHaveBeenCalled();
    expect(route.abort).not.toHaveBeenCalled();
    expect(mockedResolveLogoSource).not.toHaveBeenCalled();
  });

  it("hands the page an https logo fetched through the branding checks", async () => {
    const logo = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    mockedResolveLogoSource.mockResolvedValueOnce(logo);
    const url = "https://cdn.example.test/orgs/org-1/logo.jpg";
    const { route, asRoute } = fakeRoute(url);

    await serveRenderRequest(asRoute);

    expect(mockedResolveLogoSource).toHaveBeenCalledWith(url);
    expect(route.fulfill).toHaveBeenCalledWith({ status: 200, body: logo });
    // The page never makes the request itself.
    expect(route.continue).not.toHaveBeenCalled();
    expect(route.abort).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the instance metadata address",
      "https://169.254.169.254/latest/meta-data/",
    ],
    ["a loopback address", "https://127.0.0.1:8080/admin"],
    ["a private network address", "https://10.0.0.5/logo.png"],
    ["a loopback IPv6 address", "https://[::1]/logo.png"],
    ["an IPv4-mapped loopback address", "https://[::ffff:127.0.0.1]/logo.png"],
  ])("blocks an https request to %s", async (_label, url) => {
    const { route, asRoute } = fakeRoute(url);

    await serveRenderRequest(asRoute);

    expect(mockedResolveLogoSource).toHaveBeenCalledWith(url);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.continue).not.toHaveBeenCalled();
    expect(route.fulfill).not.toHaveBeenCalled();
  });

  it.each([
    ["a plain http address", "http://cdn.example.test/logo.png"],
    ["a local file", "file:///etc/hosts"],
    ["an ftp address", "ftp://files.example.test/logo.png"],
    ["a websocket", "wss://cdn.example.test/socket"],
  ])("blocks %s without fetching it", async (_label, url) => {
    const { route, asRoute } = fakeRoute(url);

    await serveRenderRequest(asRoute);

    expect(mockedResolveLogoSource).not.toHaveBeenCalled();
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.continue).not.toHaveBeenCalled();
    expect(route.fulfill).not.toHaveBeenCalled();
  });

  it("blocks a host outside the configured logo hosts", async () => {
    process.env.PDF_LOGO_ALLOWED_HOSTS = "cdn.example.test";
    const { route, asRoute } = fakeRoute(
      "https://elsewhere.example.test/a.png",
    );

    await serveRenderRequest(asRoute);

    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
  });

  it("blocks an https request the branding fetch turns down", async () => {
    mockedResolveLogoSource.mockResolvedValueOnce(null);
    const { route, asRoute } = fakeRoute("https://cdn.example.test/page.html");

    await serveRenderRequest(asRoute);

    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
  });
});
