// Covers the module-level firebase-admin initialization guard in
// notification.service.ts (FCM push delivery, not auth). The guard runs at
// import time, so each case imports the module fresh in isolation.

jest.mock("@prisma/client", () => ({ NotificationType: {} }));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock("src/utils/notificationTemplates", () => ({}));
jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {},
}));
jest.mock("src/config/prisma", () => ({ prisma: {} }));

const importFreshWithAdmin = (
  apps: unknown[],
  initializeApp: jest.Mock,
  cert: jest.Mock,
  existsSync: jest.Mock,
) => {
  jest.isolateModules(() => {
    jest.doMock("node:fs", () => ({
      existsSync,
    }));
    jest.doMock("firebase-admin", () => ({
      __esModule: true,
      default: {
        apps,
        initializeApp,
        credential: { cert },
        messaging: jest.fn(),
      },
    }));
    require("../../src/services/notification.service");
  });
};

describe("notification.service firebase-admin init", () => {
  const saved = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  afterEach(() => {
    if (saved === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = saved;
    jest.resetModules();
  });

  it("initializes with the credential when creds are set and no app exists", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/creds.json";
    const initializeApp = jest.fn();
    const cert = jest.fn(() => "resolved-cred");
    const existsSync = jest.fn(() => true);

    importFreshWithAdmin([], initializeApp, cert, existsSync);

    expect(existsSync).toHaveBeenCalledWith("/creds.json");
    expect(cert).toHaveBeenCalledWith("/creds.json");
    expect(initializeApp).toHaveBeenCalledWith({ credential: "resolved-cred" });
  });

  it("does not initialize when an app already exists", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/creds.json";
    const initializeApp = jest.fn();
    const existsSync = jest.fn(() => true);

    importFreshWithAdmin([{}], initializeApp, jest.fn(), existsSync);

    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("does not initialize when no credentials are configured", () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const initializeApp = jest.fn();
    const existsSync = jest.fn();

    importFreshWithAdmin([], initializeApp, jest.fn(), existsSync);

    expect(initializeApp).not.toHaveBeenCalled();
  });
});
