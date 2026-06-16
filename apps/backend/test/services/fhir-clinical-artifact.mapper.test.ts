import { clinicalArtifactFhirMapper } from "../../src/services/fhir-clinical-artifact.mapper";

describe("clinicalArtifactFhirMapper", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  const soapRecord = {
    artifact: {
      id: "artifact-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      kind: "SOAP_NOTE" as const,
      status: "SIGNED" as const,
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
  };

  const prescriptionRecord = {
    artifact: {
      id: "artifact-2",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      kind: "PRESCRIPTION" as const,
      status: "DRAFT" as const,
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
  };

  const dischargeRecord = {
    artifact: {
      id: "artifact-3",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      kind: "DISCHARGE_SUMMARY" as const,
      status: "SIGNED" as const,
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
  };

  const vitalRecord = {
    artifact: {
      id: "artifact-4",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      kind: "VITAL_RECORD" as const,
      status: "IN_PROGRESS" as const,
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
  };

  it("maps SOAP notes to and from Composition", () => {
    const resource =
      clinicalArtifactFhirMapper.soapNoteToComposition(soapRecord);
    expect(resource.resourceType).toBe("Composition");
    expect(resource.id).toBe("artifact-1");
    expect(
      resource.extension?.some((extension) =>
        extension.url.includes("soap-note-subjective"),
      ),
    ).toBe(true);

    const input = clinicalArtifactFhirMapper.compositionToSoapNoteInput(
      {
        resourceType: "Composition",
        title: "SOAP summary",
        extension: resource.extension,
        status: "final",
        type: { text: "SOAP note" },
        date: now.toISOString(),
        author: [{ reference: "Practitioner/author-1" }],
      },
      { organisationId: "org-1" },
    );

    expect(input.subjective).toEqual({ chiefComplaint: "Cough" });
    expect(input.assessment).toEqual({ diagnosis: "Flu" });
  });

  it("maps prescriptions to and from MedicationRequest", () => {
    const resource =
      clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
        prescriptionRecord,
      );
    expect(resource.resourceType).toBe("MedicationRequest");
    expect(resource.id).toBe("artifact-2");
    expect(
      resource.extension?.some((extension) =>
        extension.url.includes("prescription-medications"),
      ),
    ).toBe(true);

    const input =
      clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(
        {
          resourceType: "MedicationRequest",
          medicationCodeableConcept: { text: "Rx summary" },
          medicationReference: { reference: "MedicationRequest/artifact-2" },
          intent: "order",
          status: "draft",
          subject: { reference: "Encounter/enc-1" },
          extension: resource.extension,
        },
        { organisationId: "org-1" },
      );

    expect(input.medications).toEqual([{ name: "Amoxicillin" }]);
    expect(input.notes).toBe("after food");
  });

  it("maps discharge summaries to and from Composition", () => {
    const resource =
      clinicalArtifactFhirMapper.dischargeSummaryToComposition(dischargeRecord);
    expect(resource.resourceType).toBe("Composition");
    expect(resource.id).toBe("artifact-3");
    expect(
      resource.extension?.some((extension) =>
        extension.url.includes("discharge-summary-content"),
      ),
    ).toBe(true);

    const input = clinicalArtifactFhirMapper.compositionToDischargeSummaryInput(
      {
        resourceType: "Composition",
        title: "Discharge summary",
        extension: resource.extension,
        status: "final",
        type: { text: "Discharge summary" },
        date: now.toISOString(),
        author: [{ reference: "Practitioner/author-1" }],
      },
      { organisationId: "org-1" },
    );

    expect(input.summaryContent).toEqual({ text: "Recovered well" });
    expect(input.followUp).toEqual({ afterDays: 7 });
  });

  it("maps vital records to and from Observation", () => {
    const resource =
      clinicalArtifactFhirMapper.vitalRecordToObservation(vitalRecord);
    expect(resource.resourceType).toBe("Observation");
    expect(resource.id).toBe("artifact-4");
    expect(resource.component).toHaveLength(2);
    expect(
      resource.extension?.some((extension) =>
        extension.url.includes("vital-record-vitals"),
      ),
    ).toBe(true);

    const input = clinicalArtifactFhirMapper.observationToVitalRecordInput(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Vitals" },
        effectiveDateTime: now.toISOString(),
        extension: resource.extension,
      },
      { organisationId: "org-1", recordedBy: "nurse-1" },
    );

    expect(input.vitals).toEqual({ temperature: 39.1, pulse: 120 });
    expect(input.recordedBy).toBe("nurse-1");
  });

  it("builds list bundles for each clinical record kind", () => {
    expect(clinicalArtifactFhirMapper.bundles.soapNotes([soapRecord])).toEqual(
      expect.objectContaining({
        resourceType: "Bundle",
        total: 1,
      }),
    );
    expect(
      clinicalArtifactFhirMapper.bundles.prescriptions([prescriptionRecord]),
    ).toEqual(expect.objectContaining({ total: 1 }));
    expect(
      clinicalArtifactFhirMapper.bundles.dischargeSummaries([dischargeRecord]),
    ).toEqual(expect.objectContaining({ total: 1 }));
    expect(
      clinicalArtifactFhirMapper.bundles.vitalRecords([vitalRecord]),
    ).toEqual(expect.objectContaining({ total: 1 }));
  });
});
