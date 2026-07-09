import {
  getIntegrationAdapter,
  normalizeProvider,
  type IntegrationConfig,
  type IntegrationCredentials,
  type IntegrationProvider,
  type IntegrationValidationResult,
} from "src/integrations";
import { prisma } from "src/config/prisma";
import {
  Prisma,
  type IntegrationAccount as PrismaIntegrationAccount,
} from "@prisma/client";

const prismaIntegrationAccountSelect = {
  id: true,
  organisationId: true,
  provider: true,
  status: true,
  enabledAt: true,
  disabledAt: true,
  lastSyncAt: true,
  lastError: true,
  credentialsStatus: true,
  lastValidatedAt: true,
  config: true,
  createdAt: true,
  updatedAt: true,
};

export class IntegrationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "IntegrationServiceError";
  }
}

const ensureProvider = (provider: string): IntegrationProvider => {
  const normalized = normalizeProvider(provider);
  if (!normalized) {
    throw new IntegrationServiceError("Unsupported integration provider.", 400);
  }
  return normalized;
};

const ORGANISATION_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

const ensureNonEmptyString = (value: string, field: string): string => {
  if (!value?.trim()) {
    throw new IntegrationServiceError(`${field} is required.`, 400);
  }
  return value.trim();
};

const requireOrganisationId = (value: string): string => {
  const trimmed = ensureNonEmptyString(value, "organisationId");
  if (/[.$]/.test(trimmed) || !ORGANISATION_ID_REGEX.test(trimmed)) {
    throw new IntegrationServiceError("Invalid organisationId.", 400);
  }
  return trimmed;
};

const isMerckProvider = (provider: IntegrationProvider) =>
  provider === "MERCK_MANUALS";

const buildEnabledIntegrationData = () => ({
  status: "enabled" as const,
  enabledAt: new Date(),
  disabledAt: null,
  lastError: null,
  credentialsStatus: "valid" as const,
  lastValidatedAt: new Date(),
});

const ensureIntegrationCredentialsPresent = (
  account: { credentials?: unknown } | null | undefined,
) => {
  if (!account?.credentials) {
    throw new IntegrationServiceError(
      "Integration credentials are missing.",
      400,
    );
  }
};

const enableMerckIntegrationInPostgres = async (organisationId: string) => {
  const existing = await prisma.integrationAccount.findFirst({
    where: { organisationId, provider: "MERCK_MANUALS" },
  });

  if (existing) {
    return prisma.integrationAccount.update({
      where: { id: existing.id },
      data: buildEnabledIntegrationData(),
    });
  }

  return prisma.integrationAccount.create({
    data: {
      organisationId,
      provider: "MERCK_MANUALS",
      ...buildEnabledIntegrationData(),
    },
  });
};

const enableNonMerckIntegrationInPostgres = async (
  organisationId: string,
  provider: IntegrationProvider,
  validateCredentials: (
    organisationId: string,
    provider: IntegrationProvider,
  ) => Promise<IntegrationValidationResult>,
) => {
  const existing = await prisma.integrationAccount.findFirst({
    where: { organisationId, provider },
  });

  if (!existing) {
    throw new IntegrationServiceError(
      "Integration credentials must be configured before enabling.",
      400,
    );
  }

  ensureIntegrationCredentialsPresent(existing);

  const validation = await validateCredentials(organisationId, provider);

  if (!validation.ok) {
    throw new IntegrationServiceError(
      `Integration validation failed: ${validation.reason}`,
      400,
    );
  }

  return prisma.integrationAccount.update({
    where: { id: existing.id },
    data: {
      status: "enabled",
      enabledAt: new Date(),
      disabledAt: null,
      lastError: null,
    },
  });
};

