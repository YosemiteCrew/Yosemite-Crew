import {
  materializeCarePathwaySeeds,
  materializeTaskTemplateSeed,
  materializeTaskWorkflowSeeds,
} from "../../src/services/task-workflow-materializer";

describe("task workflow materializer", () => {
  it("materializes a task template seed", () => {
    const seed = materializeTaskTemplateSeed(
      {
        taskKind: "MEDICATION",
        category: "Medication",
        name: "Give antibiotics",
        defaultRole: "EMPLOYEE_TASK",
        defaultAssigneeRole: "PARENT_TASK",
        defaultReminderOffsetMinutes: 30,
        syncWithCalendar: true,
      },
      {
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-1",
        dueAt: new Date("2026-01-01T10:00:00.000Z"),
        resolveAssignee: (_audience, assignedRole) =>
          assignedRole === "PARENT_TASK" ? "parent-1" : "user-1",
      },
    );

    expect(seed.templateId).toBe("tmpl-1");
    expect(seed.audience).toBe("EMPLOYEE_TASK");
    expect(seed.assignedTo).toBe("parent-1");
    expect(seed.reminder?.offsetMinutes).toBe(30);
    expect(seed.syncWithCalendar).toBe(true);
  });

  it("accepts expanded task kinds in workflow seeds", () => {
    const seed = materializeTaskTemplateSeed(
      {
        taskKind: "CARE",
        category: "Care",
        name: "Nursing check",
        defaultRole: "EMPLOYEE_TASK",
      },
      {
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-1",
        dueAt: new Date("2026-01-01T10:00:00.000Z"),
        resolveAssignee: () => "user-1",
      },
    );

    expect(seed.templateId).toBe("tmpl-1");
    expect(seed.category).toBe("Care");
  });

  it("materializes inpatient care pathway seeds from schedule blocks", () => {
    const seeds = materializeCarePathwaySeeds(
      {
        admissionOffsetMinutes: 0,
        taskBlocks: [
          {
            dayOffset: 0,
            timeOfDay: "08:30",
            taskKind: "MEDICATION",
            category: "Medication",
            name: "Morning medicine",
            audience: "EMPLOYEE_TASK",
            reminderOffsetMinutes: 15,
          },
          {
            dayOffset: 1,
            timeOfDay: "09:00",
            taskKind: "DIET",
            category: "Diet",
            name: "Check feeding",
            audience: "PARENT_TASK",
            assignedRole: "PARENT_TASK",
          },
        ],
        dischargeOffsetMinutes: 60,
        followUpTaskName: "Discharge review",
        signOffRequired: true,
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-2",
        resolveAssignee: (_audience, assignedRole) =>
          assignedRole === "PARENT_TASK" ? "parent-1" : "employee-1",
      },
    );

    expect(seeds).toHaveLength(3);
    expect(seeds[0].assignedTo).toBe("employee-1");
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T08:30:00.000Z");
    expect(seeds[1].assignedTo).toBe("parent-1");
    expect(seeds[2].name).toBe("Discharge review");
    expect(seeds[2].assignedTo).toBe("employee-1");
  });

  it("orders care pathway blocks by dependency graph", () => {
    const seeds = materializeCarePathwaySeeds(
      {
        taskBlocks: [
          {
            id: "followup",
            dayOffset: 0,
            timeOfDay: "10:00",
            taskKind: "CUSTOM",
            category: "Follow-up",
            name: "Review results",
            audience: "EMPLOYEE_TASK",
            dependsOn: ["labs"],
          },
          {
            id: "labs",
            dayOffset: 0,
            timeOfDay: "08:00",
            taskKind: "OBSERVATION_TOOL",
            category: "Vitals",
            name: "Collect samples",
            audience: "EMPLOYEE_TASK",
          },
        ],
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-3",
        resolveAssignee: () => "employee-1",
      },
    );

    expect(seeds[0].name).toBe("Collect samples");
    expect(seeds[1].name).toBe("Review results");
  });

  it("applies inpatient shift windows and exception skips", () => {
    const seeds = materializeCarePathwaySeeds(
      {
        taskBlocks: [
          {
            id: "shifted",
            dayOffset: 0,
            timeOfDay: "07:30",
            taskKind: "MEDICATION",
            category: "Medication",
            name: "Morning medicine",
            audience: "EMPLOYEE_TASK",
          },
          {
            id: "skipped",
            dayOffset: 1,
            timeOfDay: "09:00",
            taskKind: "DIET",
            category: "Diet",
            name: "Diet check",
            audience: "EMPLOYEE_TASK",
          },
        ],
        shiftWindows: [{ start: "08:00", end: "10:00" }],
        exceptions: [{ date: "2026-01-02", mode: "SKIP" }],
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-4",
        resolveAssignee: () => "employee-1",
      },
    );

    expect(seeds).toHaveLength(1);
    expect(seeds[0].name).toBe("Morning medicine");
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("parses a care pathway snapshot with block details, shift windows, and exceptions", () => {
    const seeds = materializeTaskWorkflowSeeds(
      "CARE_PATHWAY",
      {
        admissionOffsetMinutes: 0,
        taskBlocks: [
          {
            id: "meds",
            dayOffset: 0,
            timeOfDay: "07:00",
            taskKind: "MEDICATION",
            category: "Medication",
            name: "Morning medicine",
            audience: "EMPLOYEE_TASK",
            assignedRole: "EMPLOYEE_TASK",
            reminderOffsetMinutes: 10,
            additionalNotes: "Give with food",
            medication: { name: "Amoxicillin", dosage: "50mg" },
            observationToolId: "obs-1",
            recurrence: {
              type: "DAILY",
              customCron: "0 7 * * *",
              endAfterDays: 3,
            },
          },
          {
            dayOffset: 1,
            timeOfDay: "09:00",
            taskKind: "DIET",
            category: "Diet",
            name: "Feeding check",
            audience: "PARENT_TASK",
            dependsOn: ["meds", ""],
          },
        ],
        dischargeOffsetMinutes: 30,
        followUpTaskName: "Discharge review",
        signOffRequired: true,
        shiftWindows: [
          { start: "08:00", end: "18:00", days: [0, 1, 2, 3, 4, 5, 6, "x", 9] },
          { start: "06:00", end: "20:00" },
          { start: 42 },
        ],
        exceptions: [
          { date: "2026-01-02", mode: "SHIFT", start: "10:00", end: "11:00" },
          { date: "2026-01-03", mode: "SKIP" },
          { date: "2026-01-04", mode: "OTHER" },
        ],
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-5",
        resolveAssignee: (audience) =>
          audience === "PARENT_TASK" ? "parent-1" : "employee-1",
      },
    );

    expect(seeds).toHaveLength(3);
    expect(seeds[0].name).toBe("Morning medicine");
    expect(seeds[0].medication).toEqual({
      name: "Amoxicillin",
      dosage: "50mg",
    });
    expect(seeds[0].observationToolId).toBe("obs-1");
    expect(seeds[0].additionalNotes).toBe("Give with food");
    expect(seeds[0].recurrence).toMatchObject({
      type: "DAILY",
      isMaster: true,
      cronExpression: "0 7 * * *",
      endDate: new Date("2026-01-04T07:00:00.000Z"),
    });
    expect(seeds[0].reminder).toEqual({ enabled: true, offsetMinutes: 10 });
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T07:00:00.000Z");
    expect(seeds[1].name).toBe("Feeding check");
    expect(seeds[1].assignedTo).toBe("parent-1");
    expect(seeds[1].dueAt.toISOString()).toBe("2026-01-02T10:00:00.000Z");
    expect(seeds[2].name).toBe("Discharge review");
    expect(seeds[2].dueAt.toISOString()).toBe("2026-01-01T00:30:00.000Z");
    expect(seeds[2].reminder).toEqual({ enabled: true, offsetMinutes: 0 });
  });

  it("defaults optional care pathway snapshot fields when absent", () => {
    const seeds = materializeTaskWorkflowSeeds(
      "CARE_PATHWAY",
      {
        taskBlocks: [
          {
            dayOffset: 0,
            timeOfDay: "08:00",
            taskKind: "CARE",
            category: "Care",
            name: "Solo task",
            audience: "EMPLOYEE_TASK",
          },
        ],
      },
      {
        admissionAt: new Date("2026-01-01T00:00:00.000Z"),
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-6",
        resolveAssignee: () => "employee-1",
      },
    );

    expect(seeds).toHaveLength(1);
    expect(seeds[0].name).toBe("Solo task");
    expect(seeds[0].medication).toBeUndefined();
    expect(seeds[0].recurrence).toBeUndefined();
    expect(seeds[0].reminder).toBeUndefined();
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("materializes a task workflow seed from a template instance snapshot", () => {
    const seeds = materializeTaskWorkflowSeeds(
      "TASK_TEMPLATE",
      {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Evening medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 30,
            },
          },
        ],
      },
      {
        organisationId: "org-1",
        createdBy: "creator-1",
        templateId: "tmpl-3",
        anchorAt: new Date("2026-01-01T09:00:00.000Z"),
        resolveAssignee: () => "employee-2",
      },
    );

    expect(seeds).toHaveLength(1);
    expect(seeds[0].assignedTo).toBe("employee-2");
    expect(seeds[0].dueAt.toISOString()).toBe("2026-01-01T09:30:00.000Z");
  });

  describe("recurrence end date bound", () => {
    it("derives the template instance recurrence end date from defaultEndOffsetDays", () => {
      const seed = materializeTaskTemplateSeed(
        {
          taskKind: "MEDICATION",
          category: "Medication",
          name: "Give antibiotics",
          defaultRole: "EMPLOYEE_TASK",
          defaultRecurrence: { type: "DAILY", defaultEndOffsetDays: 2 },
        },
        {
          organisationId: "org-1",
          createdBy: "creator-1",
          templateId: "tmpl-1",
          dueAt: new Date("2026-01-01T10:00:00.000Z"),
          resolveAssignee: () => "user-1",
        },
      );

      expect(seed.recurrence).toMatchObject({
        type: "DAILY",
        isMaster: true,
        endDate: new Date("2026-01-03T10:00:00.000Z"),
      });
    });

    it("leaves the recurrence unbounded when defaultEndOffsetDays is absent", () => {
      const seed = materializeTaskTemplateSeed(
        {
          taskKind: "MEDICATION",
          category: "Medication",
          name: "Give antibiotics",
          defaultRole: "EMPLOYEE_TASK",
          defaultRecurrence: { type: "DAILY" },
        },
        {
          organisationId: "org-1",
          createdBy: "creator-1",
          templateId: "tmpl-1",
          dueAt: new Date("2026-01-01T10:00:00.000Z"),
          resolveAssignee: () => "user-1",
        },
      );

      expect(seed.recurrence?.endDate).toBeUndefined();
    });

    it("treats a zero-day offset as bounding generation to the first occurrence", () => {
      const seed = materializeTaskTemplateSeed(
        {
          taskKind: "MEDICATION",
          category: "Medication",
          name: "Give antibiotics",
          defaultRole: "EMPLOYEE_TASK",
          defaultRecurrence: { type: "DAILY", defaultEndOffsetDays: 0 },
        },
        {
          organisationId: "org-1",
          createdBy: "creator-1",
          templateId: "tmpl-1",
          dueAt: new Date("2026-01-01T10:00:00.000Z"),
          resolveAssignee: () => "user-1",
        },
      );

      expect(seed.recurrence?.endDate).toEqual(
        new Date("2026-01-01T10:00:00.000Z"),
      );
    });

    it("rejects a negative defaultEndOffsetDays at the input boundary", () => {
      expect(() =>
        materializeTaskWorkflowSeeds(
          "TASK_TEMPLATE",
          {
            sections: [
              {
                id: "definition",
                data: {
                  taskKind: "MEDICATION",
                  category: "Medication",
                  name: "Task",
                },
              },
              { id: "assignment", data: { defaultRole: "EMPLOYEE_TASK" } },
              {
                id: "timing",
                data: {
                  recurrence: { type: "DAILY", defaultEndOffsetDays: -1 },
                },
              },
            ],
          },
          {
            organisationId: "org-1",
            createdBy: "creator-1",
            templateId: "tmpl-1",
            anchorAt: new Date("2026-01-01T09:00:00.000Z"),
            resolveAssignee: () => "user-1",
          },
        ),
      ).toThrow(/finite, non-negative/);
    });

    it("rejects a non-finite defaultEndOffsetDays at the input boundary", () => {
      expect(() =>
        materializeTaskWorkflowSeeds(
          "TASK_TEMPLATE",
          {
            sections: [
              {
                id: "definition",
                data: {
                  taskKind: "MEDICATION",
                  category: "Medication",
                  name: "Task",
                },
              },
              { id: "assignment", data: { defaultRole: "EMPLOYEE_TASK" } },
              {
                id: "timing",
                data: {
                  recurrence: { type: "DAILY", defaultEndOffsetDays: Infinity },
                },
              },
            ],
          },
          {
            organisationId: "org-1",
            createdBy: "creator-1",
            templateId: "tmpl-1",
            anchorAt: new Date("2026-01-01T09:00:00.000Z"),
            resolveAssignee: () => "user-1",
          },
        ),
      ).toThrow(/finite, non-negative/);
    });

    it("derives the care pathway recurrence end date from endAfterDays", () => {
      const seeds = materializeCarePathwaySeeds(
        {
          taskBlocks: [
            {
              dayOffset: 0,
              timeOfDay: "08:00",
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Morning medicine",
              audience: "EMPLOYEE_TASK",
              recurrence: { type: "DAILY", endAfterDays: 5 },
            },
          ],
        },
        {
          admissionAt: new Date("2026-01-01T00:00:00.000Z"),
          organisationId: "org-1",
          createdBy: "creator-1",
          templateId: "tmpl-4",
          resolveAssignee: () => "employee-1",
        },
      );

      expect(seeds[0].recurrence).toMatchObject({
        type: "DAILY",
        isMaster: true,
        endDate: new Date("2026-01-06T08:00:00.000Z"),
      });
    });

    it("rejects a negative endAfterDays in a care pathway block at the input boundary", () => {
      expect(() =>
        materializeTaskWorkflowSeeds(
          "CARE_PATHWAY",
          {
            taskBlocks: [
              {
                dayOffset: 0,
                timeOfDay: "08:00",
                taskKind: "MEDICATION",
                category: "Medication",
                name: "Morning medicine",
                audience: "EMPLOYEE_TASK",
                recurrence: { type: "DAILY", endAfterDays: -3 },
              },
            ],
          },
          {
            admissionAt: new Date("2026-01-01T00:00:00.000Z"),
            organisationId: "org-1",
            createdBy: "creator-1",
            templateId: "tmpl-4",
            resolveAssignee: () => "employee-1",
          },
        ),
      ).toThrow(/finite, non-negative/);
    });

    it("bounds a custom cron recurrence with the same end date logic", () => {
      const seeds = materializeCarePathwaySeeds(
        {
          taskBlocks: [
            {
              dayOffset: 0,
              timeOfDay: "08:00",
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Morning medicine",
              audience: "EMPLOYEE_TASK",
              recurrence: {
                type: "CUSTOM",
                customCron: "0 8 * * *",
                endAfterDays: 4,
              },
            },
          ],
        },
        {
          admissionAt: new Date("2026-01-01T00:00:00.000Z"),
          organisationId: "org-1",
          createdBy: "creator-1",
          templateId: "tmpl-4",
          resolveAssignee: () => "employee-1",
        },
      );

      expect(seeds[0].recurrence).toMatchObject({
        type: "CUSTOM",
        cronExpression: "0 8 * * *",
        endDate: new Date("2026-01-05T08:00:00.000Z"),
      });
    });
  });
});
