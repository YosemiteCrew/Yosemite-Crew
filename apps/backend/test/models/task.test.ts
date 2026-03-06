import { describe, it, expect } from "@jest/globals";
import TaskModel from "../../src/models/task";

describe("Task Model", () => {
  // ======================================================================
  // 1. Validation Logic (Required Fields & Types)
  // ======================================================================
  describe("Schema Validation", () => {
    it("should be valid if all required fields are present", () => {
      const task = new TaskModel({
        createdBy: "user1",
        assignedTo: "user2",
        audience: "EMPLOYEE_TASK",
        source: "CUSTOM",
        name: "Task Name",
        dueAt: new Date(),
        status: "PENDING",
      });

      const err = task.validateSync();
      expect(err).toBeUndefined();
    });

    it("should trigger validation error if required fields are missing", () => {
      const task = new TaskModel({}); // Empty object

      const err = task.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["createdBy"]).toBeDefined();
      expect(err?.errors["assignedTo"]).toBeDefined();
      expect(err?.errors["audience"]).toBeDefined();
      expect(err?.errors["source"]).toBeDefined();
      expect(err?.errors["dueAt"]).toBeDefined();
    });

    it("should validate Enums", () => {
      const task = new TaskModel({
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: new Date(),
        audience: "INVALID_AUDIENCE",
        source: "INVALID_SOURCE",
        status: "INVALID_STATUS",
        recurrence: { type: "INVALID_RECURRENCE" },
      });

      const err = task.validateSync();
      expect(err?.errors["audience"]).toBeDefined();
      expect(err?.errors["source"]).toBeDefined();
      expect(err?.errors["status"]).toBeDefined();
      expect(err?.errors["recurrence.type"]).toBeDefined();
    });
  });

  // ======================================================================
  // 2. Nested Validation (Medication Logic)
  // ======================================================================
  describe("Medication Validation", () => {
    it("should require doses array to be non-empty if medication is present", () => {
      const task = new TaskModel({
        createdBy: "u1",
        assignedTo: "u2",
        audience: "PARENT_TASK",
        source: "CUSTOM",
        dueAt: new Date(),
        medication: {
          name: "Pill",
          doses: [], // Empty array should fail custom validator
        },
      });

      const err = task.validateSync();
      expect(err?.errors["medication.doses"]).toBeDefined();
      expect(err?.errors["medication.doses"].message).toContain(
        "At least one dose is required",
      );
    });

    it("should require dose details inside medication", () => {
      const task = new TaskModel({
        createdBy: "u1",
        assignedTo: "u2",
        audience: "PARENT_TASK",
        source: "CUSTOM",
        dueAt: new Date(),
        medication: {
          name: "Pill",
          doses: [{ time: "08:00" }], // Missing 'dosage' which is required in MedicationDoseSchema
        },
      });

      const err = task.validateSync();
      expect(err?.errors["medication.doses.0.dosage"]).toBeDefined();
    });

    it("should be valid with correct medication data", () => {
      const task = new TaskModel({
        createdBy: "u1",
        assignedTo: "u2",
        audience: "PARENT_TASK",
        source: "CUSTOM",
        dueAt: new Date(),
        medication: {
          name: "Pill",
          doses: [{ dosage: "10mg" }],
        },
      });

      const err = task.validateSync();
      expect(err).toBeUndefined();
    });
  });

  // ======================================================================
  // 3. Default Values
  // ======================================================================
  describe("Default Values", () => {
    it("should set default status to PENDING", () => {
      const task = new TaskModel({
        createdBy: "u1",
        assignedTo: "u2",
        audience: "PARENT_TASK",
        source: "CUSTOM",
        dueAt: new Date(),
      });
      expect(task.status).toBe("PENDING");
    });
  });

  // ======================================================================
  // 4. Indexes (Definition Verification)
  // ======================================================================
  describe("Indexes", () => {
    it("should have defined indexes", () => {
      const indexes = TaskModel.schema.indexes();

      // Expected indexes:
      // { assignedTo: 1, dueAt: 1 }
      // { companionId: 1, dueAt: 1 }
      // { organisationId: 1, dueAt: 1 }
      // { "recurrence.masterTaskId": 1 }

      const hasAssignedToIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["assignedTo"] === 1 && keys["dueAt"] === 1;
      });

      const hasCompanionIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["companionId"] === 1 && keys["dueAt"] === 1;
      });

      const hasMasterTaskIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["recurrence.masterTaskId"] === 1;
      });

      expect(hasAssignedToIndex).toBe(true);
      expect(hasCompanionIndex).toBe(true);
      expect(hasMasterTaskIndex).toBe(true);
    });
  });
});
