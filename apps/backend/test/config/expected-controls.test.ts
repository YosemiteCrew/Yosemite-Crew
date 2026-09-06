/**
 * The two things `expected` on /health/controls silently depends on.
 *
 * The deploy gate (scripts/deploy/lib/controls.sh) blocks when the response
 * declares a control and does not report it. That is only a fault signal if
 * (1) the manifest never names a control nothing records, and (2) everything it
 * names is recorded before the port answers - a control registered after
 * `listen`, or from a background task, would be legitimately absent when the
 * smoke probe runs 25 seconds into the boot, and would block a healthy deploy.
 *
 * Both are asserted here as behaviour. The ordering one deliberately drives the
 * real bootstrap rather than reading main.ts: a source check would stay green
 * for any refactor that kept the two lines in order while changing when they
 * actually resolve.
 */
const mockInitQueues = jest.fn().mockResolvedValue(undefined);
const mockClosePdfBrowser = jest.fn().mockResolvedValue(undefined);
const mockUpdateAppSettings = jest.fn();
const mockListen = jest.fn();

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: jest.fn(() => ({ updateAppSettings: mockUpdateAppSettings })),
  },
}));

// The provider package, not the wiring: createApp's own recordControl calls are
// what is under test, and SuperTokens' real init reaches for an SMTP config that
// has nothing to do with the ordering being asserted. Same mock shape as
// app.test.ts.
jest.mock("@yosemite-crew/auth", () => ({
  AuthService: class {
    constructor(public readonly provider: unknown) {}
  },
  createAuthProvider: jest.fn(() => ({ name: "supertokens" })),
  readAuthConfig: jest.fn(() => ({ provider: "supertokens" })),
  initSuperTokens: jest.fn(),
  registerSuperTokensBeforeRoutes: jest.fn(),
  registerSuperTokensErrorHandler: jest.fn(),
  setAuthService: jest.fn(),
  validateAuthConfig: jest.fn(),
}));

// The route tree, for the same reason app.test.ts mocks it: registering every
// router drags in every controller and service, and none of them record a
// control. What stays real is app.ts itself, which is where the recording is.
// Nothing in this suite talks to a queue, but importing the real app and the
// real main pulls modules that construct a bullmq Queue at import time, and the
// redis client it opens outlives the suite and logs into whatever runs next.
// Mocked at the library boundary so a new import path cannot reintroduce it.
jest.mock("bullmq", () => ({
  Queue: class {
    add = jest.fn();
    close = jest.fn();
    on = jest.fn();
  },
  Worker: class {
    on = jest.fn();
    close = jest.fn();
  },
  QueueEvents: class {
    on = jest.fn();
    close = jest.fn();
  },
}));

jest.mock("src/routers", () => ({ registerRoutes: jest.fn() }));
jest.mock("src/controllers/web/stripe.controller", () => ({
  StripeController: { webhook: jest.fn(), connectWebhook: jest.fn() },
}));
jest.mock("src/controllers/web/documenso.controller", () => ({
  DocumensoWebhookController: { handle: jest.fn() },
}));
jest.mock("src/controllers/app/finance.controller", () => ({
  FinanceController: { webhook: jest.fn() },
}));
jest.mock("src/controllers/app/chatWebhook.controller", () => ({
  ChatWebhookController: { handleStreamEvent: jest.fn() },
}));
// The last of app.ts's direct controller imports, and the one that reaches a
// queue client: unmocked it opens a redis connection that outlives the suite
// and logs into whatever runs next.
jest.mock("src/controllers/web/developer-billing.controller", () => ({
  DeveloperBillingController: { webhook: jest.fn() },
}));

