import CodeSyncStateModel, {
  type CodeSyncStateDocument,
  type CodeSyncStateMongo,
  type CodeSyncKind,
} from "src/models/code-sync-state";
import type { CodeSystem } from "src/models/code-entry";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";

const syncCodeSyncStateToPostgres = async (doc: CodeSyncStateDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.codeSyncState.upsert({
      where: {
        system_kind: {
          system: doc.system,
          kind: doc.kind,
        },
      },
      create: {
        system: doc.system,
        kind: doc.kind,
        version: doc.version,
        lastSyncedAt: doc.lastSyncedAt ?? null,
      },
      update: {
        version: doc.version,
        lastSyncedAt: doc.lastSyncedAt ?? null,
      },
    });
  } catch (err) {
    handleDualWriteError("CodeSyncState", err);
  }
};

export const CodeSyncService = {
  async get(system: CodeSystem, kind: CodeSyncKind) {
    if (isReadFromPostgres()) {
      return prisma.codeSyncState.findFirst({
        where: { system, kind },
      });
    }
    return CodeSyncStateModel.findOne({ system, kind }).lean();
  },

  async upsert(input: CodeSyncStateMongo) {
    if (isReadFromPostgres()) {
      return prisma.codeSyncState.upsert({
        where: { system_kind: { system: input.system, kind: input.kind } },
        create: {
          system: input.system,
          kind: input.kind,
          version: input.version,
          lastSyncedAt: input.lastSyncedAt ?? null,
        },
        update: {
          version: input.version,
          lastSyncedAt: input.lastSyncedAt ?? null,
        },
      });
    }

    const saved = await CodeSyncStateModel.findOneAndUpdate(
      { system: input.system, kind: input.kind },
      { $set: input },
      { upsert: true, new: true, sanitizeFilter: true },
    );

    if (saved) {
      await syncCodeSyncStateToPostgres(saved);
    }

    return saved;
  },
};
