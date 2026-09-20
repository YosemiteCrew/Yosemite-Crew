import fs from "node:fs";
import path from "node:path";

// ParentService.delete never touches ParasiteRiskSubscription, and the daily
// sweep (parasite-risk.alerts.refreshFollowedCells) reads every row unfiltered.
// The parent-supplied location label and cell coordinates on an orphaned row
// are only removed by the database-level cascade, so both the schema relation
// and the foreign key in the migration history are asserted here.
const prismaDir = path.resolve(
  __dirname,
  "../../../../packages/database/prisma",
);

const schema = fs.readFileSync(path.join(prismaDir, "schema.prisma"), "utf8");

const readModel = (name: string): string => {
  const match = new RegExp(`\\nmodel ${name} \\{([\\s\\S]*?)\\n\\}`).exec(
    schema,
  );
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[1];
};

const readMigrations = (): string => {
  const migrationsDir = path.join(prismaDir, "migrations");
  return fs
    .readdirSync(migrationsDir)
    .map((entry) => path.join(migrationsDir, entry, "migration.sql"))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
};

describe("ParasiteRiskSubscription parent cascade", () => {
  it("relates each subscription to its parent and cascades on delete", () => {
    expect(readModel("ParasiteRiskSubscription")).toMatch(
      /parent\s+Parent\s+@relation\(fields: \[parentId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it("declares the back-relation on Parent", () => {
    expect(readModel("Parent")).toMatch(/\sParasiteRiskSubscription\[\]/);
  });

  it("adds the foreign key in the migration history", () => {
    expect(readMigrations()).toMatch(
      /ALTER TABLE "ParasiteRiskSubscription" ADD CONSTRAINT "ParasiteRiskSubscription_parentId_fkey" FOREIGN KEY \("parentId"\) REFERENCES "Parent"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("clears rows whose parent is already gone before adding the key", () => {
    const migrations = readMigrations();
    const cleanupIndex = migrations.indexOf(
      'DELETE FROM "ParasiteRiskSubscription" s',
    );
    const constraintIndex = migrations.indexOf(
      'ADD CONSTRAINT "ParasiteRiskSubscription_parentId_fkey"',
    );

    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeLessThan(constraintIndex);
  });
});
