import { Status, TasksProps } from "../../types/tasks";

describe("Tasks Types Definition", () => {

  // --- Section 1: Status Union Type ---
  describe("Status Type", () => {
    it("accepts valid Status values", () => {
      const upcoming: Status = "Upcoming";
      const inProgress: Status = "In-progress";
      const completed: Status = "Completed";

      expect(upcoming).toBe("Upcoming");
      expect(inProgress).toBe("In-progress");
      expect(completed).toBe("Completed");
    });
  });

  // --- Section 2: TasksProps Object Structure ---
  describe("TasksProps Structure", () => {
    it("creates a valid TasksProps object with all required fields", () => {
      const taskItem: TasksProps = {
        task: "Complete Audit",
        description: "Review financial logs for Q3",
        category: "Finance",
        from: "Admin",
        to: "Auditor",
        toLabel: "Assignee",
        due: new Date("2025-12-31"),
        status: "Upcoming",
      };

      expect(taskItem).toBeDefined();
      expect(taskItem.task).toBe("Complete Audit");
      expect(taskItem.category).toBe("Finance");
    });
  });

  // --- Section 3: Date Object Handling ---
  describe("Date Field Validation", () => {
    it("correctly stores and retrieves the Date object in the 'due' field", () => {
      const specificDate = new Date("2024-01-01T10:00:00Z");

      const taskItem: TasksProps = {
        task: "Meeting",
        description: "Team Sync",
        category: "General",
        from: "Manager",
        to: "Staff",
        toLabel: "Attendees",
        due: specificDate,
        status: "In-progress",
      };

      expect(taskItem.due).toBeInstanceOf(Date);
      expect(taskItem.due.toISOString()).toBe(specificDate.toISOString());
    });
  });

  // --- Section 4: Type Integrity ---
  describe("Type Integrity", () => {
    it("allows accessing all properties defined in the interface", () => {
      // This ensures no field was missed in the type definition compared to usage expectations
      const taskItem: TasksProps = {
        task: "Inventory Check",
        description: "Count stock",
        category: "Operations",
        from: "System",
        to: "Tech",
        toLabel: "Tech",
        due: new Date(),
        status: "Completed",
      };

      const keys = Object.keys(taskItem);
      expect(keys).toContain("task");
      expect(keys).toContain("description");
      expect(keys).toContain("category");
      expect(keys).toContain("from");
      expect(keys).toContain("to");
      expect(keys).toContain("toLabel");
      expect(keys).toContain("due");
      expect(keys).toContain("status");
    });
  });
});