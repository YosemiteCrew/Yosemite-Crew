import {
  amendDischargeSummary,
  amendPrescriptionArtifact,
  amendSoapNote,
  amendVitalRecord,
  finalizeDischargeSummary,
  finalizePrescriptionArtifact,
  finalizeSoapNote,
  finalizeVitalRecord,
  getDischargeSummaryArtifact,
  getPrescriptionArtifact,
  getSoapNote,
  getVitalRecord,
  getPmsObservationSubmission,
  getPmsObservationSubmissionByTask,
  getPmsObservationTaskPreview,
  linkPmsObservationSubmissionToAppointment,
  listDischargeSummariesForEncounter,
  listPmsObservationSubmissions,
  listPmsObservationTaskPreviewsForAppointment,
  listPrescriptionsForEncounter,
  listSoapNotesForEncounter,
  listSoapNotesForAppointment,
  listVitalRecordsForAppointment,
  listVitalRecordsForEncounter,
  createPmsObservationSubmission,
  deletePrescriptionArtifact,
  generatePrescriptionLabels,
  getRenderedDocument,
  renderedDocumentToWorkspaceDocument,
  signRenderedDocument,
  listObservationSubmissionsForAppointment,
  loadWorkspaceClinicalArtifacts,
  reopenDischargeSummary,
  reopenPrescriptionArtifact,
  reopenSoapNote,
  reopenVitalRecord,
  saveDischargeSummaryArtifact,
  savePrescriptionArtifact,
  saveSoapNote,
  saveVitalRecord,
} from '@/app/features/appointments/services/workspaceClinicalService';

const postDataMock = jest.fn();
const getDataMock = jest.fn();
const patchDataMock = jest.fn();
const deleteDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  deleteData: (...args: unknown[]) => deleteDataMock(...args),
  getData: (...args: unknown[]) => getDataMock(...args),
  patchData: (...args: unknown[]) => patchDataMock(...args),
  postData: (...args: unknown[]) => postDataMock(...args),
}));

const bundle = (resourceType: string, resource: Record<string, unknown>) => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [{ resource: { resourceType, ...resource } }],
});

