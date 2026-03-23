import {
  parseAppUpdateConfig,
  resolveMobileConfig,
} from "../../src/utils/mobile-config";

describe("mobile-config utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("parses appUpdate policy with boolean and numeric strings", () => {
    const input = {
      enabled: "true",
      force: "false",
      minimumSupportedVersion: "1.0.6",
      minimumSupportedBuildNumber: "8",
      latestVersion: "1.1.0",
      latestBuildNumber: 12,
      remindAfterHours: "24",
      ios: {
        enabled: true,
        latestVersion: "1.1.1",
        latestBuildNumber: "13",
        storeUrl: "https://apps.apple.com/app/id123",
        appStoreId: "123",
      },
      android: {
        enabled: "true",
        latestBuildNumber: "14",
        storeUrl: "https://play.google.com/store/apps/details?id=com.test",
      },
    };

    const result = parseAppUpdateConfig(input);

    expect(result.config).toEqual({
      enabled: true,
      force: false,
      minimumSupportedVersion: "1.0.6",
      minimumSupportedBuildNumber: 8,
      latestVersion: "1.1.0",
      latestBuildNumber: 12,
      remindAfterHours: 24,
      ios: {
        enabled: true,
        latestVersion: "1.1.1",
        latestBuildNumber: 13,
        storeUrl: "https://apps.apple.com/app/id123",
        appStoreId: "123",
      },
      android: {
        enabled: true,
        latestBuildNumber: 14,
        storeUrl: "https://play.google.com/store/apps/details?id=com.test",
      },
    });
  });

  it("drops invalid numeric bounds", () => {
    const input = {
      minimumSupportedBuildNumber: "-1",
      latestBuildNumber: "-2",
      remindAfterHours: "0",
      ios: {
        latestBuildNumber: "-5",
      },
    };

    const result = parseAppUpdateConfig(input);

    expect(result.config).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("resolves config from env JSON", () => {
    process.env.NODE_ENV = "production";
    process.env.MOBILE_API_BASE_URL = "https://api.yosemitecrew.com";
    process.env.ENABLE_PAYMENTS = "true";
    process.env.MOBILE_APP_UPDATE_JSON = JSON.stringify({
      ios: {
        force: true,
        minimumSupportedVersion: "1.0.6",
        minimumSupportedBuildNumber: 8,
        storeUrl: "https://apps.apple.com/app/id123",
      },
    });

    const config = resolveMobileConfig();

    expect(config.env).toBe("production");
    expect(config.appUpdate).toEqual({
      ios: {
        force: true,
        minimumSupportedVersion: "1.0.6",
        minimumSupportedBuildNumber: 8,
        storeUrl: "https://apps.apple.com/app/id123",
      },
    });
  });
});