jest.mock("src/queues", () => ({ initQueues: mockInitQueues }));
jest.mock("src/workers", () => ({}));
jest.mock("src/services/formPDF.service", () => ({
  closePdfBrowser: mockClosePdfBrowser,
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { configureStreamUploadPolicy } from "src/config/stream-upload-policy";
import { createApp } from "src/app";
import {
  EXPECTED_CONTROLS,
  getControlReports,
  getExpectedControls,
  resetControlsForTest,
} from "src/config/startup-controls";

const AUTH_ENV = {
  SUPERTOKENS_CONNECTION_URI: "https://core.example.test",
  AUTH_API_DOMAIN: "https://api.example.test",
  AUTH_WEBSITE_DOMAIN: "https://web.example.test",
};

const ENV_KEYS = [
  "SUPERTOKENS_DISABLED",
  "SUPERTOKENS_CONNECTION_URI",
  "AUTH_API_DOMAIN",
  "AUTH_WEBSITE_DOMAIN",
  "STREAM_API_KEY",
  "STREAM_API_SECRET",
];

const savedEnv: Record<string, string | undefined> = {};

const recordedNames = () => getControlReports().map((report) => report.name);

beforeEach(() => {
  jest.clearAllMocks();
  resetControlsForTest();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockUpdateAppSettings.mockResolvedValue({});
});

afterEach(() => {
  resetControlsForTest();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("the expected-controls manifest stays honest", () => {
  // Every configuration, not just the happy one: a control that is only
  // recorded on its success path would leave the manifest naming something
  // absent, and the gate would block a deploy that is fine.
  const bootConfigurations: Array<[string, () => void]> = [
    [
      "auth configured, Stream configured",
      () => {
        Object.assign(process.env, AUTH_ENV);
        process.env.STREAM_API_KEY = "key";
        process.env.STREAM_API_SECRET = "secret";
      },
    ],
    [
      "auth switched off, Stream credentials absent",
      () => {
        process.env.SUPERTOKENS_DISABLED = "true";
      },
    ],
    [
      "auth env incomplete, Stream rejecting",
      () => {
        process.env.SUPERTOKENS_CONNECTION_URI =
          AUTH_ENV.SUPERTOKENS_CONNECTION_URI;
        process.env.STREAM_API_KEY = "key";
        process.env.STREAM_API_SECRET = "secret";
        mockUpdateAppSettings.mockRejectedValue(new Error("rejected"));
      },
    ],
  ];

  it.each(bootConfigurations)(
    "records every declared control when booted with %s",
    async (_name, setEnv) => {
      setEnv();

      await configureStreamUploadPolicy();
      createApp();

      expect(recordedNames().sort()).toEqual(
        expect.arrayContaining([...EXPECTED_CONTROLS]),
      );
    },
  );

  it("declares every control it records, so nothing is reported undeclared", async () => {
    Object.assign(process.env, AUTH_ENV);
    process.env.STREAM_API_KEY = "key";
    process.env.STREAM_API_SECRET = "secret";

    await configureStreamUploadPolicy();
    createApp();

    // The other direction from the test above. A control recorded but not
    // declared is not a deploy hazard, but it means the manifest has stopped
    // describing the process and the next reader cannot trust either list.
    expect(getExpectedControls().sort()).toEqual(recordedNames().sort());
  });
});

describe("every declared control is recorded before the port answers", () => {
  // main.ts is not exported and `void startServer()` runs on import, so the
  // bootstrap is driven by importing it with only the heavy externals mocked.
  // createApp and configureStreamUploadPolicy are the REAL ones: what is under
  // test is when their recordings land relative to listen, and a mock of either
  // would be asserting about the mock.
  const bootAndSnapshotAtListen = async (): Promise<string[]> => {
    let recordedAtListen: string[] = [];

    jest.isolateModules(() => {
      // isolateModules gives main.ts a FRESH registry, so the startup-controls
      // it records into is not the instance imported at the top of this file.
      // Reading the outer one here would report an empty set for every boot -
      // a test that passes only when the ordering it checks is broken. Read the
      // instance the bootstrap actually writes to.
      const isolated = require("src/config/startup-controls") as {
        getControlReports: typeof getControlReports;
      };

      mockListen.mockImplementation((_port: unknown, callback?: () => void) => {
        recordedAtListen = isolated
          .getControlReports()
          .map((report) => report.name);
        if (callback) callback();
        return { close: jest.fn() };
      });

      jest.doMock("src/app", () => {
        const actual = jest.requireActual("src/app") as {
          createApp: typeof createApp;
        };
        return {
          createApp: () => {
            actual.createApp();
            return { listen: mockListen };
          },
        };
      });

      require("src/main");
    });

    // startServer awaits initQueues and configureStreamUploadPolicy before it
    // reaches listen, so the assertion has to happen after those microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    return recordedAtListen;
  };

  it("has recorded every declared control by the time listen is called", async () => {
    Object.assign(process.env, AUTH_ENV);
    process.env.STREAM_API_KEY = "key";
    process.env.STREAM_API_SECRET = "secret";

    const recordedAtListen = await bootAndSnapshotAtListen();

    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(recordedAtListen.sort()).toEqual(
      expect.arrayContaining([...EXPECTED_CONTROLS]),
    );
  });

  it("records them before listen even when every control is in a non-applied state", async () => {
    process.env.SUPERTOKENS_DISABLED = "true";

    const recordedAtListen = await bootAndSnapshotAtListen();

    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(recordedAtListen.sort()).toEqual(
      expect.arrayContaining([...EXPECTED_CONTROLS]),
    );
  });
});
