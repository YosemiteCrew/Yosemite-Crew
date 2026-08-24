import fs from "node:fs";
import path from "node:path";
import { prisma } from "src/config/prisma";

/**
 * VeNom publishes 28,850 relationships between clinical terms. None have ever been
 * imported, because most of the parents are not in VeNom's Terms sheet at all - they are
 * taxonomy nodes that exist only as relationship endpoints. They are created here as
 * CLINICAL_CATEGORY so the edges have something to attach to, and deliberately not as
 * CLINICAL_TERM so clinical autocomplete keeps offering diagnoses rather than headings.
 */
export type VenomExtract = {
  source: string;
  release: string;
  released: string;
  names: Record<string, string>;
  edges: Array<[string, string, string]>;
};

export type PlannedCategory = {
  code: string;
  display: string;
  venomId: string;
};
export type PlannedEdge = {
  sourceCode: string;
  type: string;
  targetCode: string;
};
export type SkippedEdge = {
  edge: [string, string, string];
  reason: string;
};

export type ImportPlan = {
  categories: PlannedCategory[];
  edges: PlannedEdge[];
  skipped: SkippedEdge[];
};

/** Category codes are namespaced so they can never collide with a YC-###### term. */
export const categoryCode = (venomId: string) => `YCAT:VENOM:${venomId}`;

/**
 * Only the relationship types that describe the clinical taxonomy. "is breed of" is
 * excluded on purpose: breeds are keyed by IDEXX-derived codes here, not VeNom ids, and
 * guessing that join would attach the wrong breed to a clinical record.
 */
export const IMPORTED_TYPES = new Set([
  "is a",
  "is in container",
  "is order in class",
  "is abnormal",
  "is species in order",
]);

/**
 * One VeNom id can legitimately map to several YC concepts: the same term exists in more
 * than one domain, so VeNom 18827 "Drinking less" is both a PresentingComplaint and a
 * ReasonForVisit. Three ids do this today. A single-valued index would keep whichever row
 * the query happened to return last and silently drop the other concept's hierarchy.
 */
