import { computeFieldDiff } from "../../src/services/formDraftImportDiff";
import type { FormField } from "@yosemite-crew/types";
import type { ParsedDraftField } from "../../src/services/formDraftImportParser";

const baseField = (overrides: Partial<FormField> = {}): FormField =>
  ({
    id: "owner-name",
    type: "input",
    label: "Owner Name",
    required: true,
    ...overrides,
  }) as FormField;

const proposedField = (
  overrides: Partial<ParsedDraftField> = {},
): ParsedDraftField => ({
  id: "owner-name",
  type: "input",
  label: "Owner Name",
  required: true,
  sourceLine: 1,
  ...overrides,
});

describe("computeFieldDiff", () => {
  it("marks every proposed field as added when there is no base", () => {
    const entries = computeFieldDiff([], [proposedField()]);
    expect(entries).toEqual([
      {
        id: "owner-name",
        change: "added",
        after: { type: "input", label: "Owner Name", required: true },
      },
    ]);
  });

  it("marks a base field with no proposed counterpart as removed", () => {
    const entries = computeFieldDiff([baseField()], []);
    expect(entries).toEqual([
      {
        id: "owner-name",
        change: "removed",
        before: { type: "input", label: "Owner Name", required: true },
      },
    ]);
  });

  it("marks a field present in both with identical shape as unchanged", () => {
    const entries = computeFieldDiff([baseField()], [proposedField()]);
    expect(entries).toEqual([
      {
        id: "owner-name",
        change: "unchanged",
        before: { type: "input", label: "Owner Name", required: true },
        after: { type: "input", label: "Owner Name", required: true },
      },
    ]);
  });

  it("marks a field whose required flag differs as changed", () => {
    const entries = computeFieldDiff(
      [baseField({ required: true })],
      [proposedField({ required: false })],
    );
    expect(entries[0].change).toBe("changed");
    expect(entries[0].before?.required).toBe(true);
    expect(entries[0].after?.required).toBe(false);
  });

  it("marks a field whose type differs as changed", () => {
    const entries = computeFieldDiff(
      [baseField({ type: "input" })],
      [proposedField({ type: "textarea" })],
    );
    expect(entries[0].change).toBe("changed");
  });

  it("diffs multiple fields independently", () => {
    const entries = computeFieldDiff(
      [baseField({ id: "a", label: "A" }), baseField({ id: "b", label: "B" })],
      [
        proposedField({ id: "a", label: "A" }),
        proposedField({ id: "c", label: "C" }),
      ],
    );
    const byId = Object.fromEntries(entries.map((e) => [e.id, e.change]));
    expect(byId).toEqual({ a: "unchanged", b: "removed", c: "added" });
  });
});
