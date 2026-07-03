import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

const APPT = 'appt-1';
const getStore = () => useAppointmentWorkspaceStore.getState();

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seed = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  getStore().initEncounter(APPT, mode);
};

describe('appointmentWorkspaceStore', () => {
  beforeEach(reset);

  it('initialises an empty encounter once', () => {
    seed();
    const first = getStore().getEncounter(APPT);
    expect(first?.appointmentId).toBe(APPT);
    expect(first?.mode).toBe('OUTPATIENT');
    // Re-init does not overwrite the existing encounter.
    getStore().initEncounter(APPT, 'INPATIENT');
    expect(getStore().getEncounter(APPT)?.mode).toBe('OUTPATIENT');
  });

  it('initialises inpatient mode without seeded schedule or placeholder room', () => {
    seed('INPATIENT');
    const enc = getStore().getEncounter(APPT);
    expect(enc?.schedule).toHaveLength(0);
    expect(enc?.roomId).toBeUndefined();
  });

  it('temporarily switches encounter mode without clearing clinical workspace data', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>preserved</p>' });

    getStore().setEncounterMode(APPT, 'INPATIENT');
    let enc = getStore().getEncounter(APPT)!;
    expect(enc.mode).toBe('INPATIENT');
    expect(enc.consultationType).toBe('Inpatient');
    expect(enc.schedule).toHaveLength(0);
    expect(enc.roomId).toBeUndefined();
    expect(enc.soap[0].subjective).toBe('<p>preserved</p>');

    getStore().setEncounterMode(APPT, 'OUTPATIENT');
    enc = getStore().getEncounter(APPT)!;
    expect(enc.mode).toBe('OUTPATIENT');
    expect(enc.consultationType).toBe('Outpatient');
    expect(enc.schedule).toHaveLength(0);
    expect(enc.roomId).toBeUndefined();
    expect(enc.unitId).toBeUndefined();
    expect(enc.soap[0].subjective).toBe('<p>preserved</p>');
  });

  it('navigates steps and side actions', () => {
    getStore().setActiveStep('TREATMENT');
    expect(getStore().activeStep).toBe('TREATMENT');
    getStore().setActiveSideAction('TASKS');
    expect(getStore().activeSideAction).toBe('TASKS');
  });

  it('sets lead, nurse and room/unit', () => {
    seed();
    getStore().setLead(APPT, 'u1', 'Dr A');
    getStore().setNurse(APPT, 'u2', 'Nurse B');
    getStore().setRoomUnit(APPT, 'r1', 'unit-3');
    const enc = getStore().getEncounter(APPT);
    expect(enc?.leadName).toBe('Dr A');
    expect(enc?.nurseName).toBe('Nurse B');
    expect(enc?.roomId).toBe('r1');
    expect(enc?.unitId).toBe('unit-3');
  });

  it('merges backend clinical data without clearing local fallback sections', () => {
    seed();
    getStore().addVitals(APPT, { weightLbs: 55, recordedByName: 'Sarah', recordedAt: 'now' });

    getStore().mergeEncounterData(APPT, {
      soap: [
        {
          id: 'soap-backend',
          chiefComplaint: '',
          subjective: '<p>backend</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED',
          createdAt: '2026-04-20T09:00:00.000Z',
        },
      ],
      observations: [
        {
          id: 'obs-backend',
          code: 'OT-001',
          toolKey: 'fgs',
          toolName: 'Feline grimace scale',
          scores: { posture: 1 },
          total: 1,
          recordedByName: 'Pet parent',
          recordedAt: '2026-04-20T09:10:00.000Z',
        },
      ],
      vitals: [],
      dischargeSummary: '<p>summary</p>',
      stepStatus: { SUMMARY: 'IN_PROGRESS' },
    });

    const enc = getStore().getEncounter(APPT)!;
    expect(enc.soap[0].id).toBe('soap-backend');
    expect(enc.observations[0].id).toBe('obs-backend');
    expect(enc.vitals).toHaveLength(1);
    expect(enc.dischargeSummary).toBe('<p>summary</p>');
    expect(enc.stepStatus.SUMMARY).toBe('IN_PROGRESS');
  });

  it('merges backend SOAP template options without clearing existing templates on empty refresh', () => {
    seed();
    getStore().mergeEncounterData(APPT, {
      soapTemplates: [{ id: 'tpl-1', name: 'Standard SOAP', isDefault: true }],
    });
    expect(getStore().getEncounter(APPT)?.soapTemplates).toHaveLength(1);

    getStore().mergeEncounterData(APPT, { soapTemplates: [] });
    expect(getStore().getEncounter(APPT)?.soapTemplates[0].name).toBe('Standard SOAP');
  });

  it('upserts SOAP then signs it, completing the step', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>hi</p>' });
    getStore().upsertSoap(APPT, { plan: '<p>plan</p>' });
    let enc = getStore().getEncounter(APPT);
    expect(enc?.soap).toHaveLength(1);
    expect(enc?.soap[0].subjective).toBe('<p>hi</p>');
    expect(enc?.soap[0].plan).toBe('<p>plan</p>');

    getStore().signSoap(APPT, 'Dr Tim', false);
    enc = getStore().getEncounter(APPT);
    expect(enc?.soap[0].signedByName).toBe('Dr Tim');
    expect(enc?.soap[0].status).toBe('COMPLETED');
    expect(enc?.stepStatus.SOAP).toBe('COMPLETED');
  });

  it('applies a SOAP template', () => {
    seed();
    const tpl = { id: 'tpl-ortho', name: 'Orthopaedic exam', serviceId: 'svc-ortho' };
    getStore().applySoapTemplate(APPT, tpl);
    expect(getStore().getEncounter(APPT)?.soap[0].templateId).toBe(tpl.id);
  });

  it('starts a fresh draft after a note is signed', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>first</p>' });
    getStore().signSoap(APPT, 'Dr Tim', false);
    // Editing again after signing must not mutate the signed note — a new draft
    // is created so the SOAP form clears for the next entry.
    getStore().upsertSoap(APPT, { subjective: '<p>second</p>' });
    const soap = getStore().getEncounter(APPT)!.soap;
    expect(soap.filter((n) => n.status === 'COMPLETED')).toHaveLength(1);
    const draft = soap.find((n) => n.status !== 'COMPLETED');
    expect(draft?.subjective).toBe('<p>second</p>');
  });

  it('applies a template to a fresh draft when only signed notes exist', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>first</p>' });
    getStore().signSoap(APPT, 'Dr Tim', false);
    const tpl = { id: 'tpl-default', name: 'Default SOAP', isDefault: true };
    getStore().applySoapTemplate(APPT, tpl);
    const soap = getStore().getEncounter(APPT)!.soap;
    const draft = soap.find((n) => n.status !== 'COMPLETED');
    expect(draft?.templateId).toBe(tpl.id);
    expect(soap.filter((n) => n.status === 'COMPLETED')).toHaveLength(1);
  });

  it('prefills S/O/A/P content and version when a template carries content', () => {
    seed();
    const tpl = {
      id: 'tpl-content',
      name: 'Wellness',
      version: 4,
      content: {
        chiefComplaint: '<p>Annual check</p>',
        subjective: '<p>History</p>',
        objective: '<p>Exam</p>',
        assessment: '<p>Healthy</p>',
        plan: '<p>Vaccinate</p>',
      },
    };
    getStore().applySoapTemplate(APPT, tpl);
    const draft = getStore().getEncounter(APPT)!.soap[0];
    expect(draft.templateId).toBe('tpl-content');
    expect(draft.templateVersion).toBe(4);
    expect(draft.subjective).toBe('<p>History</p>');
    expect(draft.plan).toBe('<p>Vaccinate</p>');
  });

  it('swaps to a custom template structure and clears it when a native template is applied', () => {
    seed();
    const customTpl = {
      id: 'tpl-custom',
      name: 'Mobility',
      version: 2,
      versionId: 'ver-2',
      customSchema: [
        {
          id: 'grp',
          type: 'group' as const,
          label: 'Mobility',
          fields: [{ id: 'gait', type: 'input' as const, label: 'Gait', defaultValue: 'normal' }],
        },
      ],
    };
    getStore().applySoapTemplate(APPT, customTpl);
    let draft = getStore().getEncounter(APPT)!.soap[0];
    // Custom template swaps STRUCTURE: schema rendered, answers seeded from defaults, provenance kept.
    expect(draft.customSchema).toBeDefined();
    expect(draft.customAnswers).toEqual({ gait: 'normal' });
    expect(draft.templateVersionId).toBe('ver-2');

    // Switching back to a native template clears the override and prefills the editors.
    getStore().applySoapTemplate(APPT, {
      id: 'tpl-native',
      name: 'Native',
      content: { subjective: '<p>S</p>' },
    });
    draft = getStore()
      .getEncounter(APPT)!
      .soap.find((n) => n.status !== 'COMPLETED')!;
    expect(draft.customSchema).toBeUndefined();
    expect(draft.customAnswers).toBeUndefined();
    expect(draft.subjective).toBe('<p>S</p>');
  });

  it('does not overwrite typed SOAP content when applying a template', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>clinician typed</p>' });
    const tpl = {
      id: 'tpl-content',
      name: 'Wellness',
      content: { subjective: '<p>template</p>', plan: '<p>template plan</p>' },
    };
    getStore().applySoapTemplate(APPT, tpl);
    const draft = getStore()
      .getEncounter(APPT)!
      .soap.find((n) => n.status !== 'COMPLETED');
    // Typed subjective is preserved; the empty plan gets the template default.
    expect(draft?.subjective).toBe('<p>clinician typed</p>');
    expect(draft?.plan).toBe('<p>template plan</p>');
  });

  it('replaces typed SOAP content when explicitly requested', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>clinician typed</p>' });
    const tpl = {
      id: 'tpl-content',
      name: 'Wellness',
      content: { subjective: '<p>template</p>', plan: '<p>template plan</p>' },
    };
    getStore().applySoapTemplate(APPT, tpl, { replaceContent: true });
    const draft = getStore()
      .getEncounter(APPT)!
      .soap.find((n) => n.status !== 'COMPLETED');
    expect(draft?.subjective).toBe('<p>template</p>');
    expect(draft?.plan).toBe('<p>template plan</p>');
  });

  it('applies and merges backend section locks and capabilities', () => {
    seed();
    getStore().applyWorkspaceLocks(
      APPT,
      { soap: { locked: true, reason: 'Window closed' } },
      {
        canEditSoap: false,
      }
    );
    let enc = getStore().getEncounter(APPT);
    expect(enc?.sectionLocks?.soap).toEqual({ locked: true, reason: 'Window closed' });
    expect(enc?.capabilities?.canEditSoap).toBe(false);
    // A later partial apply merges rather than replacing existing sections.
    getStore().applyWorkspaceLocks(APPT, { invoice: { locked: false } }, undefined);
    enc = getStore().getEncounter(APPT);
    expect(enc?.sectionLocks?.soap?.locked).toBe(true);
    expect(enc?.sectionLocks?.invoice?.locked).toBe(false);
    expect(enc?.capabilities?.canEditSoap).toBe(false);
  });

  it('adds a backend observation record and de-dupes by id', () => {
    seed();
    const record = {
      id: 'sub-1',
      code: 'OT-001',
      toolKey: 'FGS',
      toolName: 'Feline grimace scale',
      scores: { Pain: 1 },
      total: 3,
      recordedByName: 'Dr Vet',
      recordedAt: '2026-06-22T10:00:00.000Z',
    };
    getStore().addObservationRecord(APPT, record);
    expect(getStore().getEncounter(APPT)?.observations).toHaveLength(1);
    // Re-adding the same id replaces (de-dupes) rather than duplicating.
    getStore().addObservationRecord(APPT, { ...record, total: 5 });
    const obs = getStore().getEncounter(APPT)!.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].total).toBe(5);
  });

  it('merges backend primaryAction and finalizationGate into the encounter', () => {
    seed();
    getStore().mergeEncounterData(APPT, {
      primaryAction: { label: 'Discharge patient', enabled: true },
      finalizationGate: { enabled: false, disabledReason: 'Forms not signed' },
    });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.primaryAction).toEqual({ label: 'Discharge patient', enabled: true });
    expect(enc?.finalizationGate?.enabled).toBe(false);
    expect(enc?.finalizationGate?.disabledReason).toBe('Forms not signed');
    // A later merge without these keys preserves the existing snapshot.
    getStore().mergeEncounterData(APPT, { soap: [] });
    expect(getStore().getEncounter(APPT)?.primaryAction?.label).toBe('Discharge patient');
  });

  it('no-ops signing when there is no active draft', () => {
    seed();
    // Nothing typed yet — signing must not create an empty completed note.
    getStore().signSoap(APPT, 'Dr Tim', false);
    expect(getStore().getEncounter(APPT)?.soap).toHaveLength(0);
  });

  it('adds vitals and observations with generated codes', () => {
    seed();
    getStore().addVitals(APPT, { weightLbs: 55, recordedByName: 'Sarah', recordedAt: 'now' });
    getStore().addObservation(APPT, {
      toolKey: 'FGS',
      toolName: 'Feline grimace scale',
      scores: {},
      recordedByName: 'Sarah',
      recordedAt: 'now',
    });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.vitals[0].code).toBe('VT-001');
    expect(enc?.observations[0].code).toBe('OT-001');
  });

  it('adds diagnostic orders and removes queued diagnostic tests', () => {
    seed();
    useAppointmentWorkspaceStore.setState((state) => ({
      encountersById: {
        ...state.encountersById,
        [APPT]: {
          ...state.encountersById[APPT],
          diagnosticTests: [{ id: 'dx-1', name: 'CBC', priceCents: 1000 }],
        },
      },
    }));
    getStore().removeDiagnosticTest(APPT, 'dx-1');
    expect(getStore().getEncounter(APPT)?.diagnosticTests).toHaveLength(0);

    getStore().addDiagnosticOrder(APPT, { orderCode: 'ABC-123', status: 'SUBMITTED' });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.diagnosticOrders[0].orderCode).toBe('ABC-123');
    expect(enc?.diagnosticOrders[0].status).toBe('SUBMITTED');
    expect(enc?.stepStatus.DIAGNOSTICS).toBe('IN_PROGRESS');
  });

  it('adds, updates and removes line items', () => {
    seed();
    getStore().addLineItem(APPT, {
      refId: 's1',
      kind: 'SERVICE',
      name: 'X-ray',
      qty: 1,
      unitPriceCents: 5000,
      amountCents: 5000,
    });
    const added = getStore().getEncounter(APPT)!.services.at(-1)!;
    getStore().updateLineItem(APPT, added.id, { qty: 3 });
    expect(
      getStore()
        .getEncounter(APPT)
        ?.services.find((s) => s.id === added.id)?.qty
    ).toBe(3);
    getStore().removeLineItem(APPT, added.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.services.find((s) => s.id === added.id)
    ).toBeUndefined();
  });

  it('does not create local schedule rows when adding line items', () => {
    // The task store is the single source of truth for schedule tasks — adding a
    // line item must NOT push a local-only schedule row (which would duplicate the
    // real backend task and desync the Schedule timeline from the Quick Actions panel).
    seed('INPATIENT');
    const before = getStore().getEncounter(APPT)!.schedule.length;
    getStore().addLineItem(APPT, {
      refId: 'pkg-1',
      kind: 'PACKAGE',
      name: 'Inpatient care package',
      qty: 1,
      unitPriceCents: 12000,
      amountCents: 12000,
    });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.services.at(-1)?.name).toBe('Inpatient care package');
    expect(enc.schedule).toHaveLength(before);
  });

  it('adds, updates and removes prescription items', () => {
    seed();
    getStore().addPrescription(APPT, { medicineName: 'Amox', fulfillment: 'IN_HOUSE' });
    const rx = getStore().getEncounter(APPT)!.prescription.at(-1)!;
    getStore().updatePrescription(APPT, rx.id, { dosage: '10mg' });
    expect(
      getStore()
        .getEncounter(APPT)
        ?.prescription.find((p) => p.id === rx.id)?.dosage
    ).toBe('10mg');
    getStore().removePrescription(APPT, rx.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.prescription.find((p) => p.id === rx.id)
    ).toBeUndefined();
  });

  it('does not create local schedule rows when adding prescriptions', () => {
    seed('INPATIENT');
    const before = getStore().getEncounter(APPT)!.schedule.length;
    getStore().addPrescription(APPT, { medicineName: 'Gabapentin', fulfillment: 'IN_HOUSE' });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.prescription.at(-1)?.medicineName).toBe('Gabapentin');
    expect(enc.schedule).toHaveLength(before);
  });

  it('manages schedule tasks', () => {
    seed('INPATIENT');
    getStore().addScheduleTask(APPT, {
      description: 'New task',
      category: 'Care',
      status: 'UPCOMING',
      autoGenerated: false,
    });
    const task = getStore().getEncounter(APPT)!.schedule.at(-1)!;
    getStore().updateScheduleTask(APPT, task.id, { assignedToName: 'Sarah' });
    getStore().setScheduleTaskStatus(APPT, task.id, 'COMPLETED');
    const updated = getStore()
      .getEncounter(APPT)!
      .schedule.find((t) => t.id === task.id)!;
    expect(updated.assignedToName).toBe('Sarah');
    expect(updated.status).toBe('COMPLETED');
  });

  it('sets discharge summary, follow-up and withdraw deposit', () => {
    seed();
    getStore().setDischargeSummary(APPT, '<p>bye</p>');
    getStore().setFollowUp(APPT, '2026-05-01');
    getStore().setWithdrawDeposit(APPT, true);
    const enc = getStore().getEncounter(APPT);
    expect(enc?.dischargeSummary).toBe('<p>bye</p>');
    expect(enc?.followUpAt).toBe('2026-05-01');
    expect(enc?.withdrawDeposit).toBe(true);
  });

  it('marks the encounter discharged and locks it view-only', () => {
    seed();
    getStore().markDischarged(APPT, '2026-05-01T10:00:00Z');
    const enc = getStore().getEncounter(APPT);
    expect(enc?.dischargedAt).toBe('2026-05-01T10:00:00Z');
    expect(enc?.viewOnly).toBe(true);
  });

  it('hydrates invoice billing while preserving locally recorded invoices', () => {
    seed();
    // A locally recorded deposit that finance has not returned yet.
    getStore().recordDepositCollection(APPT, {
      amountCents: 5000,
      method: 'CASH',
      byName: 'Front desk',
    });

    getStore().hydrateInvoiceBilling(APPT, {
      depositCents: 12000,
      pastInvoices: [
        {
          id: 'finance-inv-1',
          createdAt: '2026-05-01T10:00:00Z',
          totalCents: 8000,
          outstandingCents: 8000,
          status: 'UNPAID',
          items: [],
        },
      ],
    });

    const enc = getStore().getEncounter(APPT)!;
    expect(enc.depositCents).toBe(12000);
    expect(enc.pastInvoices.map((invoice) => invoice.id)).toEqual(['finance-inv-1']);
  });

  it('seeds the editable bill from the latest open invoice while keeping it in history', () => {
    seed();
    getStore().hydrateInvoiceBilling(APPT, {
      depositCents: 0,
      pastInvoices: [
        {
          id: 'paid-old',
          createdAt: '2026-05-01T09:00:00Z',
          totalCents: 4000,
          outstandingCents: 0,
          status: 'PAID_FULL',
          items: [
            {
              id: 'paid-line',
              name: 'Old consult',
              unitPriceCents: 4000,
              qty: 1,
              grossCents: 4000,
              discountCents: 0,
              amountCents: 4000,
            },
          ],
        },
        {
          id: 'open-draft',
          createdAt: '2026-06-20T19:18:22Z',
          totalCents: 20565,
          outstandingCents: 20565,
          status: 'UNPAID',
          items: [
            {
              id: 'line-proc',
              name: 'bookable procedure',
              unitPriceCents: 1000,
              qty: 1,
              grossCents: 1000,
              discountCents: 0,
              amountCents: 1000,
            },
            {
              id: 'line-idexx',
              name: 'IDEXX test 3196',
              unitPriceCents: 19565,
              qty: 1,
              grossCents: 19565,
              discountCents: 0,
              amountCents: 19565,
            },
          ],
        },
      ],
    });

    const enc = getStore().getEncounter(APPT)!;
    // Open-draft items now populate the editable bill builder…
    expect(enc.invoiceLineItems.map((item) => item.name)).toEqual([
      'bookable procedure',
      'IDEXX test 3196',
    ]);
    // …and BOTH invoices remain in the read-only Invoices breakdown (the history
    // record is never moved out — seeding the builder is additive).
    expect(enc.pastInvoices.map((invoice) => invoice.id)).toEqual(['paid-old', 'open-draft']);
  });

  it('does not reseed the bill when line items already exist', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Manual line',
      unitPriceCents: 500,
      qty: 1,
      grossCents: 500,
      discountCents: 0,
      amountCents: 500,
    });
    getStore().hydrateInvoiceBilling(APPT, {
      depositCents: 0,
      pastInvoices: [
        {
          id: 'open-draft',
          createdAt: '2026-06-20T19:18:22Z',
          totalCents: 1000,
          outstandingCents: 1000,
          status: 'UNPAID',
          items: [
            {
              id: 'line-proc',
              name: 'bookable procedure',
              unitPriceCents: 1000,
              qty: 1,
              grossCents: 1000,
              discountCents: 0,
              amountCents: 1000,
            },
          ],
        },
      ],
    });

    const enc = getStore().getEncounter(APPT)!;
    expect(enc.invoiceLineItems.map((item) => item.name)).toEqual(['Manual line']);
    // Untouched: the open invoice stays in history because the bill wasn't seeded.
    expect(enc.pastInvoices.map((invoice) => invoice.id)).toContain('open-draft');
  });

  it('sets the overall discount percent, clamped to 0–100', () => {
    seed();
    getStore().setOverallDiscountPercent(APPT, 15);
    expect(getStore().getEncounter(APPT)?.overallDiscountPercent).toBe(15);

    getStore().setOverallDiscountPercent(APPT, 150);
    expect(getStore().getEncounter(APPT)?.overallDiscountPercent).toBe(100);

    getStore().setOverallDiscountPercent(APPT, -5);
    expect(getStore().getEncounter(APPT)?.overallDiscountPercent).toBe(0);
  });

  it('adds workspace documents', () => {
    seed();
    const before = getStore().getEncounter(APPT)!.documents.length;
    getStore().addDocument(APPT, {
      createdAt: '2026-05-01T12:00:00Z',
      category: 'Discharge',
      description: 'Signed discharge summary',
      signedByName: 'Dr Tim',
      lastModifiedAt: '2026-05-01T12:00:00Z',
    });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.documents).toHaveLength(before + 1);
    expect(enc.documents[0].description).toBe('Signed discharge summary');
    expect(enc.documents[0].id).toBeTruthy();
  });

  it('adds and removes invoice line items', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Bandage change',
      unitPriceCents: 6500,
      qty: 1,
      grossCents: 6500,
      discountCents: 500,
      amountCents: 6000,
    });
    const added = getStore().getEncounter(APPT)!.invoiceLineItems.at(-1)!;
    expect(added.name).toBe('Bandage change');
    getStore().removeInvoiceLineItem(APPT, added.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.invoiceLineItems.find((item) => item.id === added.id)
    ).toBeUndefined();
  });

  it('updates an invoice line item, re-deriving gross/amount and clamping discount', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Initial Consultation',
      unitPriceCents: 10000,
      qty: 1,
      grossCents: 10000,
      discountCents: 1000,
      amountCents: 9000,
    });
    const item = getStore().getEncounter(APPT)!.invoiceLineItems[0];

    getStore().updateInvoiceLineItem(APPT, item.id, { qty: 4 });
    const updated = getStore()
      .getEncounter(APPT)!
      .invoiceLineItems.find((i) => i.id === item.id)!;
    expect(updated.qty).toBe(4);
    expect(updated.grossCents).toBe(item.unitPriceCents * 4);
    expect(updated.amountCents).toBe(updated.grossCents - updated.discountCents);

    // A discount larger than gross is clamped to the gross.
    getStore().updateInvoiceLineItem(APPT, item.id, { discountCents: 9_999_999 });
    const clamped = getStore()
      .getEncounter(APPT)!
      .invoiceLineItems.find((i) => i.id === item.id)!;
    expect(clamped.discountCents).toBe(clamped.grossCents);
    expect(clamped.amountCents).toBe(0);
  });

  it('caps a line discount at the per-line max-discount percent ceiling', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Ultrasound scan',
      unitPriceCents: 10000,
      qty: 1,
      grossCents: 10000,
      discountCents: 1000,
      amountCents: 9000,
      maxDiscountPercent: 20,
      maxDiscountCents: 2000,
    });
    const item = getStore().getEncounter(APPT)!.invoiceLineItems[0];

    // Try to discount more than the ceiling — it clamps to maxDiscountPercent.
    getStore().updateInvoiceLineItem(APPT, item.id, { discountCents: 5000 });
    const capped = getStore()
      .getEncounter(APPT)!
      .invoiceLineItems.find((i) => i.id === item.id)!;
    expect(capped.discountCents).toBe(2000);
    expect(capped.amountCents).toBe(8000);

    getStore().updateInvoiceLineItem(APPT, item.id, { qty: 2, discountCents: 5000 });
    const resized = getStore()
      .getEncounter(APPT)!
      .invoiceLineItems.find((i) => i.id === item.id)!;
    expect(resized.grossCents).toBe(20000);
    expect(resized.maxDiscountCents).toBe(4000);
    expect(resized.discountCents).toBe(4000);
    expect(resized.amountCents).toBe(16000);
  });

  it('records an invoice payment, clearing the bill without creating a synthetic invoice', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Initial Consultation',
      unitPriceCents: 10000,
      qty: 1,
      grossCents: 10000,
      discountCents: 1000,
      amountCents: 9000,
    });
    const before = getStore().getEncounter(APPT)!;
    const pastCount = before.pastInvoices.length;

    getStore().recordInvoicePayment(APPT, { method: 'CASH', byName: 'Front desk' });

    const after = getStore().getEncounter(APPT)!;
    expect(after.invoiceLineItems).toHaveLength(0);
    expect(after.pastInvoices).toHaveLength(pastCount);
  });

  it('reduces the deposit when payment is from the deposit', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Initial Consultation',
      unitPriceCents: 10000,
      qty: 1,
      grossCents: 10000,
      discountCents: 1000,
      amountCents: 9000,
    });
    useAppointmentWorkspaceStore.setState((state) => ({
      encountersById: {
        ...state.encountersById,
        [APPT]: { ...state.encountersById[APPT], depositCents: 120000 },
      },
    }));
    const start = getStore().getEncounter(APPT)!.depositCents;
    const pastCount = getStore().getEncounter(APPT)!.pastInvoices.length;

    getStore().recordInvoicePayment(APPT, { method: 'DEPOSIT' });

    const after = getStore().getEncounter(APPT)!;
    expect(after.depositCents).toBeLessThan(start);
    expect(after.pastInvoices).toHaveLength(pastCount);
  });

  it('records a deposit balance without creating a synthetic invoice', () => {
    seed();
    const before = getStore().getEncounter(APPT)!;

    getStore().recordDepositCollection(APPT, {
      amountCents: 5000,
      method: 'CASH',
      byName: 'Front desk',
    });

    const after = getStore().getEncounter(APPT)!;
    expect(after.depositCents).toBe(before.depositCents + 5000);
    expect(after.pastInvoices).toHaveLength(before.pastInvoices.length);
  });

  it('no-ops recording a payment when there are no line items', () => {
    seed();
    const enc = getStore().getEncounter(APPT)!;
    // Clear the bill first, then attempt to record a payment.
    enc.invoiceLineItems.forEach((item) => getStore().removeInvoiceLineItem(APPT, item.id));
    const pastCount = getStore().getEncounter(APPT)!.pastInvoices.length;

    getStore().recordInvoicePayment(APPT, { method: 'CASH' });

    expect(getStore().getEncounter(APPT)!.pastInvoices).toHaveLength(pastCount);
  });

  it('toggles ready-for-billing with a stamp and clears it', () => {
    seed();
    getStore().toggleReadyForBilling(APPT, { id: 'u1', name: 'Dr Tim' });
    let enc = getStore().getEncounter(APPT);
    expect(enc?.readyForBilling.value).toBe(true);
    expect(enc?.readyForBilling.byName).toBe('Dr Tim');
    expect(enc?.readyForBilling.at).toBeTruthy();
    getStore().toggleReadyForBilling(APPT, { id: 'u1', name: 'Dr Tim' });
    enc = getStore().getEncounter(APPT);
    expect(enc?.readyForBilling.value).toBe(false);
    expect(enc?.readyForBilling.byName).toBeUndefined();
  });

  it('keeps the ready-for-billing actor name when a bootstrap merge omits it', () => {
    seed();
    // Clinician marks it (optimistic) with their name + timestamp.
    getStore().toggleReadyForBilling(APPT, { id: 'u1', name: 'Dr Tim' });
    // A subsequent bootstrap refresh reports the flag but without an actor name/time.
    getStore().mergeEncounterData(APPT, { readyForBilling: { value: true } });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.readyForBilling.value).toBe(true);
    // The locally-known name/time survive — the stamp does not degrade to "Clinical team".
    expect(enc?.readyForBilling.byName).toBe('Dr Tim');
    expect(enc?.readyForBilling.at).toBeTruthy();
  });

  it('toggles ready-for-discharge with a stamp', () => {
    seed();
    getStore().toggleReadyForDischarge(APPT, { id: 'u2', name: 'Sarah' });
    expect(getStore().getEncounter(APPT)?.readyForDischarge.byName).toBe('Sarah');
  });

  it('sets step status', () => {
    seed();
    getStore().setStepStatus(APPT, 'DIAGNOSTICS', 'COMPLETED');
    expect(getStore().getEncounter(APPT)?.stepStatus.DIAGNOSTICS).toBe('COMPLETED');
  });

  it('adds and removes companion alerts', () => {
    seed();
    const before = getStore().getEncounter(APPT)!.alerts.length;
    getStore().addAlert(APPT, { label: 'Diabetic', severity: 'high' });
    const added = getStore().getEncounter(APPT)!.alerts;
    expect(added).toHaveLength(before + 1);
    const newAlert = added[added.length - 1];
    expect(newAlert.label).toBe('Diabetic');
    expect(newAlert.severity).toBe('high');
    getStore().removeAlert(APPT, newAlert.id);
    expect(getStore().getEncounter(APPT)!.alerts).toHaveLength(before);
  });

  it('ignores mutations for unknown appointments', () => {
    getStore().setLead('missing', 'u', 'n');
    expect(getStore().getEncounter('missing')).toBeUndefined();
  });

  it('marks matching saved treatment rows billed and clears the bill on payment', () => {
    seed();
    useAppointmentWorkspaceStore.setState((state) => ({
      encountersById: {
        ...state.encountersById,
        [APPT]: {
          ...state.encountersById[APPT],
          services: [
            {
              id: 's1',
              refId: 'r1',
              kind: 'SERVICE' as const,
              name: 'Dental cleaning',
              qty: 1,
              unitPriceCents: 5000,
              amountCents: 5000,
            },
            {
              id: 's2',
              refId: 'r2',
              kind: 'SERVICE' as const,
              name: 'Nail trim',
              qty: 1,
              unitPriceCents: 2000,
              amountCents: 2000,
            },
          ],
          prescription: [
            {
              id: 'p1',
              medicineName: 'Amoxicillin',
              fulfillment: 'IN_HOUSE' as const,
              priceCents: 800,
            },
          ],
          invoiceLineItems: [
            {
              id: 'inv-1',
              name: 'Dental cleaning',
              unitPriceCents: 5000,
              qty: 1,
              grossCents: 5000,
              discountCents: 0,
              amountCents: 5000,
            },
            {
              id: 'inv-2',
              name: 'Amoxicillin',
              unitPriceCents: 800,
              qty: 1,
              grossCents: 800,
              discountCents: 0,
              amountCents: 800,
            },
          ],
        },
      },
    }));

    getStore().recordInvoicePayment(APPT, { method: 'CASH', byName: 'Dr Patel' });

    const enc = getStore().getEncounter(APPT)!;
    // The editable bill is cleared (the paid lines move to pastInvoices).
    expect(enc.invoiceLineItems).toEqual([]);
    // The matching saved service + prescription are flipped to billed so the
    // Total Bill auto-seed cannot re-add them.
    const dental = enc.services.find((s) => s.name === 'Dental cleaning')!;
    expect(dental.billed).toBe(true);
    expect(dental.billedByName).toBe('Dr Patel');
    expect(dental.billedAt).toBeTruthy();
    expect(enc.prescription[0].billed).toBe(true);
    // A saved service that was NOT on the paid bill stays unbilled/billable.
    expect(enc.services.find((s) => s.name === 'Nail trim')!.billed).toBeFalsy();
  });
});
