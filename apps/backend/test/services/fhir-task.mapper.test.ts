import { taskFhirMapper } from "../../src/services/fhir-task.mapper";

describe("fhir-task.mapper", () => {
  const task = {
    id: "task-1",
    organisationId: "org-1",
    appointmentId: "appt-1",
    companionId: "comp-1",
    createdBy: "user-1",
    assignedBy: "user-1",
    assignedTo: "user-2",
    assignedGroupId: "group-1",
    audience: "EMPLOYEE_TASK",
    source: "ORG_TEMPLATE",
    libraryTaskId: null,
    templateId: "template-1",
    category: "Vitals",
    name: "Record vitals",
    description: "Record vitals at 9 AM",
    additionalNotes: "Use the clinic cuff",
    medication: null,
    observationToolId: null,
    dueAt: new Date("2026-01-05T09:00:00.000Z"),
    timezone: "Asia/Kolkata",
    recurrence: null,
    reminder: null,
    syncWithCalendar: true,
    calendarEventId: null,
    attachments: null,
    status: "PENDING",
    completedAt: null,
    completedBy: null,
    createdAt: new Date("2026-01-04T00:00:00.000Z"),
    updatedAt: new Date("2026-01-04T00:00:00.000Z"),
  } as const;

  it("renders tasks as FHIR Task resources", () => {
    const fhirTask = taskFhirMapper.toFhirTask(task as never);

    expect(fhirTask.resourceType).toBe("Task");
    expect(fhirTask.id).toBe("task-1");
    expect(fhirTask.status).toBe("requested");
    expect(fhirTask.owner?.reference).toBe("Practitioner/user-2");
    expect(fhirTask.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://yosemitecrew.com/fhir/StructureDefinition/task-template-id",
          valueString: "template-1",
        }),
        expect.objectContaining({
          url: "https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-group-id",
          valueString: "group-1",
        }),
      ]),
    );
  });

  it("parses FHIR Task payloads into create input", () => {
    const created = taskFhirMapper.fromFhirTask(
      {
        resourceType: "Task",
        status: "requested",
        intent: "order",
        description: "Take temperature",
        owner: { reference: "Practitioner/user-2" },
        extension: [
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/task-organisation",
            valueString: "org-1",
          },
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/task-audience",
            valueString: "EMPLOYEE_TASK",
          },
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/task-due-at",
            valueString: "2026-01-05T09:00:00.000Z",
          },
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-group-id",
            valueString: "group-1",
          },
        ],
      },
      {
        createdBy: "user-1",
        assignedBy: "user-1",
      },
    );

    expect(created.organisationId).toBe("org-1");
    expect(created.assignedTo).toBe("user-2");
    expect(created.assignedGroupId).toBe("group-1");
    expect(created.category).toBe("Take temperature");
    expect(created.dueAt.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });
});
