import { TemplateKind } from "@prisma/client";
import {
  buildClinicalTemplateSchemaSnapshot,
  getClinicalTemplateBlueprint,
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

  it("returns the prescription blueprint with medication and instruction sections", () => {
    const blueprint = getClinicalTemplateBlueprint("PRESCRIPTION");

    expect(blueprint.sections.map((section) => section.id)).toEqual([
      "medications",
    ]);
    expect(blueprint.sections[0].fields[0].type).toBe("medicationLine");
    expect(blueprint.sections[0].fields[0].key).toBe("medicationLine");
    expect(blueprint.sections[0].fields[0].rules).toEqual({
      columns: [
        "inventoryItemId",
        "dosage",
        "frequency",
        "durationDays",
        "instructions",
        "qty",
      ],
    });
    expect(blueprint.sections[0].fields[0]).toEqual(
      expect.objectContaining({
        key: "medicationLine",
        type: "medicationLine",
      }),
    );
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
