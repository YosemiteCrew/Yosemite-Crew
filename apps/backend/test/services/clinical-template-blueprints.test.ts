import { TemplateKind } from "@prisma/client";
import { CANONICAL_PRESCRIPTION_ROW_KEYS } from "@yosemite-crew/types";
import {
  buildClinicalTemplateSchemaSnapshot,
  getClinicalTemplateBlueprint,
  normalizeClinicalTemplateSchemaSnapshot,
  validateClinicalTemplateBlueprint,
} from "../../src/services/clinical-template-blueprints";

describe("clinical template blueprints", () => {
  it("builds a SOAP note blueprint with the required sections", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");

    expect(snapshot.sections.map((section) => section.id)).toEqual([
      "subjective",
      "objective",
      "assessment",
      "plan",
    ]);
    expect(
      snapshot.sections.flatMap((section) =>
        section.fields.map((field) => field.key),
      ),
    ).toEqual(["subjective", "objective", "assessment", "plan"]);
  });

  it("accepts a valid SOAP note schema snapshot", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");
    const result = validateClinicalTemplateBlueprint(
      TemplateKind.SOAP_NOTE,
      snapshot,
    );

    expect(result.missingSectionIds).toHaveLength(0);
    expect(result.missingFieldPaths).toHaveLength(0);
    expect(result.invalidFieldPaths).toHaveLength(0);
  });

  it("returns the prescription blueprint with the canonical medication line", () => {
    const blueprint = getClinicalTemplateBlueprint("PRESCRIPTION");

    expect(blueprint.sections.map((section) => section.id)).toEqual([
      "medications",
      "instructions",
      "notes",
    ]);
    expect(blueprint.sections[0].fields[0].type).toBe("medicationLine");
    expect(blueprint.sections[0].fields[0].key).toBe("medicationLine");
    expect(blueprint.sections[0].fields[0].rules).toEqual(
      expect.objectContaining({ inventoryItemKind: "MEDICAL" }),
    );
    expect(blueprint.sections[0].fields[0].rules?.columns).toEqual(
      CANONICAL_PRESCRIPTION_ROW_KEYS,
    );
    expect(blueprint.sections[0].fields[0]).toEqual(
      expect.objectContaining({
        key: "medicationLine",
        type: "medicationLine",
      }),
    );
  });

  it("adds optional prescription sections for medication-only payloads", () => {
    const canonical = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");
    const medications = canonical.sections.find(
      (section) => section.id === "medications",
    );
    const normalized = normalizeClinicalTemplateSchemaSnapshot(
      TemplateKind.PRESCRIPTION,
      { sections: medications ? [medications] : [] },
    );

    expect(normalized.sections.map((section) => section.id)).toEqual([
      "medications",
      "instructions",
      "notes",
    ]);
    expect(
      validateClinicalTemplateBlueprint(TemplateKind.PRESCRIPTION, normalized),
    ).toEqual(
      expect.objectContaining({
        missingSectionIds: [],
        missingFieldPaths: [],
        invalidFieldPaths: [],
      }),
    );
  });

  it("preserves complete prescription snapshots", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");

    expect(
      normalizeClinicalTemplateSchemaSnapshot(
        TemplateKind.PRESCRIPTION,
        snapshot,
      ),
    ).toBe(snapshot);
  });

  it("returns a discharge blueprint using follow-up days rather than a date", () => {
    const blueprint = getClinicalTemplateBlueprint("DISCHARGE_SUMMARY");
    const followUpSection = blueprint.sections.find(
      (section) => section.id === "follow_up",
    );

    expect(followUpSection?.fields[0]).toEqual(
      expect.objectContaining({
        key: "followUpInDays",
        type: "number",
        rules: { unit: "days" },
      }),
    );
  });

  it("accepts the canonical discharge summary schema snapshot", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("DISCHARGE_SUMMARY");
    const result = validateClinicalTemplateBlueprint(
      TemplateKind.DISCHARGE_SUMMARY,
      snapshot,
    );

    expect(result.requiredSectionIds).toEqual(["summary", "follow_up"]);
    expect(result.missingSectionIds).toHaveLength(0);
    expect(result.missingFieldPaths).toHaveLength(0);
    expect(result.invalidFieldPaths).toHaveLength(0);
  });

  it("accepts a valid vital-record schema and rejects missing sections", () => {
    const valid = validateClinicalTemplateBlueprint(TemplateKind.VITAL_RECORD, {
      sections: [
        { id: "measured_at" },
        { id: "vitals" },
        { id: "notes" },
        { id: "metadata" },
      ],
    });

    expect(valid.missingSectionIds).toHaveLength(0);

    const invalid = validateClinicalTemplateBlueprint(
      TemplateKind.VITAL_RECORD,
      {
        sections: [{ id: "notes" }],
      },
    );

    expect(invalid.missingSectionIds).toEqual(["vitals"]);
  });

  it("detects invalid field types within a clinical section", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");
    const medicationsSection = snapshot.sections.find(
      (section) => section.id === "medications",
    );

    if (!medicationsSection) {
      throw new Error("Missing medications section");
    }

    medicationsSection.fields[0] = {
      ...medicationsSection.fields[0],
      type: "text",
    };

    const result = validateClinicalTemplateBlueprint(
      TemplateKind.PRESCRIPTION,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "PRESCRIPTION.medications.medicationLine.type",
    );
  });

  it("keeps prescription medication line rules aligned with the shared row contract", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");
    const medicationLine = snapshot.sections
      .find((section) => section.id === "medications")
      ?.fields.find((field) => field.key === "medicationLine");

    expect(medicationLine?.rules?.columns).toEqual(
      CANONICAL_PRESCRIPTION_ROW_KEYS,
    );
    expect(medicationLine?.rules?.rowKeys).toEqual(
      CANONICAL_PRESCRIPTION_ROW_KEYS,
    );

    const validation = validateClinicalTemplateBlueprint(
      TemplateKind.PRESCRIPTION,
      {
        sections: [
          {
            id: "medications",
            title: "Medications",
            fields: [
              {
                ...medicationLine,
                defaultValue: [
                  {
                    inventoryItemId: "inv-1",
                    medicineName: "Carprofen",
                    dosageForm: "Tablet",
                    route: "Oral",
                    frequency: "SID (once daily)",
                    durationDays: "5",
                    durationUnit: "days",
                    qty: "5",
                    refill: "0",
                    instructions: "Give with food",
                    fulfillment: "IN_HOUSE",
                    controlledSubstance: false,
                    prescriptionRequired: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(validation.invalidFieldPaths).toHaveLength(0);
    expect(validation.missingFieldPaths).toHaveLength(0);
  });

  it("detects invalid field rules for unit configurations", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("VITAL_RECORD");
    const vitalsSection = snapshot.sections.find(
      (section) => section.id === "vitals",
    );

    if (!vitalsSection) {
      throw new Error("Missing vitals section");
    }

    const weightField = vitalsSection.fields.find(
      (field) => field.key === "weightLbs",
    );

    if (!weightField) {
      throw new Error("Missing weightLbs field");
    }

    weightField.rules = { unit: "wrong" };

    const result = validateClinicalTemplateBlueprint(
      TemplateKind.VITAL_RECORD,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "VITAL_RECORD.vitals.weightLbs.rules",
    );
  });

  it("ignores non-clinical template kinds", () => {
    const result = validateClinicalTemplateBlueprint(TemplateKind.FORM, {
      sections: [],
    });

    expect(result.missingSectionIds).toHaveLength(0);
    expect(result.requiredSectionIds).toHaveLength(0);
  });
});
