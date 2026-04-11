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
import {
  Prisma,
  type IntegrationAccount as PrismaIntegrationAccount,
} from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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

const supportsPrismaProvider = (
  provider: IntegrationProvider,
): provider is "IDEXX" => provider === "IDEXX";

const syncIntegrationAccountToPostgres = async (
  doc: IntegrationAccountDocument,
) => {
  if (!shouldDualWrite) return;
  if (!supportsPrismaProvider(doc.provider)) return;
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
        credentialsStatus: doc.credentialsStatus ?? "missing",
        lastValidatedAt: doc.lastValidatedAt ?? null,
        credentials:
          (doc.credentials as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        config: (doc.credentials as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
      update: {
        status: doc.status,
        enabledAt: doc.enabledAt ?? null,
        disabledAt: doc.disabledAt ?? null,
        lastSyncAt: doc.lastSyncAt ?? null,
        lastError: doc.lastError ?? null,
        credentialsStatus: doc.credentialsStatus ?? "missing",
        lastValidatedAt: doc.lastValidatedAt ?? null,
        credentials:
          (doc.credentials as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        config: (doc.credentials as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    handleDualWriteError("IntegrationAccount", err);
  }
};

export const IntegrationService = {
  ensureProvider,

  async ensureMerckAccount(organisationId: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    if (isReadFromPostgres()) {
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
    }

    const existing = await IntegrationAccountModel.findOne({
      organisationId: safeOrganisationId,
      provider: "MERCK_MANUALS",
    })
      .setOptions({ sanitizeFilter: true })
      .select({ credentials: 0 })
      .lean();

    if (existing) {
      return existing;
    }

    const created = new IntegrationAccountModel({
      organisationId: safeOrganisationId,
      provider: "MERCK_MANUALS",
      status: "enabled",
      enabledAt: new Date(),
      disabledAt: null,
      lastError: null,
      credentialsStatus: "valid",
      lastValidatedAt: new Date(),
    });

    await created.save();
    await syncIntegrationAccountToPostgres(created);
    const fresh = await IntegrationAccountModel.findOne({
      organisationId: safeOrganisationId,
      provider: "MERCK_MANUALS",
    })
      .setOptions({ sanitizeFilter: true })
      .select({ credentials: 0 })
      .lean();
    return fresh ?? created.toJSON();
  },

  async listForOrganisation(organisationId: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    if (isReadFromPostgres()) {
      const list = await prisma.integrationAccount.findMany({
        where: { organisationId: safeOrganisationId },
        select: prismaIntegrationAccountSelect,
        orderBy: { provider: "asc" },
      });

      const hasMerck = list.some((item) => item.provider === "MERCK_MANUALS");
      if (!hasMerck) {
        const merck = (await this.ensureMerckAccount(
          safeOrganisationId,
        )) as (typeof list)[number];
        list.push(merck);
        list.sort((a, b) =>
          String(a.provider).localeCompare(String(b.provider)),
        );
      }

      return list;
    }

    const list = await IntegrationAccountModel.find({
      organisationId: safeOrganisationId,
    })
      .setOptions({ sanitizeFilter: true })
      .select({ credentials: 0 })
      .sort({ provider: 1 })
      .lean();

    const hasMerck = list.some((item) => item.provider === "MERCK_MANUALS");
    if (!hasMerck) {
      const merck = (await this.ensureMerckAccount(
        safeOrganisationId,
      )) as (typeof list)[number];
      list.push(merck);
      list.sort((a, b) => String(a.provider).localeCompare(String(b.provider)));
    }

    return list;
  },

  async getForOrganisation(organisationId: string, provider: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);
    if (isReadFromPostgres()) {
      return prisma.integrationAccount.findFirst({
        where: { organisationId: safeOrganisationId, provider: normalized },
        select: prismaIntegrationAccountSelect,
      });
    }
    return IntegrationAccountModel.findOne({
      organisationId: safeOrganisationId,
      provider: normalized,
    })
      .setOptions({ sanitizeFilter: true })
      .select({ credentials: 0 })
      .lean();
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

    const update = {
      credentials,
      config: config ?? null,
      status: "disabled",
      disabledAt: new Date(),
      credentialsStatus: "valid",
      lastValidatedAt: new Date(),
      lastError: null,
    };

    const safeOrganisationId = requireOrganisationId(organisationId);

    if (isReadFromPostgres()) {
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
    }

    const saved = await IntegrationAccountModel.findOneAndUpdate(
      { organisationId: safeOrganisationId, provider: normalized },
      {
        $set: update,
        $setOnInsert: {
          organisationId: safeOrganisationId,
          provider: normalized,
        },
      },
      { upsert: true, new: true, sanitizeFilter: true },
    );

    if (saved) {
      await syncIntegrationAccountToPostgres(saved);
      return saved.toJSON();
    }

    return saved;
  },

  async setEnabled(organisationId: string, provider: string) {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      if (isReadFromPostgres()) {
        const existing = await prisma.integrationAccount.findFirst({
          where: { organisationId: safeOrganisationId, provider: normalized },
        });
        if (existing) {
          return prisma.integrationAccount.update({
            where: { id: existing.id },
            data: {
              status: "enabled",
              enabledAt: new Date(),
              disabledAt: null,
              lastError: null,
              credentialsStatus: "valid",
              lastValidatedAt: new Date(),
            },
          });
        }
        return prisma.integrationAccount.create({
          data: {
            organisationId: safeOrganisationId,
            provider: normalized,
            status: "enabled",
            enabledAt: new Date(),
            disabledAt: null,
            lastError: null,
            credentialsStatus: "valid",
            lastValidatedAt: new Date(),
          },
        });
      }

      const existing = await IntegrationAccountModel.findOne({
        organisationId: safeOrganisationId,
        provider: normalized,
      }).setOptions({ sanitizeFilter: true });

      if (existing) {
        existing.status = "enabled";
        existing.enabledAt = new Date();
        existing.disabledAt = null;
        existing.lastError = null;
        existing.credentialsStatus = "valid";
        existing.lastValidatedAt = new Date();
        await existing.save();
        await syncIntegrationAccountToPostgres(existing);
        return existing.toJSON();
      }

      const created = new IntegrationAccountModel({
        organisationId,
        provider: normalized,
        status: "enabled",
        enabledAt: new Date(),
        disabledAt: null,
        lastError: null,
        credentialsStatus: "valid",
        lastValidatedAt: new Date(),
      });
      await created.save();
      await syncIntegrationAccountToPostgres(created);
      return created.toJSON();
    }

    if (isReadFromPostgres()) {
      const existing = await prisma.integrationAccount.findFirst({
        where: { organisationId: safeOrganisationId, provider: normalized },
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
        safeOrganisationId,
        normalized,
      );

      if (!validation.ok) {
        throw new IntegrationServiceError(
          `Integration validation failed: ${validation.reason}`,
          400,
        );
      }

      const updated = await prisma.integrationAccount.update({
        where: { id: existing.id },
        data: {
          status: "enabled",
          enabledAt: new Date(),
          disabledAt: null,
          lastError: null,
        },
      });
      return updated;
    }

    const existing = await IntegrationAccountModel.findOne({
      organisationId: safeOrganisationId,
      provider: normalized,
    }).setOptions({ sanitizeFilter: true });

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
      safeOrganisationId,
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
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      if (isReadFromPostgres()) {
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

      const existing = await IntegrationAccountModel.findOne({
        organisationId: safeOrganisationId,
        provider: normalized,
      }).setOptions({ sanitizeFilter: true });

      if (!existing) {
        const created = new IntegrationAccountModel({
          organisationId: safeOrganisationId,
          provider: normalized,
          status: "disabled",
          disabledAt: new Date(),
          enabledAt: null,
          lastError: null,
          credentialsStatus: "valid",
          lastValidatedAt: new Date(),
        });
        await created.save();
        await syncIntegrationAccountToPostgres(created);
        return created.toJSON();
      }

      existing.status = "disabled";
      existing.disabledAt = new Date();
      existing.enabledAt = null;

      await existing.save();
      await syncIntegrationAccountToPostgres(existing);
      return existing.toJSON();
    }

    if (isReadFromPostgres()) {
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
    }

    const existing = await IntegrationAccountModel.findOne({
      organisationId: safeOrganisationId,
      provider: normalized,
    }).setOptions({ sanitizeFilter: true });

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
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    if (isMerckProvider(normalized)) {
      return { ok: true };
    }

    const account = isReadFromPostgres()
      ? await prisma.integrationAccount.findFirst({
          where: { organisationId: safeOrganisationId, provider: normalized },
        })
      : await IntegrationAccountModel.findOne({
          organisationId: safeOrganisationId,
          provider: normalized,
        })
          .setOptions({ sanitizeFilter: true })
          .lean();

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

    if (isReadFromPostgres()) {
      await prisma.integrationAccount.updateMany({
        where: { organisationId: safeOrganisationId, provider: normalized },
        data: {
          credentialsStatus: result.ok ? "valid" : "invalid",
          lastValidatedAt: new Date(),
          lastError: result.ok ? null : result.reason,
        },
      });
    } else {
      await IntegrationAccountModel.updateOne(
        { organisationId: safeOrganisationId, provider: normalized },
        {
          $set: {
            credentialsStatus: result.ok ? "valid" : "invalid",
            lastValidatedAt: new Date(),
            lastError: result.ok ? null : result.reason,
          },
        },
        { sanitizeFilter: true },
      );

      const updated = await IntegrationAccountModel.findOne({
        organisationId: safeOrganisationId,
        provider: normalized,
      }).setOptions({ sanitizeFilter: true });
      if (updated) {
        await syncIntegrationAccountToPostgres(updated);
      }
    }

    return result;
  },

  async requireAccount(
    organisationId: string,
    provider: string,
  ): Promise<IntegrationAccountDocument | PrismaIntegrationAccount> {
    const safeOrganisationId = requireOrganisationId(organisationId);
    const normalized = ensureProvider(provider);

    const account = isReadFromPostgres()
      ? await prisma.integrationAccount.findFirst({
          where: { organisationId: safeOrganisationId, provider: normalized },
        })
      : await IntegrationAccountModel.findOne({
          organisationId: safeOrganisationId,
          provider: normalized,
        }).setOptions({ sanitizeFilter: true });

    if (!account) {
      throw new IntegrationServiceError("Integration not found.", 404);
    }

    return account;
  },
};
