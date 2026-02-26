import IntegrationAccountModel, {
  IntegrationAccountDocument,
} from "src/models/integration-account";
import {
  getIntegrationAdapter,
  normalizeProvider,
  type IntegrationConfig,
  type IntegrationCredentials,
  type IntegrationProvider,
  type IntegrationValidationResult,
} from "src/integrations";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";

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

const ensureNonEmptyString = (value: string, field: string) => {
  if (!value?.trim()) {
    throw new IntegrationServiceError(`${field} is required.`, 400);
  }
};

const syncIntegrationAccountToPostgres = async (
  doc: IntegrationAccountDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.integrationAccount.upsert({
      where: {
        organisationId_provider: {
          organisationId: doc.organisationId,
          provider: doc.provider,
        },
      },
      create: {
        organisationId: doc.organisationId,
        provider: doc.provider,
        status: doc.status,
        enabledAt: doc.enabledAt ?? null,
        disabledAt: doc.disabledAt ?? null,
        lastSyncAt: doc.lastSyncAt ?? null,
        lastError: doc.lastError ?? null,
        credentials: doc.credentials as Prisma.InputJsonValue ?? Prisma.JsonNull,
        config: doc.credentials as Prisma.InputJsonValue ?? Prisma.JsonNull
      },
      update: {
        status: doc.status,
        enabledAt: doc.enabledAt ?? null,
        disabledAt: doc.disabledAt ?? null,
        lastSyncAt: doc.lastSyncAt ?? null,
        lastError: doc.lastError ?? null,
        credentials: doc.credentials as Prisma.InputJsonValue ?? Prisma.JsonNull,
        config: doc.credentials as Prisma.InputJsonValue ?? Prisma.JsonNull,  
      },
    });
  } catch (err) {
    handleDualWriteError("IntegrationAccount", err);
  }
};

export const IntegrationService = {
  ensureProvider,

  async listForOrganisation(organisationId: string) {
    ensureNonEmptyString(organisationId, "organisationId");
    return IntegrationAccountModel.find({ organisationId })
      .select({ credentials: 0 })
      .sort({ provider: 1 })
      .lean();
  },

  async getForOrganisation(organisationId: string, provider: string) {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);
    return IntegrationAccountModel.findOne({
      organisationId,
      provider: normalized,
    })
      .select({ credentials: 0 })
      .lean();
  },

  async upsertCredentials(
    organisationId: string,
    provider: string,
    credentials: IntegrationCredentials,
    config?: IntegrationConfig,
  ) {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);

    if (!credentials || Object.keys(credentials).length === 0) {
      throw new IntegrationServiceError("credentials are required.", 400);
    }

    const update = {
      credentials,
      config: config ?? null,
      status: "disabled",
      disabledAt: new Date(),
    };

    const saved = await IntegrationAccountModel.findOneAndUpdate(
      { organisationId, provider: normalized },
      { $set: update, $setOnInsert: { organisationId, provider: normalized } },
      { upsert: true, new: true },
    );

    if (saved) {
      await syncIntegrationAccountToPostgres(saved);
      return saved.toJSON();
    }

    return saved;
  },

  async setEnabled(organisationId: string, provider: string) {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);

    const existing = await IntegrationAccountModel.findOne({
      organisationId,
      provider: normalized,
    });

    if (!existing) {
      throw new IntegrationServiceError(
        "Integration credentials must be configured before enabling.",
        400,
      );
    }

    if (!existing.credentials) {
      throw new IntegrationServiceError(
        "Integration credentials are missing.",
        400,
      );
    }

    const validation = await this.validateCredentials(
      organisationId,
      normalized,
    );

    if (!validation.ok) {
      throw new IntegrationServiceError(
        `Integration validation failed: ${validation.reason}`,
        400,
      );
    }

    existing.status = "enabled";
    existing.enabledAt = new Date();
    existing.disabledAt = null;
    existing.lastError = null;

    await existing.save();
    await syncIntegrationAccountToPostgres(existing);

    return existing.toJSON();
  },

  async setDisabled(organisationId: string, provider: string) {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);

    const existing = await IntegrationAccountModel.findOne({
      organisationId,
      provider: normalized,
    });

    if (!existing) {
      throw new IntegrationServiceError("Integration not found.", 404);
    }

    existing.status = "disabled";
    existing.disabledAt = new Date();

    await existing.save();
    await syncIntegrationAccountToPostgres(existing);

    return existing.toJSON();
  },

  async validateCredentials(
    organisationId: string,
    provider: string,
  ): Promise<IntegrationValidationResult> {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);

    const account = await IntegrationAccountModel.findOne({
      organisationId,
      provider: normalized,
    }).lean();

    if (!account?.credentials) {
      throw new IntegrationServiceError("Integration credentials missing.", 400);
    }

    const adapter = getIntegrationAdapter(normalized);
    return adapter.validateCredentials(account.credentials);
  },

  async requireAccount(
    organisationId: string,
    provider: string,
  ): Promise<IntegrationAccountDocument> {
    ensureNonEmptyString(organisationId, "organisationId");
    const normalized = ensureProvider(provider);

    const account = await IntegrationAccountModel.findOne({
      organisationId,
      provider: normalized,
    });

    if (!account) {
      throw new IntegrationServiceError("Integration not found.", 404);
    }

    return account;
  },
};
