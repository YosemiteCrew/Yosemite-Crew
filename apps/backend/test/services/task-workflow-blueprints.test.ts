import { TemplateKind } from "@prisma/client";
import {
  buildTaskWorkflowTemplateSchemaSnapshot,
  validateTaskWorkflowTemplateBlueprint,
} from "../../src/services/task-workflow-blueprints";

describe("task workflow blueprints", () => {
  it("builds a task template blueprint with required sections", () => {
    const snapshot = buildTaskWorkflowTemplateSchemaSnapshot("TASK_TEMPLATE");

    expect(snapshot.sections.map((section) => section.id)).toEqual([
      "definition",
      "assignment",
      "timing",
    ]);
  });

  it("accepts a valid care pathway schema snapshot", () => {
    const snapshot = buildTaskWorkflowTemplateSchemaSnapshot("CARE_PATHWAY");
    const result = validateTaskWorkflowTemplateBlueprint(
      TemplateKind.CARE_PATHWAY,
      snapshot,
    );

    expect(result.missingSectionIds).toHaveLength(0);
    expect(result.missingFieldPaths).toHaveLength(0);
    expect(result.invalidFieldPaths).toHaveLength(0);
  });

  it("rejects invalid task template select options", () => {
    const snapshot = buildTaskWorkflowTemplateSchemaSnapshot("TASK_TEMPLATE");
    const assignmentSection = snapshot.sections.find(
      (section) => section.id === "assignment",
    );

    if (!assignmentSection) {
      throw new Error("Missing assignment section");
    }

    const audienceField = assignmentSection.fields.find(
      (field) => field.key === "audience",
    );

    if (!audienceField) {
      throw new Error("Missing audience field");
    }

    audienceField.options = [{ label: "Doctor", value: "DOCTOR" }];

    const result = validateTaskWorkflowTemplateBlueprint(
      TemplateKind.TASK_TEMPLATE,
      snapshot,
    );

    expect(result.invalidFieldPaths).toContain(
      "TASK_TEMPLATE.assignment.audience.options",
    );
  });

  it("rejects missing care pathway schedule sections", () => {
    const result = validateTaskWorkflowTemplateBlueprint(
      TemplateKind.CARE_PATHWAY,
      { sections: [] },
    );

    expect(result.missingSectionIds).toEqual([
      "admission",
      "schedule",
      "discharge",
    ]);
  });
});
