import type { FormField } from "@yosemite-crew/types";
import type { ParsedDraftField } from "./formDraftImportParser";

export type FieldDiffChange = "added" | "removed" | "changed" | "unchanged";

export interface FieldDiffSnapshot {
  type: string;
  label: string;
  required: boolean;
}

export interface FieldDiffEntry {
  id: string;
  change: FieldDiffChange;
  before?: FieldDiffSnapshot;
  after?: FieldDiffSnapshot;
}

const toSnapshot = (
  field: FormField | ParsedDraftField,
): FieldDiffSnapshot => ({
  type: field.type,
  label: field.label,
  required: Boolean(field.required),
});

const sameSnapshot = (a: FieldDiffSnapshot, b: FieldDiffSnapshot): boolean =>
  a.type === b.type && a.label === b.label && a.required === b.required;

/**
 * Compares the proposed draft fields against the base version's snapshot.
 *
 * `base` is empty when the source form has never been published - every
 * proposed field is then reported as `added`, which is correct: there is
 * nothing published yet to differ from.
 */
export const computeFieldDiff = (
  base: FormField[],
  proposed: ParsedDraftField[],
): FieldDiffEntry[] => {
  const baseById = new Map(base.map((field) => [field.id, field]));
  const proposedById = new Map(proposed.map((field) => [field.id, field]));
  const allIds = new Set([...baseById.keys(), ...proposedById.keys()]);

  const entries: FieldDiffEntry[] = [];
  allIds.forEach((id) => {
    const beforeField = baseById.get(id);
    const afterField = proposedById.get(id);

    if (beforeField && !afterField) {
      entries.push({ id, change: "removed", before: toSnapshot(beforeField) });
      return;
    }
    if (!beforeField && afterField) {
      entries.push({ id, change: "added", after: toSnapshot(afterField) });
      return;
    }
    if (beforeField && afterField) {
      const before = toSnapshot(beforeField);
      const after = toSnapshot(afterField);
      entries.push({
        id,
        change: sameSnapshot(before, after) ? "unchanged" : "changed",
        before,
        after,
      });
    }
  });

  return entries;
};
