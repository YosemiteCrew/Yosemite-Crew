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

const parseNonNegativeInt = (value: unknown): number | undefined =>
  parseNumberLike(value, { min: 0 });

const parsePositiveInt = (value: unknown): number | undefined =>
  parseNumberLike(value, { min: 1 });

/**
 * Parses one raw field: records an issue when a supplied value fails to parse,
 * and hands the parsed value to `assign` when there is one. An absent field is
 * neither an issue nor an assignment.
 */
const applyParsedField = <T>(
  rawValue: unknown,
  parse: (value: unknown) => T | undefined,
  fieldPath: string,
  issues: string[],
  assign: (value: T) => void,
): void => {
  const parsed = parse(rawValue);

  if (rawValue !== undefined && parsed === undefined) {
    issues.push(`${fieldPath} is invalid`);
    return;
  }

  if (parsed !== undefined) {
    assign(parsed);
  }
};

const normalizePolicy = (
  source: Record<string, unknown>,
  options: { allowAppStoreId: boolean; path: string; issues: string[] },
): AppUpdatePolicy => {
  const policy: AppUpdatePolicy = {};
  const { allowAppStoreId, path, issues } = options;

  applyParsedField(
    source.enabled,
    parseBooleanLike,
    `${path}.enabled`,
    issues,
    (value) => {
      policy.enabled = value;
    },
  );
  applyParsedField(
    source.force,
    parseBooleanLike,
    `${path}.force`,
    issues,
    (value) => {
      policy.force = value;
    },
  );
  applyParsedField(
    source.title,
    parseString,
    `${path}.title`,
    issues,
    (value) => {
      policy.title = value;
    },
  );
  applyParsedField(
    source.message,
    parseString,
    `${path}.message`,
    issues,
    (value) => {
      policy.message = value;
    },
  );
  applyParsedField(
    source.minimumSupportedVersion,
    parseString,
    `${path}.minimumSupportedVersion`,
    issues,
    (value) => {
      policy.minimumSupportedVersion = value;
    },
  );
  applyParsedField(
    source.latestVersion,
    parseString,
    `${path}.latestVersion`,
    issues,
    (value) => {
      policy.latestVersion = value;
    },
  );
  applyParsedField(
    source.minimumSupportedBuildNumber,
    parseNonNegativeInt,
    `${path}.minimumSupportedBuildNumber`,
    issues,
    (value) => {
      policy.minimumSupportedBuildNumber = value;
    },
  );
  applyParsedField(
    source.latestBuildNumber,
    parseNonNegativeInt,
    `${path}.latestBuildNumber`,
    issues,
    (value) => {
      policy.latestBuildNumber = value;
    },
  );
  applyParsedField(
    source.remindAfterHours,
    parsePositiveInt,
    `${path}.remindAfterHours`,
    issues,
    (value) => {
      policy.remindAfterHours = value;
    },
  );
  applyParsedField(
    source.storeUrl,
    parseString,
    `${path}.storeUrl`,
    issues,
    (value) => {
      policy.storeUrl = value;
    },
  );

  if (allowAppStoreId) {
    applyParsedField(
      source.appStoreId,
      parseString,
      `${path}.appStoreId`,
      issues,
      (value) => {
        policy.appStoreId = value;
      },
    );
  }

  return policy;
};

const applyPlatformPolicy = (
  rawValue: unknown,
  platform: "ios" | "android",
  config: AppUpdateConfig,
  issues: string[],
): void => {
  if (rawValue === undefined) {
    return;
  }

  if (!isRecord(rawValue)) {
    issues.push(`appUpdate.${platform} must be an object`);
    return;
  }

  const policy = normalizePolicy(rawValue, {
    allowAppStoreId: platform === "ios",
    path: `appUpdate.${platform}`,
    issues,
  });

  if (isNonEmpty(policy as Record<string, unknown>)) {
    config[platform] = policy;
  }
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

  applyParsedField(
    input.iosStoreUrl,
    parseString,
    "appUpdate.iosStoreUrl",
    issues,
    (value) => {
      config.iosStoreUrl = value;
    },
  );
  applyParsedField(
    input.androidStoreUrl,
    parseString,
    "appUpdate.androidStoreUrl",
    issues,
    (value) => {
      config.androidStoreUrl = value;
    },
  );
  applyParsedField(
    input.storeUrl,
    parseString,
    "appUpdate.storeUrl",
    issues,
    (value) => {
      config.storeUrl = value;
    },
  );
  applyParsedField(
    input.appStoreId,
    parseString,
    "appUpdate.appStoreId",
    issues,
    (value) => {
      config.appStoreId = value;
    },
  );

  applyPlatformPolicy(input.ios, "ios", config, issues);
  applyPlatformPolicy(input.android, "android", config, issues);

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