export const planImport = (
  extract: VenomExtract,
  ycCodesByVenomId: Map<string, string[]>,
): ImportPlan => {
  const categories = new Map<string, PlannedCategory>();
  const edges: PlannedEdge[] = [];
  const skipped: SkippedEdge[] = [];
  const seen = new Set<string>();

  // A parent only becomes a category when nothing else already defines it, so an id that
  // is a real clinical term is never duplicated as a heading.
  const resolve = (venomId: string, allowCategory: boolean): string[] => {
    const existing = ycCodesByVenomId.get(venomId);
    if (existing?.length) return existing;
    if (!allowCategory) return [];
    const display = extract.names[venomId];
    if (!display) return [];
    const code = categoryCode(venomId);
    if (!categories.has(code)) categories.set(code, { code, display, venomId });
    return [code];
  };

  for (const edge of extract.edges) {
    const [from, type, to] = edge;

    if (!IMPORTED_TYPES.has(type)) {
      skipped.push({ edge, reason: `relationship type not imported: ${type}` });
      continue;
    }

    const children = resolve(from, false);
    if (children.length === 0) {
      skipped.push({ edge, reason: "child is not a known concept" });
      continue;
    }

    const parents = resolve(to, true);
    if (parents.length === 0) {
      skipped.push({ edge, reason: "parent is unknown and unnamed" });
      continue;
    }

    // Where a term exists in several domains the edge applies to each of them.
    let added = 0;
    for (const child of children) {
      for (const parent of parents) {
        if (child === parent) continue;
        const key = `${child}|${type}|${parent}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ sourceCode: child, type, targetCode: parent });
        added += 1;
      }
    }

    if (added === 0) {
      const selfOnly = children.every((child) => parents.includes(child));
      skipped.push({
        edge,
        reason: selfOnly ? "self-referential edge" : "duplicate edge",
      });
    }
  }

  // No filtering of unused categories: a category is only ever minted while resolving
  // the parent of an edge that is about to be kept, so an orphan cannot arise. Keep the
  // type check ahead of parent resolution and that stays true.
  return { categories: [...categories.values()], edges, skipped };
};

export const loadExtract = (filePath: string): VenomExtract => {
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("Invalid file path");
  }
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
};

export const loadVenomIndex = async () => {
  const mappings = await prisma.codeMapping.findMany({
    where: {
      sourceSystem: "YOSEMITECODE",
      targetSystem: "VENOM",
      active: true,
    },
    select: { sourceCode: true, targetCode: true },
    // Deterministic order, so a term present in several domains always yields the same
    // edge ordering between runs.
    orderBy: { sourceCode: "asc" },
  });
  const index = new Map<string, string[]>();
  for (const mapping of mappings) {
    const key = mapping.targetCode.trim();
    const codes = index.get(key);
    if (codes) codes.push(mapping.sourceCode);
    else index.set(key, [mapping.sourceCode]);
  }
  return index;
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const extract = loadExtract("data/venom_relationships.json");
  const index = await loadVenomIndex();
  const plan = planImport(extract, index);

  const reasons = new Map<string, number>();
  for (const item of plan.skipped) {
    reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
  }

  console.log(`VeNom release ${extract.release} (${extract.released})`);
  console.log(`  edges in file:     ${extract.edges.length}`);
  console.log(`  categories to add: ${plan.categories.length}`);
  console.log(`  edges to add:      ${plan.edges.length}`);
  console.log(`  skipped:           ${plan.skipped.length}`);
  for (const [reason, count] of [...reasons.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${count}  ${reason}`);
  }

  if (!apply) {
    console.log("dry run - pass --apply to write");
    return;
  }

  // One transaction. Committing the categories first would leave a half-imported
  // vocabulary behind if the edge insert then failed: thousands of category rows with
  // nothing pointing at them.
  const operations = [
    ...plan.categories.map((category) =>
      prisma.codeEntry.upsert({
        where: { system_code: { system: "YOSEMITECODE", code: category.code } },
        create: {
          system: "YOSEMITECODE" as const,
          code: category.code,
          display: category.display,
          type: "CLINICAL_CATEGORY" as const,
          active: true,
          synonyms: [],
          meta: {
            source: "VeNom",
            release: extract.release,
            venomId: category.venomId,
          },
        },
        update: {
          display: category.display,
          active: true,
          // Refreshed on every run. Without this a category imported from release g
          // keeps claiming release g after a later release renames or moves it.
          meta: {
            source: "VeNom",
            release: extract.release,
            venomId: category.venomId,
          },
        },
      }),
    ),
    prisma.codeRelationship.createMany({
      data: plan.edges.map((edge) => ({
        system: "YOSEMITECODE" as const,
        sourceCode: edge.sourceCode,
        type: edge.type,
        targetCode: edge.targetCode,
        active: true,
      })),
      skipDuplicates: true,
    }),
  ];

  const results = await prisma.$transaction(operations);
  const written = results[results.length - 1] as { count: number };

  // plan.categories counts every category the edges need, most of which already exist on
  // a rerun. Reporting it as "wrote" would overstate the work on every run after the first.
  console.log(
    `upserted ${plan.categories.length} categories and added ${written.count} edges`,
  );
  if (written.count !== plan.edges.length) {
    console.log(
      `  ${plan.edges.length - written.count} edges already existed and were left alone`,
    );
  }
  // A later release can withdraw a relationship. This run only adds, so a withdrawn edge
  // stays active until reconciliation is built.
  console.log(
    "  note: edges withdrawn by a later VeNom release are not deactivated by this run",
  );
};

// argv[1] rather than require.main, which is not defined under ESM.
const invokedDirectly = (process.argv[1] ?? "").includes(
  "import-venom-hierarchy",
);

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