export const IntegrationService = {
  ensureProvider,

  async ensureMerckAccount(organisationId: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const existing = await prisma.integrationAccount.findFirst({
      where: {
        organisationId: safeOrganisationId,
        provider: "MERCK_MANUALS",
      },
      select: prismaIntegrationAccountSelect,
    });

    if (existing) {
      return existing;
    }

    return prisma.integrationAccount.create({
      data: {
        organisationId: safeOrganisationId,
        provider: "MERCK_MANUALS",
        status: "enabled",
        enabledAt: new Date(),
        disabledAt: null,
        lastError: null,
        credentialsStatus: "valid",
        lastValidatedAt: new Date(),
      },
      select: prismaIntegrationAccountSelect,
    });
  },

  async listForOrganisation(organisationId: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const list = await prisma.integrationAccount.findMany({
      where: { organisationId: safeOrganisationId },
      select: prismaIntegrationAccountSelect,
      orderBy: { provider: "asc" },
    });

    const hasMerck = list.some((item) => item.provider === "MERCK_MANUALS");
    if (!hasMerck) {
      const merck = await this.ensureMerckAccount(safeOrganisationId);
      list.push(merck);
      list.sort((a, b) => String(a.provider).localeCompare(String(b.provider)));
    }

    return list;
  },

  async getForOrganisation(organisationId: string, provider: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);
    return prisma.integrationAccount.findFirst({
      where: { organisationId: safeOrganisationId, provider: normalized },
      select: prismaIntegrationAccountSelect,
    });
  },

  async upsertCredentials(
    organisationId: string,
    provider: string,
    credentials: IntegrationCredentials,
    config?: IntegrationConfig,
  ) {
    requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (!credentials || Object.keys(credentials).length === 0) {
      throw new IntegrationServiceError("credentials are required.", 400);
    }

    const adapter = getIntegrationAdapter(normalized);
    const validation = await adapter.validateCredentials(credentials);
    if (!validation.ok) {
      throw new IntegrationServiceError(
        `Integration validation failed: ${validation.reason}`,
        400,
      );
    }

    const safeOrganisationId = requireOrganisationId(organisationId);

    return prisma.integrationAccount.upsert({
      where: {
        organisationId_provider: {
          organisationId: safeOrganisationId,
          provider: normalized,
        },
      },
      create: {
        organisationId: safeOrganisationId,
        provider: normalized,
        status: "disabled",
        disabledAt: new Date(),
        credentialsStatus: "valid",
        lastValidatedAt: new Date(),
        lastError: null,
        credentials: credentials as Prisma.InputJsonValue,
        config: (config ?? null) as Prisma.InputJsonValue,
      },
      update: {
        credentials: credentials as Prisma.InputJsonValue,
        config: (config ?? null) as Prisma.InputJsonValue,
        status: "disabled",
        disabledAt: new Date(),
        credentialsStatus: "valid",
        lastValidatedAt: new Date(),
        lastError: null,
      },
    });
  },

  async setEnabled(organisationId: string, provider: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      return enableMerckIntegrationInPostgres(safeOrganisationId);
    }

    return enableNonMerckIntegrationInPostgres(
      safeOrganisationId,
      normalized,
      this.validateCredentials.bind(this),
    );
  },

  async setDisabled(organisationId: string, provider: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      const existing = await prisma.integrationAccount.findFirst({
        where: { organisationId: safeOrganisationId, provider: normalized },
      });

      if (!existing) {
        return prisma.integrationAccount.create({
          data: {
            organisationId: safeOrganisationId,
            provider: normalized,
            status: "disabled",
            disabledAt: new Date(),
            enabledAt: null,
            lastError: null,
            credentialsStatus: "valid",
            lastValidatedAt: new Date(),
          },
        });
      }

      return prisma.integrationAccount.update({
        where: { id: existing.id },
        data: {
          status: "disabled",
          disabledAt: new Date(),
          enabledAt: null,
        },
      });
    }

    const existing = await prisma.integrationAccount.findFirst({
      where: { organisationId: safeOrganisationId, provider: normalized },
    });

    if (!existing) {
      throw new IntegrationServiceError("Integration not found.", 404);
    }

    return prisma.integrationAccount.update({
      where: { id: existing.id },
      data: {
        status: "disabled",
        disabledAt: new Date(),
      },
    });
  },

  async validateCredentials(
    organisationId: string,
    provider: string,
  ): Promise<IntegrationValidationResult> {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      return { ok: true };
    }

    const account = await prisma.integrationAccount.findFirst({
      where: { organisationId: safeOrganisationId, provider: normalized },
    });

    if (!account?.credentials) {
      throw new IntegrationServiceError(
        "Integration credentials missing.",
        400,
      );
    }

    const adapter = getIntegrationAdapter(normalized);
    const result = await adapter.validateCredentials(
      account.credentials as unknown as IntegrationCredentials,
    );

    await prisma.integrationAccount.updateMany({
      where: { organisationId: safeOrganisationId, provider: normalized },
      data: {
        credentialsStatus: result.ok ? "valid" : "invalid",
        lastValidatedAt: new Date(),
        lastError: result.ok ? null : result.reason,
      },
    });

    return result;
  },

  async requireAccount(
    organisationId: string,
    provider: string,
  ): Promise<PrismaIntegrationAccount> {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    const account = await prisma.integrationAccount.findFirst({
      where: { organisationId: safeOrganisationId, provider: normalized },
    });

    if (!account) {
      throw new IntegrationServiceError("Integration not found.", 404);
    }

    return account;
  },
};
