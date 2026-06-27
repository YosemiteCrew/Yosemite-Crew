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
      recordedByDisplay: "Nurse Joy",
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

    expect(input.status).toBe("COMPLETED");
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
          status: "active",
          subject: { reference: "Encounter/enc-1" },
          extension: resource.extension,
        },
        { organisationId: "org-1" },
      );

    expect(input.status).toBe("COMPLETED");
    expect(input.medications).toEqual([{ name: "Amoxicillin" }]);
    expect(input.notes).toBe("after food");
  });

  it("round-trips an in-progress prescription without downgrading to DRAFT", () => {
    const resource = clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
      {
        ...prescriptionRecord,
        artifact: {
          ...prescriptionRecord.artifact,
          status: "IN_PROGRESS" as const,
        },
      },
    );
    // An IN_PROGRESS prescription serialises to FHIR status 'accepted'...
    expect(resource.status).toBe("accepted");

    const input =
      clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(
        resource,
        {
          organisationId: "org-1",
        },
      );

    // ...and must map back to IN_PROGRESS, not fall through to DRAFT.
    expect(input.status).toBe("IN_PROGRESS");
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

    expect(input.status).toBe("COMPLETED");
    expect(input.summaryContent).toEqual({ text: "Recovered well" });
    expect(input.followUp).toEqual({ afterDays: 7 });
  });

  it("maps vital records to and from Observation", () => {
    const resource =
      clinicalArtifactFhirMapper.vitalRecordToObservation(vitalRecord);
    expect(resource.resourceType).toBe("Observation");
    expect(resource.id).toBe("artifact-4");
    expect(resource.component).toHaveLength(2);
    expect(resource.performer?.[0]).toEqual({
      reference: "Practitioner/nurse-1",
      display: "Nurse Joy",
    });
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
        performer: [
          {
            reference: "Practitioner/nurse-1",
            display: "Nurse Joy",
          },
        ],
        extension: resource.extension,
      },
      { organisationId: "org-1", recordedBy: "nurse-1" },
    );

    expect(input.status).toBe("COMPLETED");
    expect(input.vitals).toEqual({ temperature: 39.1, pulse: 120 });
    expect(input.recordedBy).toBe("nurse-1");
    expect(input.recordedByDisplay).toBe("Nurse Joy");
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

  const artifact = <
    K extends
      | "IMMUNIZATION"
      | "RABIES_TITRATION"
      | "PARASITE_TREATMENT"
      | "CLINICAL_EXAM",
  >(
    kind: K,
    overrides: Partial<{
      status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "SIGNED" | "VOID";
      encounterId: string | null;
      appointmentId: string | null;
      authorId: string | null;
      summary: string | null;
    }> = {},
  ) => ({
    id: `artifact-${kind}`,
    organisationId: "org-1",
    appointmentId: "appt-1",
    caseId: null,
    encounterId: "enc-1",
    kind,
    status: "SIGNED" as const,
    templateId: null,
    templateVersion: null,
    templateVersionId: null,
    authorId: "vet-1",
    signedBy: "vet-1",
    signedAt: now,
    summary: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const immunizationFull = {
    artifact: artifact("IMMUNIZATION"),
    immunization: {
      id: "imm-1",
      artifactId: "artifact-IMMUNIZATION",
      vaccineType: "RABIES",
      vaccineName: "Nobivac Rabies",
      manufacturer: "MSD",
      batchNumber: "A234B",
      lotNumber: "LOT9",
      dateAdministered: now,
      validFrom: now,
      validUntil: now,
      nextDueDate: now,
      site: "left shoulder",
      route: "subcutaneous",
      notes: "no reaction",
      metadata: { source: "encounter" },
      createdAt: now,
      updatedAt: now,
    },
  };

  const immunizationBare = {
    artifact: artifact("IMMUNIZATION", {
      status: "VOID",
      encounterId: null,
      appointmentId: null,
    }),
    immunization: {
      ...immunizationFull.immunization,
      manufacturer: null,
      batchNumber: null,
      lotNumber: null,
      validFrom: null,
      validUntil: null,
      nextDueDate: null,
      site: null,
      route: null,
      notes: null,
      metadata: null,
    },
  };

  it("maps an administered immunization to a FHIR Immunization", () => {
    const resource =
      clinicalArtifactFhirMapper.immunizationToImmunization(immunizationFull);
    expect(resource.resourceType).toBe("Immunization");
    expect(resource.status).toBe("completed");
    expect(resource.primarySource).toBe(true);
    expect(resource.lotNumber).toBe("LOT9");
    expect(resource.patient.reference).toBe("Encounter/enc-1");
    expect(resource.vaccineCode.text).toBe("Nobivac Rabies");
    expect(
      resource.extension?.some((e) =>
        e.url.includes("immunization-valid-until"),
      ),
    ).toBe(true);
  });

  it("maps a voided, uploaded immunization (no encounter) with fallbacks", () => {
    const resource =
      clinicalArtifactFhirMapper.immunizationToImmunization(immunizationBare);
    expect(resource.status).toBe("entered-in-error");
    expect(resource.primarySource).toBe(false);
    expect(resource.lotNumber).toBeUndefined();
    expect(resource.manufacturer).toBeUndefined();
    expect(resource.site).toBeUndefined();
    expect(resource.patient.reference).toBe(
      "Immunization/artifact-IMMUNIZATION",
    );
    expect(resource.encounter).toBeUndefined();
  });

  it("maps a rabies titration to an Observation, flagging adequacy", () => {
    const adequate = clinicalArtifactFhirMapper.rabiesTitrationToObservation({
      artifact: artifact("RABIES_TITRATION"),
      rabiesTitration: {
        id: "tit-1",
        artifactId: "artifact-RABIES_TITRATION",
        approvedLab: "APHA Weybridge",
        sampleDate: now,
        resultIuMl: 1.8,
        reportUrl: "https://example.test/report.pdf",
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(adequate.resourceType).toBe("Observation");
    expect(adequate.valueQuantity?.value).toBe(1.8);
    expect(adequate.interpretation?.[0]?.coding?.[0]?.code).toBe("ADEQUATE");
    expect(adequate.performer?.[0]).toEqual({ display: "APHA Weybridge" });

    const inadequate = clinicalArtifactFhirMapper.rabiesTitrationToObservation({
      artifact: artifact("RABIES_TITRATION", { status: "DRAFT" }),
      rabiesTitration: {
        id: "tit-2",
        artifactId: "artifact-RABIES_TITRATION",
        approvedLab: "Lab B",
        sampleDate: now,
        resultIuMl: 0.2,
        reportUrl: null,
        metadata: { note: "low" },
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(inadequate.status).toBe("preliminary");
    expect(inadequate.interpretation?.[0]?.coding?.[0]?.code).toBe(
      "INADEQUATE",
    );
  });

  it("maps a parasite treatment to a FHIR Procedure", () => {
    const full = clinicalArtifactFhirMapper.parasiteTreatmentToProcedure({
      artifact: artifact("PARASITE_TREATMENT", { status: "COMPLETED" }),
      parasiteTreatment: {
        id: "par-1",
        artifactId: "artifact-PARASITE_TREATMENT",
        treatmentType: "ECHINOCOCCUS",
        productName: "Milbemax",
        manufacturer: "Elanco",
        treatedAt: now,
        notes: "given orally",
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(full.resourceType).toBe("Procedure");
    expect(full.status).toBe("completed");
    expect(full.code?.text).toBe("Milbemax");
    expect(full.performer?.[0]?.actor.reference).toBe("Practitioner/vet-1");
    expect(full.note?.[0]?.text).toBe("given orally");

    const bare = clinicalArtifactFhirMapper.parasiteTreatmentToProcedure({
      artifact: artifact("PARASITE_TREATMENT", {
        status: "IN_PROGRESS",
        authorId: null,
        encounterId: null,
        appointmentId: null,
      }),
      parasiteTreatment: {
        id: "par-2",
        artifactId: "artifact-PARASITE_TREATMENT",
        treatmentType: "FLEA",
        productName: "Bravecto",
        manufacturer: null,
        treatedAt: now,
        notes: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(bare.status).toBe("in-progress");
    expect(bare.performer).toBeUndefined();
    expect(bare.subject.reference).toBe(
      "Procedure/artifact-PARASITE_TREATMENT",
    );
    expect(bare.note).toBeUndefined();
  });

  it("maps procedure status for voided and default states", () => {
    const base = {
      id: "par-3",
      artifactId: "artifact-PARASITE_TREATMENT",
      treatmentType: "TICK",
      productName: "Seresto",
      manufacturer: null,
      treatedAt: now,
      notes: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(
      clinicalArtifactFhirMapper.parasiteTreatmentToProcedure({
        artifact: artifact("PARASITE_TREATMENT", { status: "VOID" }),
        parasiteTreatment: base,
      }).status,
    ).toBe("entered-in-error");
    expect(
      clinicalArtifactFhirMapper.parasiteTreatmentToProcedure({
        artifact: artifact("PARASITE_TREATMENT", { status: "DRAFT" }),
        parasiteTreatment: base,
      }).status,
    ).toBe("preparation");
  });

  it("maps a clinical exam to a Composition with travel fitness", () => {
    const full = clinicalArtifactFhirMapper.clinicalExamToComposition({
      artifact: artifact("CLINICAL_EXAM", { summary: "Pre-travel check" }),
      clinicalExamination: {
        id: "exam-1",
        artifactId: "artifact-CLINICAL_EXAM",
        examinedAt: now,
        fitForTravel: true,
        findings: "BAR, no abnormalities",
        weightKg: 31.4,
        temperatureC: 38.6,
        metadata: { source: "encounter" },
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(full.resourceType).toBe("Composition");
    expect(full.title).toBe("Pre-travel check");
    expect(full.author?.[0]).toEqual({ reference: "Practitioner/vet-1" });
    const fit = full.extension?.find((e) =>
      e.url.includes("clinical-exam-fit-for-travel"),
    );
    expect(fit?.valueBoolean).toBe(true);
    expect(
      full.extension?.some((e) => e.url.includes("clinical-exam-weight-kg")),
    ).toBe(true);

    const bare = clinicalArtifactFhirMapper.clinicalExamToComposition({
      artifact: artifact("CLINICAL_EXAM", { authorId: null }),
      clinicalExamination: {
        id: "exam-2",
        artifactId: "artifact-CLINICAL_EXAM",
        examinedAt: now,
        fitForTravel: false,
        findings: null,
        weightKg: null,
        temperatureC: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(bare.title).toBe("Clinical examination");
    expect(bare.author?.[0]).toEqual({ display: "System" });
    expect(
      bare.extension?.some((e) => e.url.includes("clinical-exam-weight-kg")),
    ).toBe(false);
  });

  it("builds list bundles for each new passport record kind", () => {
    expect(
      clinicalArtifactFhirMapper.bundles.immunizations([immunizationFull]),
    ).toEqual(expect.objectContaining({ resourceType: "Bundle", total: 1 }));
    expect(
      clinicalArtifactFhirMapper.bundles.rabiesTitrations([
        {
          artifact: artifact("RABIES_TITRATION"),
          rabiesTitration: {
            id: "tit-3",
            artifactId: "artifact-RABIES_TITRATION",
            approvedLab: "Lab",
            sampleDate: now,
            resultIuMl: 0.9,
            reportUrl: null,
            metadata: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]),
    ).toEqual(expect.objectContaining({ total: 1 }));
    expect(
      clinicalArtifactFhirMapper.bundles.parasiteTreatments([
        {
          artifact: artifact("PARASITE_TREATMENT"),
          parasiteTreatment: {
            id: "par-4",
            artifactId: "artifact-PARASITE_TREATMENT",
            treatmentType: "OTHER",
            productName: "X",
            manufacturer: null,
            treatedAt: now,
            notes: null,
            metadata: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]),
    ).toEqual(expect.objectContaining({ total: 1 }));
    expect(
      clinicalArtifactFhirMapper.bundles.clinicalExaminations([
        {
          artifact: artifact("CLINICAL_EXAM"),
          clinicalExamination: {
            id: "exam-3",
            artifactId: "artifact-CLINICAL_EXAM",
            examinedAt: now,
            fitForTravel: true,
            findings: null,
            weightKg: null,
            temperatureC: null,
            metadata: null,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]),
    ).toEqual(expect.objectContaining({ total: 1 }));
  });
});
