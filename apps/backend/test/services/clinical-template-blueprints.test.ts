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
      "instructions",
      "notes",
    ]);
    expect(blueprint.sections[0].fields[0].type).toBe("medicationLine");
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
        sections: [{ id: "measured_at" }],
      },
    );

    expect(invalid.missingSectionIds).toEqual(["vitals", "notes", "metadata"]);
  });

  it("detects invalid field types within a clinical section", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("PRESCRIPTION");
    const instructionsSection = snapshot.sections.find(
      (section) => section.id === "instructions",
    );

    if (!instructionsSection) {
      throw new Error("Missing instructions section");
    }

    instructionsSection.fields[0] = {
      ...instructionsSection.fields[0],
      type: "text",
    };

    const result = validateClinicalTemplateBlueprint(
      TemplateKind.PRESCRIPTION,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "PRESCRIPTION.instructions.usageInstructions.type",
    );
  });

  it("detects invalid select options within a clinical section", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");
    const assessmentSection = snapshot.sections.find(
      (section) => section.id === "assessment",
    );

    if (!assessmentSection) {
      throw new Error("Missing assessment section");
    }

    const severityField = assessmentSection.fields.find(
      (field) => field.key === "severity",
    );

    if (!severityField) {
      throw new Error("Missing severity field");
    }

    severityField.options = [{ label: "Low", value: "low" }];

    const result = validateClinicalTemplateBlueprint(
      TemplateKind.SOAP_NOTE,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "SOAP_NOTE.assessment.severity.options",
    );
  });

  it("detects invalid field rules for repeater and table configurations", () => {
    const snapshot = buildClinicalTemplateSchemaSnapshot("SOAP_NOTE");
    const objectiveSection = snapshot.sections.find(
      (section) => section.id === "objective",
    );

    if (!objectiveSection) {
      throw new Error("Missing objective section");
    }

    const testResultsField = objectiveSection.fields.find(
      (field) => field.key === "testResults",
    );

    if (!testResultsField) {
      throw new Error("Missing testResults field");
    }

    testResultsField.rules = { columns: ["wrong"] };

    const result = validateClinicalTemplateBlueprint(
      TemplateKind.SOAP_NOTE,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "SOAP_NOTE.objective.testResults.rules",
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
