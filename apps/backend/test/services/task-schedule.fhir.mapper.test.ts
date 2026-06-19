import { taskScheduleFhirMapper } from "../../src/services/task-schedule.fhir.mapper";

describe("taskScheduleFhirMapper", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  const schedule = {
    id: "schedule-1",
    templateInstanceId: "instance-1",
    templateId: "template-1",
    templateVersion: 3,
    templateKind: "INPATIENT_SCHEDULE",
    organisationId: "org-1",
    createdBy: "creator-1",
    activatedBy: "actor-1",
    activatedAt: now,
    status: "ACTIVE",
    scheduleInput: { section: "value" },
    materializedSeeds: [{ id: "seed-1" }],
    generatedTaskIds: ["task-1", "task-2"],
    completedAt: null,
    lastMaterializedAt: now,
    metadata: { source: "template" },
  };

  it("maps a schedule to a FHIR Task", () => {
    const resource = taskScheduleFhirMapper.toTask(schedule);

    expect(resource.resourceType).toBe("Task");
    expect(resource.id).toBe("schedule-1");
    expect(resource.status).toBe("accepted");
    expect(resource.output).toHaveLength(2);
    expect(
      resource.extension?.some((extension) =>
        extension.url.includes("task-schedule-template-instance"),
      ),
    ).toBe(true);
  });

  it("supports generated task ids passed separately", () => {
    const resource = taskScheduleFhirMapper.toTask(schedule, ["task-3"]);
    expect(resource.output?.[0]?.valueReference?.reference).toBe("Task/task-3");
  });

  it("reads primitive Parameters values", () => {
    expect(
      taskScheduleFhirMapper.getBooleanParameter(
        {
          resourceType: "Parameters",
          parameter: [{ name: "force", valueBoolean: true }],
        },
        "force",
      ),
    ).toBe(true);
    expect(
      taskScheduleFhirMapper.getDateParameter(
        {
          resourceType: "Parameters",
          parameter: [{ name: "deferUntil", valueDateTime: now.toISOString() }],
        },
        "deferUntil",
      ),
    ).toEqual(now);
  });
});
