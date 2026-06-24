import { describe, expect, it } from "@jest/globals";
import { DEFAULT_LIBRARY_TEMPLATE_SEEDS } from "../../src/scripts/template-library-seed.data";

describe("template-library-seed", () => {
  it("defines default library templates for every resolver fallback kind", () => {
    expect(DEFAULT_LIBRARY_TEMPLATE_SEEDS).toHaveLength(7);

    // Every storage kind the resolver can normalise to must have a YC default so
    // resolve() never 404s when no org/user template is linked (FORM also covers CONSENT,
    // TASK_TEMPLATE covers TASK_ASSIGNMENT, CARE_PATHWAY covers INPATIENT_SCHEDULE).
    expect(
      DEFAULT_LIBRARY_TEMPLATE_SEEDS.map((seed) => seed.kind).sort(),
    ).toEqual([
      "CARE_PATHWAY",
      "DISCHARGE_SUMMARY",
      "FORM",
      "PRESCRIPTION",
      "SOAP_NOTE",
      "TASK_TEMPLATE",
      "VITAL_RECORD",
    ]);
    for (const seed of DEFAULT_LIBRARY_TEMPLATE_SEEDS) {
      expect(seed.ownership).toBe("YC_LIBRARY");
      expect(seed.rules.appliesTo.defaultForKind).toBe(true);
      expect(seed.schemaSnapshot.sections.length).toBeGreaterThan(0);
    }

    const soap = DEFAULT_LIBRARY_TEMPLATE_SEEDS.find(
      (seed) => seed.kind === "SOAP_NOTE",
    );
    expect(soap).toBeDefined();
    expect(soap).toEqual(
      expect.objectContaining({
        ownership: "YC_LIBRARY",
        scope: "ORGANISATION",
        rules: {
          appliesTo: {
            defaultForKind: true,
          },
        },
      }),
    );
    // Single-sourced canonical SOAP: four S/O/A/P sections (mapped by field key in the
    // workspace) with a chief-complaint field, all S/O/A/P bodies rich text.
    expect(soap?.schemaSnapshot.sections.map((section) => section.id)).toEqual([
      "subjective",
      "objective",
      "assessment",
      "plan",
    ]);
    const fieldKeys = soap?.schemaSnapshot.sections.flatMap((section) =>
      section.fields.map((field) => field.key),
    );
    expect(fieldKeys).toEqual([
      "subjective",
      "objective",
      "assessment",
      "plan",
    ]);
    const soapBodyFields = soap?.schemaSnapshot.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.key !== undefined);
    expect(soapBodyFields?.every((field) => field.type === "richText")).toBe(
      true,
    );

    const discharge = DEFAULT_LIBRARY_TEMPLATE_SEEDS.find(
      (seed) => seed.kind === "DISCHARGE_SUMMARY",
    );
    expect(discharge?.schemaSnapshot.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "follow_up",
          fields: [
            expect.objectContaining({
              key: "followUpInDays",
              type: "number",
              rules: { unit: "days" },
            }),
          ],
        }),
      ]),
    );

    const prescription = DEFAULT_LIBRARY_TEMPLATE_SEEDS.find(
      (seed) => seed.kind === "PRESCRIPTION",
    );
    expect(prescription?.schemaSnapshot.sections[0].fields[0]).toEqual(
      expect.objectContaining({
        key: "medicationLine",
        type: "medicationLine",
        repeatable: true,
        rules: {
          columns: [
            "inventoryItemId",
            "dosage",
            "frequency",
            "durationDays",
            "instructions",
            "qty",
          ],
        },
      }),
    );
  });
});
