import type { CodeSystem } from "src/models/code-entry";
import { prisma } from "src/config/prisma";

export type CodeSyncKind = "species" | "breeds" | "genders" | "tests";

export type CodeSyncStateRecord = {
  system: CodeSystem;
  kind: string;
  version: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CodeSyncStateInput = {
  system: CodeSystem;
  kind: CodeSyncKind;
  version: string;
  lastSyncedAt?: Date | null;
};

export const CodeSyncService = {
  async get(system: CodeSystem, kind: CodeSyncKind) {
    return prisma.codeSyncState.findUnique({
      where: {
        system_kind: {
          system,
          kind,
        },
      },
    });
  },

  async upsert(input: CodeSyncStateInput): Promise<CodeSyncStateRecord> {
    return prisma.codeSyncState.upsert({
      where: {
        system_kind: {
          system: input.system,
          kind: input.kind,
        },
      },
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
  },
};
