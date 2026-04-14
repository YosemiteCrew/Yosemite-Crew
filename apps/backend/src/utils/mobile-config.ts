import logger from "./logger";

type Environment = "dev" | "development" | "staging" | "prod" | "production";

interface AppUpdatePolicy {
  enabled?: boolean;
  force?: boolean;
  title?: string;
  message?: string;
  minimumSupportedVersion?: string;
  minimumSupportedBuildNumber?: number;
  latestVersion?: string;
  latestBuildNumber?: number;
  remindAfterHours?: number;
  storeUrl?: string;
  appStoreId?: string;
}

export interface AppUpdateConfig extends AppUpdatePolicy {
  iosStoreUrl?: string;
  androidStoreUrl?: string;
  storeUrl?: string;
  appStoreId?: string;
  ios?: AppUpdatePolicy;
  android?: AppUpdatePolicy;
}

export interface MobileConfig {
  env: Environment;
  apiBaseUrl: string;
  enablePayments: boolean;
  enableReviewLogin: boolean;
  stripePublishableKey?: string;
  sentryDsn?: string;
  forceLiquidGlassBorder?: boolean;
  appUpdate?: AppUpdateConfig;
}

interface ParsedAppUpdate {
  config?: AppUpdateConfig;
  issues: string[];
}

const normalizeEnv = (value?: string): Environment => {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "production":
    case "prod":
      return normalized;
    case "staging":
      return "staging";
    case "development":
    case "dev":
      return normalized;
    default:
      return "dev";
  }
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseBooleanLike = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return undefined;
};

const parseNumberLike = (
  value: unknown,
  { min }: { min: number },
): number | undefined => {
  let numeric: number | undefined;

  if (typeof value === "number" && Number.isFinite(value)) {
    numeric = value;
  } else if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) numeric = parsed;
  }

  if (numeric === undefined) return undefined;
  if (!Number.isInteger(numeric)) return undefined;
  if (numeric < min) return undefined;
  return numeric;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmpty = (value: Record<string, unknown>): boolean =>
  Object.keys(value).length > 0;

const normalizePolicy = (
  source: Record<string, unknown>,
  options: { allowAppStoreId: boolean; path: string; issues: string[] },
): AppUpdatePolicy => {
  const policy: AppUpdatePolicy = {};
  const { allowAppStoreId, path, issues } = options;

  const enabled = parseBooleanLike(source.enabled);
  if (source.enabled !== undefined && enabled === undefined) {
    issues.push(`${path}.enabled is invalid`);
  } else if (enabled !== undefined) {
    policy.enabled = enabled;
  }

  const force = parseBooleanLike(source.force);
  if (source.force !== undefined && force === undefined) {
    issues.push(`${path}.force is invalid`);
  } else if (force !== undefined) {
    policy.force = force;
  }

  const title = parseString(source.title);
  if (source.title !== undefined && title === undefined) {
    issues.push(`${path}.title is invalid`);
  } else if (title !== undefined) {
    policy.title = title;
  }

  const message = parseString(source.message);
  if (source.message !== undefined && message === undefined) {
    issues.push(`${path}.message is invalid`);
  } else if (message !== undefined) {
    policy.message = message;
  }

  const minimumSupportedVersion = parseString(source.minimumSupportedVersion);
  if (
    source.minimumSupportedVersion !== undefined &&
    minimumSupportedVersion === undefined
  ) {
    issues.push(`${path}.minimumSupportedVersion is invalid`);
  } else if (minimumSupportedVersion !== undefined) {
    policy.minimumSupportedVersion = minimumSupportedVersion;
  }

  const latestVersion = parseString(source.latestVersion);
  if (source.latestVersion !== undefined && latestVersion === undefined) {
    issues.push(`${path}.latestVersion is invalid`);
  } else if (latestVersion !== undefined) {
    policy.latestVersion = latestVersion;
  }

  const minimumSupportedBuildNumber = parseNumberLike(
    source.minimumSupportedBuildNumber,
    { min: 0 },
  );
  if (
    source.minimumSupportedBuildNumber !== undefined &&
    minimumSupportedBuildNumber === undefined
  ) {
    issues.push(`${path}.minimumSupportedBuildNumber is invalid`);
  } else if (minimumSupportedBuildNumber !== undefined) {
    policy.minimumSupportedBuildNumber = minimumSupportedBuildNumber;
  }

  const latestBuildNumber = parseNumberLike(source.latestBuildNumber, {
    min: 0,
  });
  if (
    source.latestBuildNumber !== undefined &&
    latestBuildNumber === undefined
  ) {
    issues.push(`${path}.latestBuildNumber is invalid`);
  } else if (latestBuildNumber !== undefined) {
    policy.latestBuildNumber = latestBuildNumber;
  }

  const remindAfterHours = parseNumberLike(source.remindAfterHours, { min: 1 });
  if (source.remindAfterHours !== undefined && remindAfterHours === undefined) {
    issues.push(`${path}.remindAfterHours is invalid`);
  } else if (remindAfterHours !== undefined) {
    policy.remindAfterHours = remindAfterHours;
  }

  const storeUrl = parseString(source.storeUrl);
  if (source.storeUrl !== undefined && storeUrl === undefined) {
    issues.push(`${path}.storeUrl is invalid`);
  } else if (storeUrl !== undefined) {
    policy.storeUrl = storeUrl;
  }

  if (allowAppStoreId) {
    const appStoreId = parseString(source.appStoreId);
    if (source.appStoreId !== undefined && appStoreId === undefined) {
      issues.push(`${path}.appStoreId is invalid`);
    } else if (appStoreId !== undefined) {
      policy.appStoreId = appStoreId;
    }
  }

  return policy;
};

