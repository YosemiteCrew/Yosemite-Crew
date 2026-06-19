import {
  clinicalArtifactFhirMapper,
  fromFHIRAppointment,
  toFHIRAppointment,
  taskScheduleFhirMapper,
  templateMapper,
  taskFhirMapper,
  type Appointment,
  type TemplateLike,
  type TemplateInstanceLike,
  type TaskLike,
  type SoapNoteRecord,
  type PrescriptionRecord,
  type DischargeSummaryRecord,
  type VitalRecordRecord,
  type TaskScheduleLike,
} from "@yosemite-crew/types";

describe("shared fhir contracts", () => {
  it("round-trips template questionnaires through the shared package", () => {
    const template = {
      id: "template-1",
      organisationId: "org-1",
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "SOAP_NOTE",
      name: "SOAP Note",
      description: "Clinical SOAP note",
      status: "PUBLISHED",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: 1,
      createdBy: "user-1",
      updatedBy: "user-2",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      versions: [
        {
          id: "version-1",
          version: 1,
          schemaSnapshot: {
            sections: [
              {
                id: "subjective",
                title: "Subjective",
                fields: [
                  {
                    key: "chiefComplaint",
                    label: "Chief complaint",
                    type: "text",
                  },
                ],
              },
            ],
          },
          renderConfigSnapshot: { layout: "single-column" },
          validationSnapshot: { required: ["subjective"] },
          publishedAt: new Date("2026-01-02T00:00:00.000Z"),
          createdBy: "user-1",
        },
      ],
    } as TemplateLike;

    const questionnaire = templateMapper.templateToQuestionnaire(template);
    const input = templateMapper.questionnaireToTemplateInput(questionnaire, {
      createdBy: "user-1",
      updatedBy: "user-2",
    });

    expect(questionnaire.item?.[0]?.linkId).toBe("subjective");
    expect(questionnaire.item?.[0]?.item?.[0]?.linkId).toBe("chiefComplaint");
    expect(input.kind).toBe("SOAP_NOTE");
    expect(input.schemaSnapshot.sections[0].id).toBe("subjective");
  });

  it("round-trips task payloads through the shared package", () => {
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
    } as TaskLike;

    const fhirTask = taskFhirMapper.toFhirTask(task);
    const created = taskFhirMapper.fromFhirTask(fhirTask, {
      createdBy: "user-1",
      assignedBy: "user-1",
    });

    expect(fhirTask.owner?.reference).toBe("Practitioner/user-2");
    expect(
      fhirTask.extension?.find(
        (extension) =>
          extension.url ===
          "https://yosemitecrew.com/fhir/StructureDefinition/task-template-id",
      )?.valueString,
    ).toBe("template-1");
    expect(created.assignedTo).toBe("user-2");
    expect(created.assignedGroupId).toBe("group-1");
    expect(created.category).toBe("Vitals");
    expect(created.dueAt.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("round-trips appointment template defaults through the shared package", () => {
    const appointment = {
      companion: {
        id: "comp-1",
        name: "Buddy",
        species: "Dog",
        parent: {
          id: "parent-1",
          name: "Parent One",
        },
      },
      organisationId: "org-1",
      appointmentDate: new Date("2026-01-05T09:00:00.000Z"),
      startTime: new Date("2026-01-05T09:00:00.000Z"),
      endTime: new Date("2026-01-05T09:30:00.000Z"),
      timeSlot: "09:00",
      durationMinutes: 30,
      status: "UPCOMING",
      appointmentType: {
        id: "service-1",
        name: "Consultation",
        speciality: {
          id: "spec-1",
          name: "Internal Medicine",
        },
      },
      templateDefaults: [
        {
          templateKind: "SOAP_NOTE",
          templateId: "tmpl-1",
          templateVersion: 2,
          source: "ORGANISATION_DEFAULT",
        },
      ],
    } as Appointment;

    const fhirAppointment = toFHIRAppointment(appointment);
    const parsedAppointment = fromFHIRAppointment(fhirAppointment);

    expect(
      fhirAppointment.extension?.filter(
        (extension) =>
          extension.url ===
          "https://yosemitecrew.com/fhir/StructureDefinition/appointment-template-defaults",
      ),
    ).toHaveLength(1);
    expect(parsedAppointment.templateDefaults).toEqual(
      appointment.templateDefaults,
    );
  });

  it("round-trips questionnaire responses through the shared package", () => {
    const template = {
      id: "template-2",
      organisationId: "org-2",
      ownerUserId: null,
      ownership: "ORG_TEMPLATE",
      kind: "FORM",
      name: "Intake",
      description: null,
      status: "DRAFT",
      scope: "ORGANISATION",
      rules: null,
      latestVersion: 1,
      publishedVersion: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      versions: [
        {
          id: "version-1",
          version: 1,
          schemaSnapshot: {
            sections: [
              {
                id: "general",
                title: "General",
                fields: [
                  {
                    key: "notes",
                    label: "Notes",
                    type: "textarea",
                  },
                ],
              },
            ],
          },
          renderConfigSnapshot: {},
          validationSnapshot: {},
          publishedAt: null,
          createdBy: "user-1",
        },
      ],
    } as TemplateLike;

    const instance = {
      id: "instance-1",
      templateId: "template-2",
      templateVersion: 1,
      organisationId: "org-2",
      status: "COMPLETED",
      data: { notes: "Hello" },
      authorId: "user-1",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    } as TemplateInstanceLike;

    const response = templateMapper.templateInstanceToQuestionnaireResponse(
      instance,
      template,
    );

    expect(response.status).toBe("completed");
    expect(response.item?.[0]?.item?.[0]?.answer?.[0]?.valueString).toBe(
      "Hello",
    );
  });

  it("maps clinical artifacts through the shared package", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    const soapRecord = {
      artifact: {
        id: "artifact-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: "tmpl-1",
        templateVersion: 2,
        templateVersionId: "tmpl-ver-1",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "SOAP summary",
        createdAt: now,
        updatedAt: now,
      },
      soapNote: {
        id: "soap-1",
        artifactId: "artifact-1",
        subjective: { chiefComplaint: "Cough" },
        objective: { temperature: 39 },
        assessment: { diagnosis: "Flu" },
        plan: { instructions: "Rest" },
        diagnoses: [{ code: "A1" }],
        metadata: { source: "template" },
        createdAt: now,
        updatedAt: now,
      },
    } as SoapNoteRecord;

    const composition =
      clinicalArtifactFhirMapper.soapNoteToComposition(soapRecord);
    const input = clinicalArtifactFhirMapper.compositionToSoapNoteInput(
      {
        resourceType: "Composition",
        title: "SOAP summary",
        extension: composition.extension,
        status: "final",
        type: { text: "SOAP note" },
        date: now.toISOString(),
        author: [{ reference: "Practitioner/author-1" }],
      },
      { organisationId: "org-1" },
    );

    expect(composition.resourceType).toBe("Composition");
    expect(input.subjective).toEqual({ chiefComplaint: "Cough" });

    const prescriptionRecord = {
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "DRAFT",
        templateId: "tmpl-1",
        templateVersion: 2,
        templateVersionId: "tmpl-ver-1",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Rx summary",
        createdAt: now,
        updatedAt: now,
      },
      prescription: {
        id: "rx-1",
        artifactId: "artifact-2",
        medications: [{ name: "Amoxicillin" }],
        instructions: "BID",
        notes: "after food",
        metadata: { source: "template" },
        createdAt: now,
        updatedAt: now,
      },
    } as PrescriptionRecord;

    const medicationRequest =
      clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
        prescriptionRecord,
      );
    expect(medicationRequest.resourceType).toBe("MedicationRequest");

    const dischargeRecord = {
      artifact: {
        id: "artifact-3",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "DISCHARGE_SUMMARY",
        status: "SIGNED",
        templateId: "tmpl-1",
        templateVersion: 2,
        templateVersionId: "tmpl-ver-1",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Discharge summary",
        createdAt: now,
        updatedAt: now,
      },
      dischargeSummary: {
        id: "ds-1",
        artifactId: "artifact-3",
        summary: { text: "Recovered well" },
        diagnoses: [{ code: "A1" }],
        medications: [{ name: "Supportive care" }],
        followUp: { afterDays: 7 },
        instructions: { text: "Rest" },
        metadata: { source: "template" },
        createdAt: now,
        updatedAt: now,
      },
    } as DischargeSummaryRecord;
    expect(
      clinicalArtifactFhirMapper.dischargeSummaryToComposition(dischargeRecord)
        .resourceType,
    ).toBe("Composition");

    const vitalRecord = {
      artifact: {
        id: "artifact-4",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "VITAL_RECORD",
        status: "IN_PROGRESS",
        templateId: "tmpl-1",
        templateVersion: 2,
        templateVersionId: "tmpl-ver-1",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Vitals",
        createdAt: now,
        updatedAt: now,
      },
      vitalRecord: {
        id: "vital-1",
        artifactId: "artifact-4",
        measuredAt: now,
        recordedBy: "nurse-1",
        vitals: { temperature: 39.1, pulse: 120 },
        notes: "stable",
        metadata: { source: "template" },
        createdAt: now,
        updatedAt: now,
      },
    } as VitalRecordRecord;

    expect(
      clinicalArtifactFhirMapper.vitalRecordToObservation(vitalRecord)
        .resourceType,
    ).toBe("Observation");
  });

  it("maps task schedules through the shared package", () => {
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
    } as TaskScheduleLike;

    const resource = taskScheduleFhirMapper.toTask(schedule);

    expect(resource.resourceType).toBe("Task");
    expect(resource.output).toHaveLength(2);
    expect(
      taskScheduleFhirMapper.getBooleanParameter(
        {
          resourceType: "Parameters",
          parameter: [{ name: "force", valueBoolean: true }],
        },
        "force",
      ),
    ).toBe(true);
  });
});