describe('workspaceClinicalService', () => {
  beforeEach(() => {
    postDataMock.mockReset();
    getDataMock.mockReset();
    patchDataMock.mockReset();
    deleteDataMock.mockReset();
  });

  it('lists SOAP notes from the clinical artifact FHIR endpoint', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Composition', {
        id: 'soap-1',
        status: 'final',
        date: '2026-04-20T09:00:00.000Z',
        author: [{ display: 'Dr Meredith Grey' }],
        extension: [
          {
            url: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-subjective',
            valueString: '<p>History</p>',
          },
        ],
      }),
    });

    const notes = await listSoapNotesForAppointment('org-1', 'appt-1', {
      encounterId: 'enc-1',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/appointment/appt-1/soap-notes',
      {}
    );
    expect(notes[0]).toEqual(
      expect.objectContaining({
        id: 'soap-1',
        status: 'COMPLETED',
        signedByName: 'Dr Meredith Grey',
      })
    );
  });

  it('uses the current author name when hydrated SOAP notes only contain the author reference', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Composition', {
        id: 'soap-1',
        status: 'final',
        date: '2026-04-20T09:00:00.000Z',
        author: [{ reference: 'Practitioner/user-1' }],
      }),
    });

    const notes = await listSoapNotesForAppointment('org-1', 'appt-1', {
      encounterId: 'enc-1',
      authorId: 'user-1',
      authorName: 'Dr Tim Apple',
    });

    expect(notes[0].signedByName).toBe('Dr Tim Apple');
  });

  it('saves a SOAP note as a FHIR Composition with backend context fields', async () => {
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-2' } });

    await saveSoapNote(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
        authorName: 'Dr Tim Apple',
      },
      {
        id: 'draft',
        chiefComplaint: '',
        subjective: '<p>S</p>',
        objective: '<p>O</p>',
        assessment: '<p>A</p>',
        plan: '<p>P</p>',
        status: 'IN_PROGRESS',
        createdAt: '2026-04-20T09:00:00.000Z',
      }
    );

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note',
      expect.objectContaining({
        resourceType: 'Composition',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
        author: [{ reference: 'Practitioner/user-1', display: 'Dr Tim Apple' }],
      })
    );
  });

  it('sends coded terms through the diagnoses extension, and an empty object when none are picked', async () => {
    postDataMock.mockResolvedValue({ data: { resourceType: 'Composition', id: 'soap-3' } });

    const baseNote = {
      id: 'draft',
      chiefComplaint: '',
      subjective: '<p>S</p>',
      objective: '',
      assessment: '',
      plan: '',
      status: 'IN_PROGRESS' as const,
      createdAt: '2026-04-20T09:00:00.000Z',
    };
    await saveSoapNote(
      { organisationId: 'org-1', appointmentId: 'appt-1' },
      {
        ...baseNote,
        codedProblems: {
          assessment: [{ ycCode: 'YC-000123', label: 'Gastritis', domain: 'Diagnosis' }],
        },
      }
    );
    const [, withTerms] = postDataMock.mock.calls[0] as [
      string,
      { extension: Array<{ url: string; valueString?: string }> },
    ];
    const diagnosesExt = withTerms.extension.find((ext) => ext.url.endsWith('soap-note-diagnoses'));
    expect(diagnosesExt).toBeDefined();
    expect(JSON.parse(diagnosesExt?.valueString ?? '')).toEqual({
      assessment: [{ ycCode: 'YC-000123', label: 'Gastritis', domain: 'Diagnosis' }],
    });

    // No chips: the extension is still present as an explicit empty object so a
    // draft PATCH clears a previously stored set instead of silently keeping it.
    await saveSoapNote({ organisationId: 'org-1', appointmentId: 'appt-1' }, baseNote);
    const [, withoutTerms] = postDataMock.mock.calls[1] as [
      string,
      { extension: Array<{ url: string; valueString?: string }> },
    ];
    const emptyExt = withoutTerms.extension.find((ext) => ext.url.endsWith('soap-note-diagnoses'));
    expect(emptyExt?.valueString).toBe('{}');
  });

  it('rehydrates coded terms from the diagnoses extension and drops malformed payloads', async () => {
    const composition = (id: string, diagnoses: string) => ({
      resourceType: 'Composition',
      id,
      status: 'preliminary',
      date: '2026-04-20T09:00:00.000Z',
      extension: [
        {
          url: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-diagnoses',
          valueString: diagnoses,
        },
      ],
    });
    postDataMock.mockResolvedValueOnce({
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          {
            resource: composition(
              'soap-good',
              JSON.stringify({ plan: [{ ycCode: 'YC-1', label: 'Dental scale' }] })
            ),
          },
          { resource: composition('soap-bad', '"not-an-object"') },
        ],
      },
    });

    const notes = await listSoapNotesForAppointment('org-1', 'appt-1', {});

    expect(notes[0]?.codedProblems).toEqual({
      plan: [{ ycCode: 'YC-1', label: 'Dental scale' }],
    });
    expect(notes[1]?.codedProblems).toBeUndefined();
  });

  it('updates a persisted SOAP note instead of creating a duplicate', async () => {
    patchDataMock.mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-2' } });

    await saveSoapNote(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        id: 'soap-2',
        chiefComplaint: '',
        subjective: '<p>S</p>',
        objective: '<p>O</p>',
        assessment: '<p>A</p>',
        plan: '<p>P</p>',
        status: 'IN_PROGRESS',
        createdAt: '2026-04-20T09:00:00.000Z',
      }
    );

    expect(patchDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-2',
      expect.objectContaining({ resourceType: 'Composition' })
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('still updates a reloaded draft that the UI groups as history', async () => {
    // Every persisted note carries status COMPLETED, because that is how the UI
    // groups the notes history. Reading that as "signed" made this branch
    // unreachable, so each save of a note reloaded after a refresh created a
    // duplicate artifact instead of updating the draft.
    patchDataMock.mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-3' } });

    await saveSoapNote(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        id: 'soap-3',
        chiefComplaint: '',
        subjective: '<p>S</p>',
        objective: '<p>O</p>',
        assessment: '<p>A</p>',
        plan: '<p>P</p>',
        status: 'COMPLETED',
        isFinalized: false,
        createdAt: '2026-04-20T09:00:00.000Z',
      }
    );

    expect(patchDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-3',
      expect.objectContaining({ resourceType: 'Composition' })
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('never PATCHes a finalized note', async () => {
    // A finalized note is immutable; corrections go through the amendment path.
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-4' } });

    await saveSoapNote(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        id: 'soap-4',
        chiefComplaint: '',
        subjective: '<p>S</p>',
        objective: '<p>O</p>',
        assessment: '<p>A</p>',
        plan: '<p>P</p>',
        status: 'COMPLETED',
        isFinalized: true,
        createdAt: '2026-04-20T09:00:00.000Z',
      }
    );

    expect(patchDataMock).not.toHaveBeenCalled();
    expect(postDataMock).toHaveBeenCalled();
  });

  const SOAP_METADATA_URL = 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-metadata';
  const customSchema = [{ id: 'gait', type: 'input' as const, label: 'Gait' }];

  it('persists a custom-template structure override (schema + answers) and full provenance', async () => {
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-c' } });

    await saveSoapNote(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        templateId: 'tpl-custom',
        templateVersion: 2,
        templateVersionId: 'ver-2',
      },
      {
        id: 'draft',
        chiefComplaint: '',
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        status: 'IN_PROGRESS',
        createdAt: '2026-04-20T09:00:00.000Z',
        customSchema,
        customAnswers: { gait: 'normal' },
      }
    );

    const body = postDataMock.mock.calls[0][1] as {
      status?: string;
      templateVersion?: number;
      templateVersionId?: string;
      extension: Array<{ url: string; valueString?: string }>;
    };
    // Saving must create a draft artifact ('preliminary'); only $finalize completes it.
    // Sending 'final' here would finalize on every save.
    expect(body.status).toBe('preliminary');
    expect(body.templateVersion).toBe(2);
    expect(body.templateVersionId).toBe('ver-2');
    const meta = body.extension.find((ext) => ext.url === SOAP_METADATA_URL);
    expect(meta).toBeDefined();
    expect(JSON.parse(meta?.valueString ?? '{}')).toEqual({
      customTemplate: { schema: customSchema, answers: { gait: 'normal' } },
    });
  });

  it('rehydrates a custom-template structure override from the SOAP metadata extension', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Composition', {
        id: 'soap-c',
        status: 'final',
        date: '2026-04-20T09:00:00.000Z',
        extension: [
          {
            url: SOAP_METADATA_URL,
            valueString: JSON.stringify({
              customTemplate: { schema: customSchema, answers: { gait: 'normal' } },
            }),
          },
        ],
      }),
    });

    const notes = await listSoapNotesForAppointment('org-1', 'appt-1', { encounterId: 'enc-1' });
    expect(notes[0].customSchema).toEqual(customSchema);
    expect(notes[0].customAnswers).toEqual({ gait: 'normal' });
  });

  it('loads encounter-scoped SOAP notes and gets a SOAP note by id', async () => {
    postDataMock
      .mockResolvedValueOnce({
        data: bundle('Composition', {
          id: 'soap-enc',
          status: 'final',
          date: '2026-04-20T09:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'soap-enc' } });

    const notes = await listSoapNotesForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    const note = await getSoapNote('org-1', 'soap-enc');

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/clinical-artifact/organisation/org-1/encounter/enc-1/soap-notes',
      {}
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-enc',
      {}
    );
    expect(notes[0].id).toBe('soap-enc');
    expect(note.id).toBe('soap-enc');
  });

  it('calls clinical artifact lifecycle actions for supported artifact families', async () => {
    postDataMock.mockResolvedValue({ data: { id: 'artifact-1' } });

    await finalizeSoapNote('org-1', 'soap-1');
    await reopenSoapNote('org-1', 'soap-1');
    await amendSoapNote('org-1', 'soap-1', { reason: 'Correction' });
    await finalizePrescriptionArtifact('org-1', 'rx-1');
    await reopenPrescriptionArtifact('org-1', 'rx-1');
    await amendPrescriptionArtifact('org-1', 'rx-1', { reason: 'Dose correction' });
    await finalizeDischargeSummary('org-1', 'dc-1');
    await reopenDischargeSummary('org-1', 'dc-1');
    await amendDischargeSummary('org-1', 'dc-1', { reason: 'Follow-up change' });
    await finalizeVitalRecord('org-1', 'vital-1');
    await reopenVitalRecord('org-1', 'vital-1');
    await amendVitalRecord('org-1', 'vital-1', { reason: 'Unit correction' });

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-1/$finalize',
      {}
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-1/$reopen',
      {}
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      3,
      '/fhir/v1/clinical-artifact/organisation/org-1/soap-note/soap-1/$amend',
      { reason: 'Correction' }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      6,
      '/fhir/v1/clinical-artifact/organisation/org-1/prescription/rx-1/$amend',
      { reason: 'Dose correction' }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      9,
      '/fhir/v1/clinical-artifact/organisation/org-1/discharge-summary/dc-1/$amend',
      { reason: 'Follow-up change' }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      12,
      '/fhir/v1/clinical-artifact/organisation/org-1/vital-record/vital-1/$amend',
      { reason: 'Unit correction' }
    );
  });

  it('saves vitals as a FHIR Observation with appointment context', async () => {
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Observation', id: 'vital-1' } });

    await saveVitalRecord(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        weightLbs: 22,
        tempF: 101.2,
        heartRateBpm: 88,
        recordedByName: 'Sarah Mitchell',
        recordedAt: '2026-04-20T09:00:00.000Z',
      }
    );

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/vital-record',
      expect.objectContaining({
        resourceType: 'Observation',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      })
    );
  });

  it('updates a persisted vital record and supports encounter-scoped vital reads', async () => {
    patchDataMock.mockResolvedValueOnce({ data: { resourceType: 'Observation', id: 'vital-1' } });
    postDataMock
      .mockResolvedValueOnce({
        data: bundle('Observation', {
          id: 'vital-enc',
          effectiveDateTime: '2026-04-20T09:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({ data: { resourceType: 'Observation', id: 'vital-enc' } });

    await saveVitalRecord(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        id: 'vital-1',
        code: 'VT-001',
        tempF: 101.2,
        recordedByName: 'Sarah Mitchell',
        recordedAt: '2026-04-20T09:00:00.000Z',
      }
    );
    const vitals = await listVitalRecordsForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    const vital = await getVitalRecord('org-1', 'vital-enc');

    expect(patchDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/vital-record/vital-1',
      expect.objectContaining({ resourceType: 'Observation' })
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/clinical-artifact/organisation/org-1/encounter/enc-1/vital-records',
      {}
    );
    expect(vitals[0].id).toBe('vital-enc');
    expect(vital.id).toBe('vital-enc');
  });

  it('reads the recorder from the Observation performer (display + id)', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Observation', {
        id: 'vital-perf',
        effectiveDateTime: '2026-04-20T09:00:00.000Z',
        performer: [{ reference: 'Practitioner/prac-9', display: 'Dr. Jane Roe' }],
      }),
    });
    const [withName] = await listVitalRecordsForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    expect(withName.recordedByName).toBe('Dr. Jane Roe');
    expect(withName.recordedById).toBe('prac-9');

    postDataMock.mockResolvedValueOnce({
      data: bundle('Observation', {
        id: 'vital-perf-2',
        effectiveDateTime: '2026-04-20T09:00:00.000Z',
        performer: [{ reference: 'Practitioner/prac-7' }],
      }),
    });
    const [idOnly] = await listVitalRecordsForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    // No display on the reference: fall back to the placeholder name but keep the
    // id so the consuming row can resolve it against the team roster.
    expect(idOnly.recordedByName).toBe('Clinician');
    expect(idOnly.recordedById).toBe('prac-7');
  });

  it('always creates (append-only) discharge summaries through clinical artifacts', async () => {
    postDataMock.mockResolvedValue({ data: { resourceType: 'Composition', id: 'dc-1' } });

    await saveDischargeSummaryArtifact(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
      },
      '<p>Go home</p>',
      '2026-04-25T09:00:00.000Z'
    );
    // Even with a persisted id, a saved discharge summary is immutable: saving again POSTs a new
    // record rather than PATCHing the existing one (which the backend rejects as not-found).
    await saveDischargeSummaryArtifact(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        dischargeSummaryId: 'dc-1',
      },
      '<p>Updated</p>'
    );

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/discharge-summary',
      expect.objectContaining({ resourceType: 'Composition', appointmentId: 'appt-1' })
    );
    expect(postDataMock).toHaveBeenCalledTimes(2);
    expect(patchDataMock).not.toHaveBeenCalled();
  });

  it('loads encounter-scoped discharge summaries and gets a discharge summary by id', async () => {
    postDataMock
      .mockResolvedValueOnce({
        data: bundle('Composition', {
          id: 'dc-enc',
          status: 'final',
          date: '2026-04-20T09:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({ data: { resourceType: 'Composition', id: 'dc-enc' } });

    await listDischargeSummariesForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    const summary = await getDischargeSummaryArtifact('org-1', 'dc-enc');

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/clinical-artifact/organisation/org-1/encounter/enc-1/discharge-summaries',
      {}
    );
    expect(summary.id).toBe('dc-enc');
  });

  it('resolves the discharge "Saved by" to the author name, never a raw id', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Composition', {
        id: 'dc-enc',
        status: 'final',
        date: '2026-04-20T09:00:00.000Z',
        author: [{ reference: 'Practitioner/user-1' }],
      }),
    });

    const [summary] = await listDischargeSummariesForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
      authorId: 'user-1',
      authorName: 'Dr Tim Apple',
    });

    expect(summary.dischargeSavedByName).toBe('Dr Tim Apple');
    expect(summary.dischargeSavedByName).not.toBe('user-1');
  });

  it('emits an ATCvet coding on a coded prescription and none on an uncoded one', async () => {
    postDataMock.mockResolvedValue({ data: { resourceType: 'MedicationRequest', id: 'rx-1' } });

    const base = {
      medicineName: 'doxycycline',
      fulfillment: 'PRESCRIPTION_ONLY' as const,
    };
    await savePrescriptionArtifact(
      { organisationId: 'org-1', appointmentId: 'appt-1' },
      { ...base, atcCode: 'QJ01AA02' }
    );
    const [, coded] = postDataMock.mock.calls[0] as [
      string,
      { medicationCodeableConcept?: { text?: string; coding?: Array<Record<string, string>> } },
    ];
    expect(coded.medicationCodeableConcept?.coding).toEqual([
      {
        system: 'http://www.whocc.no/atcvet',
        code: 'QJ01AA02',
        display: 'doxycycline',
      },
    ]);

    // An uncoded prescription carries text only rather than a placeholder coding.
    await savePrescriptionArtifact({ organisationId: 'org-1', appointmentId: 'appt-1' }, base);
    const [, uncoded] = postDataMock.mock.calls[1] as [
      string,
      { medicationCodeableConcept?: { coding?: unknown } },
    ];
    expect(uncoded.medicationCodeableConcept?.coding).toBeUndefined();
  });

  it('saves prescriptions as a FHIR MedicationRequest with appointment context', async () => {
    postDataMock.mockResolvedValueOnce({
      data: { resourceType: 'MedicationRequest', id: 'rx-1' },
    });

    await savePrescriptionArtifact(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        medicineName: 'Gabapentin',
        strength: '100mg',
        dosageForm: 'Capsule',
        route: 'Oral',
        frequency: 'BID (twice daily)',
        durationDays: '7',
        qty: '14',
        fulfillment: 'IN_HOUSE',
        inventoryItemId: 'inv-1',
      }
    );

    const [, body] = postDataMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({
        resourceType: 'MedicationRequest',
        medicationCodeableConcept: { text: 'Gabapentin' },
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      })
    );
    const medicationsExtension = body.extension.find((entry: { url: string }) =>
      entry.url.endsWith('/prescription-medications')
    );
    expect(JSON.parse(medicationsExtension.valueString)).toEqual([
      expect.objectContaining({
        // Flat fields map to the backend's typed columns; strength is no longer clobbered.
        medicineName: 'Gabapentin',
        strength: '100mg',
        route: 'Oral',
        frequency: 'BID (twice daily)',
        durationDays: '7',
        qty: '14',
        inventoryItemId: 'inv-1',
        // Display/unit extras with no backend column ride along under metadata so they round-trip.
        metadata: expect.objectContaining({ dosageForm: 'Capsule', fulfillment: 'IN_HOUSE' }),
      }),
    ]);
  });

  it('updates a persisted prescription artifact instead of creating a duplicate', async () => {
    patchDataMock.mockResolvedValueOnce({
      data: { resourceType: 'MedicationRequest', id: 'rx-1' },
    });

    await savePrescriptionArtifact(
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
      },
      {
        id: 'rx-1',
        medicineName: 'Gabapentin',
        dosage: '100mg',
        frequency: 'BID',
        fulfillment: 'IN_HOUSE',
      }
    );

    expect(patchDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/prescription/rx-1',
      expect.objectContaining({ resourceType: 'MedicationRequest' })
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('surfaces missing prescription records instead of using the legacy delete fallback', async () => {
    const notFound = { response: { status: 404 } };
    deleteDataMock.mockRejectedValueOnce(notFound);

    await expect(deletePrescriptionArtifact('org-1', 'rx-missing')).rejects.toBe(notFound);
    expect(deleteDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/prescription/rx-missing'
    );
  });

  it('returns false only for unavailable prescription delete routes', async () => {
    deleteDataMock.mockRejectedValueOnce({ response: { status: 405 } });

    await expect(deletePrescriptionArtifact('org-1', 'rx-legacy')).resolves.toBe(false);
  });

  it('loads encounter-scoped prescriptions and gets a prescription by id', async () => {
    postDataMock
      .mockResolvedValueOnce({
        data: bundle('MedicationRequest', {
          id: 'rx-enc',
          status: 'active',
          medicationCodeableConcept: { text: 'Gabapentin' },
        }),
      })
      .mockResolvedValueOnce({ data: { resourceType: 'MedicationRequest', id: 'rx-enc' } });

    const prescriptions = await listPrescriptionsForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });
    const prescription = await getPrescriptionArtifact('org-1', 'rx-enc');

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/clinical-artifact/organisation/org-1/encounter/enc-1/prescriptions',
      {}
    );
    expect(prescriptions[0].id).toBe('rx-enc');
    // #1909: a FHIR status of 'active' means the prescription is finalized (COMPLETED/SIGNED).
    expect(prescriptions[0].finalized).toBe(true);
    expect(prescription.id).toBe('rx-enc');
  });

  it('marks a draft-status prescription as not finalized', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('MedicationRequest', {
        id: 'rx-draft',
        status: 'draft',
        medicationCodeableConcept: { text: 'Meloxicam' },
      }),
    });

    const prescriptions = await listPrescriptionsForEncounter('org-1', 'enc-1', {
      appointmentId: 'appt-1',
    });

    // A draft prescription can still be PATCHed, so it must not be flagged finalized.
    expect(prescriptions[0].finalized).toBe(false);
  });

  it('lists observation tool submissions attached to the appointment', async () => {
    postDataMock.mockResolvedValueOnce({
      data: [
        {
          id: 'obs-1',
          toolId: 'fgs',
          toolName: 'Feline grimace scale',
          answers: { posture: 1, painful: true, notes: 'Guarded' },
          score: 2,
          filledByName: 'Pet parent',
          createdAt: '2026-04-20T09:15:00.000Z',
        },
      ],
    });

    const observations = await listObservationSubmissionsForAppointment('appt-1');

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/observation-tools/pms/appointments/appt-1/submissions',
      {}
    );
    expect(observations[0]).toEqual(
      expect.objectContaining({
        id: 'obs-1',
        toolName: 'Feline grimace scale',
        scores: { posture: 1, painful: 'Yes', notes: 'Guarded' },
        total: 2,
      })
    );
  });

  it('creates a clinician observation submission and maps the backend-scored result', async () => {
    postDataMock.mockResolvedValueOnce({
      data: {
        id: 'obs-new',
        toolId: 'CSU_CAP',
        toolName: 'Canine acute pain scale',
        answers: { posture: 2 },
        score: 4,
        filledByName: 'Dr Vet',
        createdAt: '2026-06-22T10:00:00.000Z',
      },
    });

    const record = await createPmsObservationSubmission({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      companionId: 'comp-9',
      toolId: 'CSU_CAP',
      filledBy: 'vet-1',
      answers: {},
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/observation-tools/pms/appointments/appt-1/submissions/create',
      expect.objectContaining({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        companionId: 'comp-9',
        toolId: 'CSU_CAP',
        filledBy: 'vet-1',
        answers: {},
      })
    );
    // The backend score is authoritative — we never derive it on the client.
    expect(record).toEqual(
      expect.objectContaining({ id: 'obs-new', toolKey: 'CSU_CAP', total: 4 })
    );
  });

  it('wraps PMS observation submission list, detail, link, and task preview routes', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [{ id: 'obs-1' }] })
      .mockResolvedValueOnce({ data: { id: 'obs-1' } })
      .mockResolvedValueOnce({ data: { id: 'obs-task' } })
      .mockResolvedValueOnce({
        data: { taskId: 'task-1', toolId: 'fgs', toolName: 'FGS', toolCategory: 'PAIN' },
      })
      .mockResolvedValueOnce({
        data: [{ taskId: 'task-1', toolId: 'fgs', toolName: 'FGS', toolCategory: 'PAIN' }],
      });
    postDataMock.mockResolvedValueOnce({
      data: { id: 'obs-1', evaluationAppointmentId: 'appt-1' },
    });

    await listPmsObservationSubmissions({
      companionId: 'comp-1',
      toolId: 'fgs',
      fromDate: new Date('2026-04-20T00:00:00.000Z'),
    });
    await getPmsObservationSubmission('obs-1');
    await linkPmsObservationSubmissionToAppointment('obs-1', 'appt-1', true);
    await getPmsObservationSubmissionByTask('task-1');
    await getPmsObservationTaskPreview('task-1');
    await listPmsObservationTaskPreviewsForAppointment('appt-1');

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/observation-tools/pms/submissions', {
      patientId: 'comp-1',
      toolId: 'fgs',
      fromDate: '2026-04-20T00:00:00.000Z',
      toDate: undefined,
    });
    expect(getDataMock).toHaveBeenNthCalledWith(2, '/v1/observation-tools/pms/submissions/obs-1');
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/observation-tools/pms/submissions/obs-1/link-appointment',
      { appointmentId: 'appt-1', enforceSingle: true }
    );
    expect(getDataMock).toHaveBeenNthCalledWith(
      3,
      '/v1/observation-tools/pms/tasks/task-1/submission'
    );
    expect(getDataMock).toHaveBeenNthCalledWith(
      4,
      '/v1/observation-tools/pms/tasks/task-1/preview'
    );
    expect(getDataMock).toHaveBeenNthCalledWith(
      5,
      '/v1/observation-tools/pms/appointments/appt-1/task-previews'
    );
  });

  it('hydrates available workspace sections even when another endpoint fails', async () => {
    postDataMock
      .mockResolvedValueOnce({
        data: bundle('Composition', {
          id: 'soap-1',
          status: 'final',
          date: '2026-04-20T09:00:00.000Z',
          author: [{ reference: 'Practitioner/user-1' }],
        }),
      })
      .mockRejectedValueOnce(new Error('vitals unavailable'))
      .mockResolvedValueOnce({
        data: [
          {
            id: 'obs-1',
            toolId: 'fgs',
            toolName: 'Feline grimace scale',
            answers: { posture: 1 },
            createdAt: '2026-04-20T09:15:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: bundle('MedicationRequest', { id: 'rx-1', status: 'active' }),
      })
      .mockResolvedValueOnce({
        data: bundle('Composition', {
          id: 'dc-1',
          status: 'final',
          date: '2026-04-20T10:00:00.000Z',
          author: [{ display: 'Dr A' }],
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-content',
              valueString: '<p>Stable for home care</p>',
            },
          ],
        }),
      });

    const hydrated = await loadWorkspaceClinicalArtifacts({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      authorId: 'user-1',
      authorName: 'Dr Tim Apple',
    });

    expect(hydrated.soap?.[0].id).toBe('soap-1');
    expect(hydrated.soap?.[0].signedByName).toBe('Dr Tim Apple');
    expect(hydrated.observations?.[0].id).toBe('obs-1');
    expect(hydrated.prescription?.[0].id).toBe('rx-1');
    expect(hydrated.dischargeSummary).toBe('<p>Stable for home care</p>');
    expect(hydrated.dischargeSummaryId).toBe('dc-1');
    expect(hydrated.dischargeSavedAt).toBe('2026-04-20T10:00:00.000Z');
    expect(hydrated.dischargeSavedByName).toBe('Dr A');
    expect(hydrated.vitals).toBeUndefined();
  });

  it('lists vital records for an appointment via the appointment-scoped endpoint', async () => {
    postDataMock.mockResolvedValueOnce({
      data: bundle('Observation', {
        id: 'vital-1',
        effectiveDateTime: '2026-04-20T09:00:00.000Z',
      }),
    });

    const records = await listVitalRecordsForAppointment('org-1', 'appt-1', {
      authorId: 'user-1',
      authorName: 'Dr A',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/appointment/appt-1/vital-records',
      {}
    );
    expect(records[0].id).toBe('vital-1');
  });

  it('cancels a finalized prescription when DELETE returns 409', async () => {
    deleteDataMock.mockRejectedValueOnce({ response: { status: 409 } });
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'MedicationRequest' } });

    const removed = await deletePrescriptionArtifact('org-1', 'rx-1');

    expect(removed).toBe(true);
    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/clinical-artifact/organisation/org-1/prescription/rx-1/$cancel',
      {}
    );
  });

  it('resolves prescription label URLs from either response key', async () => {
    postDataMock.mockResolvedValueOnce({ data: { url: 'https://cdn/label.pdf' } });
    await expect(generatePrescriptionLabels('org-1', 'rx-1')).resolves.toBe(
      'https://cdn/label.pdf'
    );

    postDataMock.mockResolvedValueOnce({ data: { pdfUrl: 'https://cdn/fallback.pdf' } });
    await expect(generatePrescriptionLabels('org-1', 'rx-1')).resolves.toBe(
      'https://cdn/fallback.pdf'
    );

    postDataMock.mockResolvedValueOnce({ data: undefined });
    await expect(generatePrescriptionLabels('org-1', 'rx-1')).resolves.toBeUndefined();
  });

  it('maps object-id observation submissions to workspace records', async () => {
    postDataMock.mockResolvedValueOnce({
      data: [
        {
          _id: { toString: () => 'obj-1' },
          toolCategory: 'PAIN',
          answers: { mobility: 3, notes: 'ok', flagged: true, meta: { deep: true } },
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });

    const records = await listObservationSubmissionsForAppointment('appt-1');

    expect(records[0].id).toBe('obj-1');
    expect(records[0].scores).toMatchObject({ mobility: 3, notes: 'ok' });
  });

  it('fetches and signs rendered documents', async () => {
    getDataMock.mockResolvedValueOnce({ data: { id: 'rd-1', status: 'DRAFT' } });
    const doc = await getRenderedDocument('org-1', 'rd-1');
    expect(getDataMock).toHaveBeenCalledWith('/fhir/v1/rendered-document/organisation/org-1/rd-1');
    expect(doc).toEqual({ id: 'rd-1', status: 'DRAFT' });

    postDataMock.mockResolvedValueOnce({ data: { documentId: 'rd-1', signingUrl: 'https://sig' } });
    const signed = await signRenderedDocument('org-1', 'rd-1', 'Dr A');
    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/rendered-document/organisation/org-1/rd-1/sign',
      { signatureText: 'Dr A' }
    );
    expect(signed.signingUrl).toBe('https://sig');
  });

  it('maps rendered documents onto workspace documents with category and signing fallbacks', () => {
    const discharge = renderedDocumentToWorkspaceDocument({
      id: 'rd-1',
      kind: 'DISCHARGE_SUMMARY',
      title: 'Discharge summary',
      status: 'SIGNED',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: '2026-04-02T00:00:00.000Z',
      signedBy: 'Dr A',
      pdfUrl: 'https://cdn/doc.pdf',
      signing: { required: true, status: 'COMPLETED' },
    } as never);

    expect(discharge).toMatchObject({
      id: 'rd-1',
      category: 'Discharge',
      createdAt: '2026-04-01T00:00:00.000Z',
      lastModifiedAt: '2026-04-02T00:00:00.000Z',
      signedByName: 'Dr A',
      signatureRequired: true,
      signingStatus: 'COMPLETED',
      pdfUrl: 'https://cdn/doc.pdf',
    });

    const soap = renderedDocumentToWorkspaceDocument({
      id: 'rd-2',
      kind: 'SOAP_NOTE',
      title: 'SOAP',
      status: 'DRAFT',
      signedBy: null,
      signing: null,
    } as never);

    expect(soap.category).toBe('SOAP');
    expect(soap.signedByName).toBeUndefined();
    // No signing contract: falls back to "unsigned documents still need signing".
    expect(soap.signatureRequired).toBe(true);
    expect(soap.pdfUrl).toBeNull();
    expect(typeof soap.createdAt).toBe('string');
  });
});
