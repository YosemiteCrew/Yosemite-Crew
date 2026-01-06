// taskTypes.test.ts
import {
  TaskStatus,
  RecurrenceType,
  TaskKind,
  Task,
  TaskTemplate,
  TaskLibrary,
  EMPTY_TASK,
} from "../../types/task";

describe("Task Types Definition", () => {
  // --- Section 1: Runtime Constants (Crucial for Coverage) ---
  describe("EMPTY_TASK Constant", () => {
    it("has the expected default values", () => {
      expect(EMPTY_TASK._id).toBe("");
      expect(EMPTY_TASK.assignedTo).toBe("");
      expect(EMPTY_TASK.audience).toBe("EMPLOYEE_TASK");
      expect(EMPTY_TASK.source).toBe("CUSTOM");
      expect(EMPTY_TASK.category).toBe("");
      expect(EMPTY_TASK.name).toBe("");
      expect(EMPTY_TASK.description).toBe("");
      expect(EMPTY_TASK.dueAt).toBeInstanceOf(Date);
      expect(EMPTY_TASK.status).toBe("PENDING");
    });
  });

  // --- Section 2: String Union Types ---
  describe("Union Types Validation", () => {
    it("accepts valid TaskStatus literal values", () => {
      const pending: TaskStatus = "PENDING";
      const inProgress: TaskStatus = "IN_PROGRESS";
      const completed: TaskStatus = "COMPLETED";
      const cancelled: TaskStatus = "CANCELLED";

      expect(pending).toBe("PENDING");
      expect(inProgress).toBe("IN_PROGRESS");
      expect(completed).toBe("COMPLETED");
      expect(cancelled).toBe("CANCELLED");
    });

    it("accepts valid RecurrenceType literal values", () => {
      const once: RecurrenceType = "ONCE";
      const daily: RecurrenceType = "DAILY";
      const weekly: RecurrenceType = "WEEKLY";
      const custom: RecurrenceType = "CUSTOM";

      expect(once).toBe("ONCE");
      expect(daily).toBe("DAILY");
      expect(weekly).toBe("WEEKLY");
      expect(custom).toBe("CUSTOM");
    });

    it("accepts valid TaskKind literal values", () => {
      const medication: TaskKind = "MEDICATION";
      const observation: TaskKind = "OBSERVATION_TOOL";
      const hygiene: TaskKind = "HYGIENE";
      const diet: TaskKind = "DIET";
      const custom: TaskKind = "CUSTOM";

      expect(medication).toBe("MEDICATION");
      expect(observation).toBe("OBSERVATION_TOOL");
      expect(hygiene).toBe("HYGIENE");
      expect(diet).toBe("DIET");
      expect(custom).toBe("CUSTOM");
    });
  });

  // --- Section 3: Task Object Structure ---
  describe("Task Structure", () => {
    it("creates a valid Task object with minimal required fields", () => {
      const now = new Date();

      const task: Task = {
        _id: "task-1",
        assignedTo: "user-1",
        audience: "EMPLOYEE_TASK",
        source: "CUSTOM",
        category: "Medication",
        name: "Give medicine",
        dueAt: now,
        status: "PENDING",
      };

      expect(task._id).toBe("task-1");
      expect(task.assignedTo).toBe("user-1");
      expect(task.audience).toBe("EMPLOYEE_TASK");
      expect(task.source).toBe("CUSTOM");
      expect(task.dueAt).toBeInstanceOf(Date);
      expect(task.status).toBe("PENDING");
    });

    it("creates a valid Task object with medication, recurrence, reminder and attachments", () => {
      const now = new Date();

      const task: Task = {
        _id: "task-2",
        organisationId: "org-1",
        appointmentId: "appt-1",
        companionId: "comp-1",
        createdBy: "admin-1",
        assignedBy: "vet-1",
        assignedTo: "staff-1",
        audience: "PARENT_TASK",
        source: "YC_LIBRARY",
        libraryTaskId: "lib-1",
        category: "Medication",
        name: "Amoxicillin",
        description: "Give antibiotic after food",
        additionalNotes: "Monitor for vomiting",
        medication: {
          name: "Amoxicillin",
          type: "Tablet",
          notes: "Crush if needed",
          doses: [
            { dosage: "1 tab", time: "09:00", frequency: "DAILY" },
            { dosage: "1 tab", time: "21:00", frequency: "DAILY" },
          ],
        },
        dueAt: now,
        timezone: "Asia/Kolkata",
        recurrence: {
          type: "DAILY",
          isMaster: true,
          cronExpression: "0 9 * * *",
          endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        reminder: {
          enabled: true,
          offsetMinutes: 15,
          scheduledNotificationId: "notif-1",
        },
        syncWithCalendar: true,
        calendarEventId: "gcal-1",
        attachments: [{ id: "att-1", name: "prescription.pdf" }],
        status: "IN_PROGRESS",
        createdAt: now,
        updatedAt: now,
      };

      expect(task.source).toBe("YC_LIBRARY");
      expect(task.audience).toBe("PARENT_TASK");
      expect(task.medication?.doses?.length).toBe(2);
      expect(task.recurrence?.type).toBe("DAILY");
      expect(task.recurrence?.isMaster).toBe(true);
      expect(task.reminder?.enabled).toBe(true);
      expect(task.attachments?.[0].name).toBe("prescription.pdf");
      expect(task.status).toBe("IN_PROGRESS");
    });
  });

  // --- Section 4: TaskTemplate Structure ---
  describe("TaskTemplate Structure", () => {
    it("creates a valid TaskTemplate object", () => {
      const now = new Date();

      const template: TaskTemplate = {
        id: "tmpl-1",
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        libraryTaskId: "lib-1",
        category: "Medication",
        name: "Default Antibiotic Course",
        description: "Standard antibiotic schedule",
        kind: "MEDICATION",
        defaultRole: "PARENT",
        defaultMedication: {
          name: "Amoxicillin",
          type: "Tablet",
          dosage: "1 tab",
          frequency: "DAILY",
        },
        defaultRecurrence: {
          type: "DAILY",
          customCron: "0 9 * * *",
          defaultEndOffsetDays: 7,
        },
        defaultReminderOffsetMinutes: 15,
        isActive: true,
        createdBy: "admin-1",
        createdAt: now,
        updatedAt: now,
      };

      expect(template.source).toBe("ORG_TEMPLATE");
      expect(template.kind).toBe("MEDICATION");
      expect(template.defaultRole).toBe("PARENT");
      expect(template.isActive).toBe(true);
      expect(template.createdAt).toBeInstanceOf(Date);
    });
  });

  // --- Section 5: TaskLibrary Structure ---
  describe("TaskLibrary Structure", () => {
    it("creates a valid TaskLibrary object", () => {
      const now = new Date();

      const library: TaskLibrary = {
        id: "lib-1",
        source: "YC_LIBRARY",
        kind: "OBSERVATION_TOOL",
        category: "Observation",
        name: "Respiratory rate check",
        defaultDescription: "Check RR and note abnormalities",
        schema: {
          medicationFields: {
            hasMedicationName: false,
            hasType: false,
            hasDosage: false,
            hasFrequency: false,
          },
          requiresObservationTool: true,
          allowsRecurrence: true,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      expect(library.source).toBe("YC_LIBRARY");
      expect(library.kind).toBe("OBSERVATION_TOOL");
      expect(library.schema.requiresObservationTool).toBe(true);
      expect(library.isActive).toBe(true);
      expect(library.createdAt).toBeInstanceOf(Date);
    });
  });
});