export const parseAppUpdateConfig = (input: unknown): ParsedAppUpdate => {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return {
      config: undefined,
      issues: ["appUpdate payload is not an object"],
    };
  }

  const basePolicy = normalizePolicy(input, {
    allowAppStoreId: true,
    path: "appUpdate",
    issues,
  });

  const config: AppUpdateConfig = { ...basePolicy };

  const iosStoreUrl = parseString(input.iosStoreUrl);
  if (input.iosStoreUrl !== undefined && iosStoreUrl === undefined) {
    issues.push("appUpdate.iosStoreUrl is invalid");
  } else if (iosStoreUrl !== undefined) {
    config.iosStoreUrl = iosStoreUrl;
  }

  const androidStoreUrl = parseString(input.androidStoreUrl);
  if (input.androidStoreUrl !== undefined && androidStoreUrl === undefined) {
    issues.push("appUpdate.androidStoreUrl is invalid");
  } else if (androidStoreUrl !== undefined) {
    config.androidStoreUrl = androidStoreUrl;
  }

  const storeUrl = parseString(input.storeUrl);
  if (input.storeUrl !== undefined && storeUrl === undefined) {
    issues.push("appUpdate.storeUrl is invalid");
  } else if (storeUrl !== undefined) {
    config.storeUrl = storeUrl;
  }

  const appStoreId = parseString(input.appStoreId);
  if (input.appStoreId !== undefined && appStoreId === undefined) {
    issues.push("appUpdate.appStoreId is invalid");
  } else if (appStoreId !== undefined) {
    config.appStoreId = appStoreId;
  }

  if (input.ios !== undefined) {
    if (isRecord(input.ios)) {
      const iosPolicy = normalizePolicy(input.ios, {
        allowAppStoreId: true,
        path: "appUpdate.ios",
        issues,
      });

      if (isNonEmpty(iosPolicy as Record<string, unknown>)) {
        config.ios = iosPolicy;
      }
    } else {
      issues.push("appUpdate.ios must be an object");
    }
  }

  if (input.android !== undefined) {
    if (isRecord(input.android)) {
      const androidPolicy = normalizePolicy(input.android, {
        allowAppStoreId: false,
        path: "appUpdate.android",
        issues,
      });

      if (isNonEmpty(androidPolicy as Record<string, unknown>)) {
        config.android = androidPolicy;
      }
    } else {
      issues.push("appUpdate.android must be an object");
    }
  }

  if (!isNonEmpty(config as Record<string, unknown>)) {
    return { config: undefined, issues };
  }

  return { config, issues };
};

const parseBooleanEnv = (value: string | undefined): boolean | undefined =>
  value === undefined ? undefined : parseBooleanLike(value);

const summarizePolicy = (policy?: AppUpdatePolicy) => {
  if (!policy) return undefined;

  return {
    enabled: policy.enabled,
    force: policy.force,
    minimumSupportedVersion: policy.minimumSupportedVersion,
    minimumSupportedBuildNumber: policy.minimumSupportedBuildNumber,
    latestVersion: policy.latestVersion,
    latestBuildNumber: policy.latestBuildNumber,
    remindAfterHours: policy.remindAfterHours,
  };
};

export const resolveMobileConfig = (): MobileConfig => {
  const env = normalizeEnv(process.env.NODE_ENV);

  const rawAppUpdate =
    process.env.MOBILE_APP_UPDATE_JSON ?? process.env.MOBILE_APP_UPDATE;

  let appUpdate: AppUpdateConfig | undefined;

  if (rawAppUpdate) {
    try {
      const parsed = parseAppUpdateConfig(JSON.parse(rawAppUpdate));
      appUpdate = parsed.config;

      if (parsed.issues.length > 0) {
        logger.warn("mobile-config appUpdate issues", {
          issues: parsed.issues,
        });
      }
    } catch (error) {
      logger.error("mobile-config appUpdate JSON parse failed", { error });
    }
  }

  const forceLiquidGlassBorder = parseBooleanEnv(
    process.env.FORCE_LIQUID_GLASS_BORDER,
  );

  if (
    process.env.FORCE_LIQUID_GLASS_BORDER !== undefined &&
    forceLiquidGlassBorder === undefined
  ) {
    logger.warn("mobile-config forceLiquidGlassBorder is invalid");
  }

  return {
    env,
    apiBaseUrl: process.env.MOBILE_API_BASE_URL ?? "",
    enableReviewLogin:
      parseBooleanEnv(process.env.ENABLE_REVIEW_LOGIN) ?? false,
    enablePayments: process.env.ENABLE_PAYMENTS === "true",
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    sentryDsn: process.env.SENTRY_DSN,
    forceLiquidGlassBorder,
    appUpdate,
  };
};

export const summarizeAppUpdateConfig = (appUpdate?: AppUpdateConfig) => {
  if (!appUpdate) return undefined;

  return {
    enabled: appUpdate.enabled,
    force: appUpdate.force,
    minimumSupportedVersion: appUpdate.minimumSupportedVersion,
    minimumSupportedBuildNumber: appUpdate.minimumSupportedBuildNumber,
    latestVersion: appUpdate.latestVersion,
    latestBuildNumber: appUpdate.latestBuildNumber,
    remindAfterHours: appUpdate.remindAfterHours,
    ios: summarizePolicy(appUpdate.ios),
    android: summarizePolicy(appUpdate.android),
  };
};
