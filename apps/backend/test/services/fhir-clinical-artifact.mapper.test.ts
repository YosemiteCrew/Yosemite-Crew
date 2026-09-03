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
      patientId: "companion-1",
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
      patientId: "companion-1",
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

  it("exports the ATCvet coding a coded prescription line carries", () => {
    // The mapper previously hardcoded a 'PRESCRIPTION' concept, so a coded
    // prescription left the system uncoded no matter what the client sent.
    const coded = {
      ...prescriptionRecord,
      prescription: {
        ...prescriptionRecord.prescription,
        medications: [
          {
            medication: "doxycycline",
            metadata: { atcCode: "QJ01AA02" },
          },
        ],
      },
    };

    const resource =
      clinicalArtifactFhirMapper.prescriptionToMedicationRequest(coded);

    expect(resource.medicationCodeableConcept?.coding).toEqual([
      {
        system: "http://www.whocc.no/atcvet",
        code: "QJ01AA02",
        display: "doxycycline",
      },
    ]);
    expect(resource.medicationCodeableConcept?.text).toBe("doxycycline");
  });

  it("keeps the generic concept when no line carries a code", () => {
    const resource =
      clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
        prescriptionRecord,
      );
    // An uncoded prescription must not gain an invented coding.
    expect(
      resource.medicationCodeableConcept?.coding?.some(
        (coding) => coding.system === "http://www.whocc.no/atcvet",
      ),
    ).toBeFalsy();
  });

  it("maps prescriptions to and from MedicationRequest", () => {
    const resource =
      clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
        prescriptionRecord,
      );
    expect(resource.resourceType).toBe("MedicationRequest");
    expect(resource.id).toBe("artifact-2");
    expect(resource.subject.reference).toBe("Patient/companion-1");
    expect(resource.encounter?.reference).toBe("Encounter/enc-1");
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
          patientId: null,
        },
      },
    );
    // An IN_PROGRESS prescription serialises to FHIR status 'accepted'...
    expect(resource.status).toBe("accepted");
    expect(resource.subject).toEqual({ display: "Unknown patient" });

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
    expect(resource.subject?.reference).toBe("Patient/companion-1");
    expect(resource.encounter?.reference).toBe("Encounter/enc-1");
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
      patientId: string | null;
      authorId: string | null;
      signedBy: string | null;
      signedAt: Date | null;
      summary: string | null;
    }> = {},
  ) => ({
    id: `artifact-${kind}`,
    organisationId: "org-1",
    appointmentId: "appt-1",
    caseId: null,
    encounterId: "enc-1",
    patientId: "companion-1",
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
      patientId: null,
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
    expect(resource.patient.reference).toBe("Patient/companion-1");
    expect(resource.encounter?.reference).toBe("Encounter/enc-1");
    expect(resource.occurrenceDateTime).toBe(now.toISOString());
    expect(resource).not.toHaveProperty("occurrenceString");
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
    expect(resource.patient).toEqual({ display: "Unknown patient" });
    expect(resource.encounter).toBeUndefined();
  });

  it.each(["DRAFT", "IN_PROGRESS"] as const)(
    "maps an unattested %s immunization to not-done instead of completed",
    (status) => {
      const resource = clinicalArtifactFhirMapper.immunizationToImmunization({
        ...immunizationFull,
        artifact: artifact("IMMUNIZATION", { status }),
      });
      expect(resource.status).toBe("not-done");
      expect(
        resource.extension?.find((e) =>
          e.url.includes("clinical-artifact-status"),
        )?.valueString,
      ).toBe(status);
    },
  );

  it("maps a completed immunization to completed", () => {
    const resource = clinicalArtifactFhirMapper.immunizationToImmunization({
      ...immunizationFull,
      artifact: artifact("IMMUNIZATION", { status: "COMPLETED" }),
    });
    expect(resource.status).toBe("completed");
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
    expect(adequate.subject?.reference).toBe("Patient/companion-1");
    expect(adequate.encounter?.reference).toBe("Encounter/enc-1");

    const inadequate = clinicalArtifactFhirMapper.rabiesTitrationToObservation({
      artifact: artifact("RABIES_TITRATION", {
        status: "DRAFT",
        patientId: null,
      }),
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
    expect(inadequate.subject).toBeUndefined();
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
    expect(full.subject.reference).toBe("Patient/companion-1");
    expect(full.encounter?.reference).toBe("Encounter/enc-1");

    const bare = clinicalArtifactFhirMapper.parasiteTreatmentToProcedure({
      artifact: artifact("PARASITE_TREATMENT", {
        status: "IN_PROGRESS",
        authorId: null,
        encounterId: null,
        appointmentId: null,
        patientId: null,
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
    expect(bare.subject).toEqual({ display: "Unknown patient" });
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

  const examBody = {
    id: "exam-attest",
    artifactId: "artifact-CLINICAL_EXAM",
    examinedAt: now,
    fitForTravel: true,
    findings: "BAR",
    weightKg: null,
    temperatureC: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  it("attests signed compositions with the signatory, not the capture author", () => {
    const signedAt = new Date("2026-02-02T10:30:00.000Z");

    // A nurse captured the exam; a different veterinarian attested it.
    const exam = clinicalArtifactFhirMapper.clinicalExamToComposition({
      artifact: artifact("CLINICAL_EXAM", {
        authorId: "nurse-1",
        signedBy: "vet-2",
        signedAt,
      }),
      clinicalExamination: examBody,
    });
    expect(exam.author?.[0]).toEqual({ reference: "Practitioner/nurse-1" });
    expect(exam.attester).toEqual([
      {
        mode: "legal",
        time: signedAt.toISOString(),
        party: { reference: "Practitioner/vet-2" },
      },
    ]);

    const soap = clinicalArtifactFhirMapper.soapNoteToComposition({
      ...soapRecord,
      artifact: { ...soapRecord.artifact, signedBy: "vet-2", signedAt },
    });
    expect(soap.author?.[0]).toEqual({ reference: "Practitioner/author-1" });
    expect(soap.attester?.[0]?.party?.reference).toBe("Practitioner/vet-2");

    const discharge = clinicalArtifactFhirMapper.dischargeSummaryToComposition({
      ...dischargeRecord,
      artifact: { ...dischargeRecord.artifact, signedBy: "vet-2", signedAt },
    });
    expect(discharge.author?.[0]).toEqual({
      reference: "Practitioner/author-1",
    });
    expect(discharge.attester?.[0]?.party?.reference).toBe(
      "Practitioner/vet-2",
    );
  });

  it("attests without a time when the signature timestamp is missing", () => {
    const exam = clinicalArtifactFhirMapper.clinicalExamToComposition({
      artifact: artifact("CLINICAL_EXAM", {
        signedBy: "vet-2",
        signedAt: null,
      }),
      clinicalExamination: examBody,
    });
    expect(exam.attester).toHaveLength(1);
    expect(exam.attester?.[0]?.mode).toBe("legal");
    expect(exam.attester?.[0]?.time).toBeUndefined();
    expect(exam.attester?.[0]?.party?.reference).toBe("Practitioner/vet-2");
  });

  it("omits attester while an artifact is unsigned", () => {
    expect(
      clinicalArtifactFhirMapper.soapNoteToComposition(soapRecord).attester,
    ).toBeUndefined();
    expect(
      clinicalArtifactFhirMapper.dischargeSummaryToComposition(dischargeRecord)
        .attester,
    ).toBeUndefined();
    expect(
      clinicalArtifactFhirMapper.clinicalExamToComposition({
        artifact: artifact("CLINICAL_EXAM", {
          signedBy: null,
          signedAt: null,
        }),
        clinicalExamination: examBody,
      }).attester,
    ).toBeUndefined();
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

  describe("vital units", () => {
    const observationFor = (vitals: Record<string, unknown>) =>
      clinicalArtifactFhirMapper.vitalRecordToObservation({
        artifact: {
          id: "art-1",
          status: "FINAL",
          patientId: "pat-1",
          organisationId: "org-1",
        },
        vitalRecord: {
          measuredAt: new Date("2026-06-19T16:44:40.796Z"),
          vitals,
          recordedBy: null,
          notes: null,
          metadata: null,
        },
      } as never);

    const componentFor = (vitals: Record<string, unknown>, key: string) =>
      observationFor(vitals).component?.find(
        (c) => c.code?.coding?.[0]?.code === key,
      );

    it("states the unit for tempF, now that only a Fahrenheit template writes it", () => {
      // These two were exported as bare decimals while VitalsForm routed every field
      // labelled "temp" into tempF whatever unit the template declared - stamping
      // [degF] on a Celsius reading would have exported 38.5 as severe hypothermia.
      // The form now picks the key from the declared unit, so the key is trustworthy
      // and the reading can be qualified.
      expect(
        componentFor({ tempF: 101.4 }, "tempF")?.valueQuantity,
      ).toMatchObject({
        unit: "°F",
        code: "[degF]",
      });
    });

    it("states the unit for weightLbs for the same reason", () => {
      expect(
        componentFor({ weightLbs: 12 }, "weightLbs")?.valueQuantity,
      ).toMatchObject({
        unit: "lb",
        code: "[lb_av]",
      });
    });

    it("keeps each scale distinct rather than exporting one as the other", () => {
      // The regression that motivated this: a Celsius reading must never leave the
      // system wearing a Fahrenheit code, in either direction.
      expect(componentFor({ tempC: 38.5 }, "tempC")?.valueQuantity?.code).toBe(
        "Cel",
      );
      expect(componentFor({ tempF: 38.5 }, "tempF")?.valueQuantity?.code).toBe(
        "[degF]",
      );
    });

    it("states the unit where the storage key does determine it", () => {
      expect(
        componentFor({ weightKg: 12 }, "weightKg")?.valueQuantity,
      ).toMatchObject({
        unit: "kg",
        code: "kg",
      });
      expect(
        componentFor({ tempC: 38.5 }, "tempC")?.valueQuantity,
      ).toMatchObject({
        unit: "°C",
        code: "Cel",
      });
      expect(
        componentFor({ heartRateBpm: 120 }, "heartRateBpm")?.valueQuantity,
      ).toMatchObject({ code: "/min" });
    });

    it("qualifies CRT even though the form stores it as a string", () => {
      // draft.crtSec is a string, so a numeric-only branch skipped it and left a known
      // clinical vital unqualified - the exact gap this change set out to close.
      const quantity = componentFor({ crtSec: "2" }, "crtSec")?.valueQuantity;

      expect(quantity).toMatchObject({
        value: 2,
        unit: "s",
        code: "s",
      });
      // A plain reading is not bounded, so it must not pick up a comparator.
      expect(quantity).not.toHaveProperty("comparator");
    });

    it("keeps the seconds unit when CRT is stored as comparator notation", () => {
      // The CRT field is inputMode 'text' with no bounds, and "<2" is what this repo's
      // own VitalsForm and QuickActionsModal stories store, because that is how the
      // reading is taken. Parsing only bare digits dropped it to a unitless valueString,
      // losing the seconds and the bound together. FHIR carries this in
      // Quantity.comparator.
      expect(
        componentFor({ crtSec: "<2" }, "crtSec")?.valueQuantity,
      ).toMatchObject({
        value: 2,
        comparator: "<",
        unit: "s",
        system: "http://unitsofmeasure.org",
        code: "s",
      });
      expect(
        componentFor({ crtSec: ">= 3.5" }, "crtSec")?.valueQuantity,
      ).toMatchObject({ value: 3.5, comparator: ">=", code: "s" });
    });

    it("keeps CRT prose that is not a comparator reading as a string", () => {
      // A bare comparator has no magnitude to qualify, and "brisk" is not a number at
      // all. Neither may be coerced into a quantity the record never carried.
      expect(componentFor({ crtSec: "<" }, "crtSec")).toMatchObject({
        valueString: "<",
      });
      expect(componentFor({ crtSec: "brisk" }, "crtSec")).toMatchObject({
        valueString: "brisk",
      });
    });

    it("does not treat an inherited property name as a known vital", () => {
      // Reachable through the passthrough Observation endpoint: a lookup of
      // "constructor" finds a function on the prototype, which is truthy, and would
      // emit a valueQuantity carrying the UCUM system with no unit and no code.
      const component = componentFor({ constructor: 5 }, "constructor");

      expect(component).toMatchObject({ valueDecimal: 5 });
      expect(component).not.toHaveProperty("valueQuantity");
    });

    it("leaves a non-numeric string vital alone", () => {
      expect(componentFor({ crtSec: "not a number" }, "crtSec")).toMatchObject({
        valueString: "not a number",
      });
    });

    it("annotates a dimensionless score rather than leaving it bare", () => {
      expect(componentFor({ bcs: 5 }, "bcs")?.valueQuantity).toMatchObject({
        code: "{score}",
      });
    });

    it("leaves an unrecognised numeric vital without a guessed unit", () => {
      // A wrong unit is worse than an absent one: it would be silently converted.
      const component = componentFor({ somethingNew: 7 }, "somethingNew");
      expect(component).toMatchObject({ valueDecimal: 7 });
      expect(component).not.toHaveProperty("valueQuantity");
    });

    it("still carries non-numeric vitals through unchanged", () => {
      expect(
        componentFor({ mucousMembrane: "pink" }, "mucousMembrane"),
      ).toMatchObject({
        valueString: "pink",
      });
    });
  });
});
