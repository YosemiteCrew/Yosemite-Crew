import {
  createEncounterDocumentPacket,
  createEncounterTreatmentItem,
  deleteEncounterTreatmentItem,
  deletePrescriptionTreatmentItem,
  getEncounterDocumentPacketPdfUrl,
  persistEncounterTreatmentLine,
  reconcileWorkspaceDocumentPacket,
  getAppointmentWorkspaceBootstrap,
  getEncounterWorkspaceBootstrap,
  getWorkspaceDocumentPacket,
  listAppointmentWorkspaceDocuments,
  listCompanionMedicalRecords,
  listCompanionWorkspaceDocuments,
  listEncounterTreatmentItems,
  listEncounterWorkspaceDocuments,
  normalizeWorkspaceBootstrapForEncounter,
  persistTreatmentItems,
  signWorkspaceDocumentPacket,
  updateEncounterTreatmentItem,
} from '@/app/features/appointments/services/workspaceAggregateService';
import type { LineItem } from '@/app/features/appointments/types/workspace';
import api, { deleteData, getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

describe('workspaceAggregateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getData as jest.Mock).mockResolvedValue({ data: [] });
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'created' } });
    (patchData as jest.Mock).mockResolvedValue({ data: { id: 'updated' } });
    (deleteData as jest.Mock).mockResolvedValue({ data: undefined });
  });

  it('wraps workspace bootstrap and document list endpoints', async () => {
    await getAppointmentWorkspaceBootstrap('org-1', 'appt-1');
    await getEncounterWorkspaceBootstrap('org-1', 'enc-1');
    await listAppointmentWorkspaceDocuments('org-1', 'appt-1');
    await listEncounterWorkspaceDocuments('org-1', 'enc-1');
    await listCompanionWorkspaceDocuments('org-1', 'comp-1');
    await listCompanionMedicalRecords('org-1', 'comp-1');

    expect(getData).toHaveBeenNthCalledWith(
      1,
      '/v1/workspace/organisations/org-1/appointments/appt-1'
    );
    expect(getData).toHaveBeenNthCalledWith(
      2,
      '/v1/workspace/organisations/org-1/encounters/enc-1'
    );
    expect(getData).toHaveBeenNthCalledWith(
      3,
      '/v1/workspace/organisations/org-1/appointments/appt-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      4,
      '/v1/workspace/organisations/org-1/encounters/enc-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      5,
      '/v1/workspace/organisations/org-1/companions/comp-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      6,
      '/v1/workspace/organisations/org-1/companions/comp-1/medical-records'
    );
  });

  it('wraps document packet endpoints', async () => {
    await createEncounterDocumentPacket('org-1', 'enc-1', { include: ['SOAP'] });
    await getWorkspaceDocumentPacket('org-1', 'packet-1');
    await signWorkspaceDocumentPacket('org-1', 'packet-1', { signatureText: 'Dr A' });

    expect(postData).toHaveBeenNthCalledWith(
      1,
      '/v1/workspace/organisations/org-1/encounters/enc-1/document-packet',
      { include: ['SOAP'] }
    );
    expect(getData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/document-packets/packet-1'
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/v1/workspace/organisations/org-1/document-packets/packet-1/sign',
      { signatureText: 'Dr A' }
    );
  });

  it('wraps encounter treatment item CRUD endpoints', async () => {
    await listEncounterTreatmentItems('org-1', 'enc-1');
    await createEncounterTreatmentItem('org-1', 'enc-1', { productId: 'svc-1' });
    await updateEncounterTreatmentItem('org-1', 'item-1', { quantity: 2 });
    await deleteEncounterTreatmentItem('org-1', 'item-1');

    expect(getData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items'
    );
    expect(postData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items',
      { productId: 'svc-1' }
    );
    expect(patchData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/item-1',
      { quantity: 2 }
    );
    expect(deleteData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/item-1'
    );
  });

  it('POSTs new local rows and PATCHes edits to persisted rows', async () => {
    // Backend already has the persisted row; no removals to reconcile.
    (getData as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'svc-persisted', servicePackageKind: 'SERVICE', billingStatus: 'UNBILLED' }],
    });
    const items: LineItem[] = [
      {
        id: 'svc-persisted',
        refId: 'prod-1',
        kind: 'SERVICE',
        name: 'Saved service (qty edited)',
        qty: 3,
        unitPriceCents: 5000,
        amountCents: 15000,
      },
      {
        id: 'local-li-2',
        refId: 'prod-2',
        kind: 'PACKAGE',
        name: 'New package',
        qty: 2,
        instructions: 'Apply twice',
        unitPriceCents: 12000,
        amountCents: 24000,
      },
    ];

    await persistTreatmentItems('org-1', 'enc-1', items);

    // The local- row is POSTed with the backend create contract.
    expect(postData).toHaveBeenCalledTimes(1);
    expect(postData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items',
      expect.objectContaining({
        productId: 'prod-2',
        servicePackageKind: 'PACKAGE',
        quantity: 2,
        priceSnapshot: { unitPrice: 120 },
        productSnapshot: expect.objectContaining({
          name: 'New package',
          kind: 'PACKAGE',
          instructions: 'Apply twice',
        }),
      })
    );
    // The persisted row's edit (qty 1 -> 3) is PATCHed so it survives rehydrate.
    expect(patchData).toHaveBeenCalledTimes(1);
    expect(patchData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/svc-persisted',
      expect.objectContaining({
        productId: 'prod-1',
        servicePackageKind: 'SERVICE',
        quantity: 3,
        priceSnapshot: { unitPrice: 50 },
        productSnapshot: expect.objectContaining({ name: 'Saved service (qty edited)' }),
      })
    );
    // Nothing was removed, so no DELETE is issued.
    expect(deleteData).not.toHaveBeenCalled();
  });

  it('DELETEs persisted service rows the clinician removed locally', async () => {
    // Backend has two persisted rows; only one remains in the local list.
    (getData as jest.Mock).mockResolvedValueOnce({
      data: [
        { id: 'svc-keep', servicePackageKind: 'SERVICE', billingStatus: 'UNBILLED' },
        { id: 'svc-removed', servicePackageKind: 'PACKAGE', billingStatus: 'UNBILLED' },
      ],
    });
    const items: LineItem[] = [
      {
        id: 'svc-keep',
        refId: 'prod-1',
        kind: 'SERVICE',
        name: 'Kept service',
        qty: 1,
        unitPriceCents: 5000,
        amountCents: 5000,
      },
    ];

    await persistTreatmentItems('org-1', 'enc-1', items);

    expect(deleteData).toHaveBeenCalledTimes(1);
    expect(deleteData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/svc-removed'
    );
    // The kept row is still PATCHed.
    expect(patchData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/svc-keep',
      expect.any(Object)
    );
  });

  it('never deletes billed or medication-kind backend rows', async () => {
    (getData as jest.Mock).mockResolvedValueOnce({
      data: [
        { id: 'svc-billed', servicePackageKind: 'SERVICE', billingStatus: 'BILLED' },
        { id: 'rx-row', servicePackageKind: 'MEDICATION', billingStatus: 'UNBILLED' },
      ],
    });

    // Local list is empty: no service/package rows kept, but billed + medication
    // rows must be preserved.
    await persistTreatmentItems('org-1', 'enc-1', []);

    expect(deleteData).not.toHaveBeenCalled();
    expect(postData).not.toHaveBeenCalled();
    expect(patchData).not.toHaveBeenCalled();
  });

  it('normalizes aggregate diagnostics, encounter mode, and saved discharge state', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      appointment: { id: 'appt-1', kind: 'INPATIENT' },
      encounter: {
        id: 'enc-1',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'onleave',
        updatedAt: '2026-06-18T10:00:00.000Z',
        periodStart: '2026-06-18T08:30:00.000Z',
        readyForDischargeByName: 'Dr Discharge',
        readyForDischargeAt: '2026-06-18T10:05:00.000Z',
        admission: {
          room: { id: 'room-1' },
          unitId: 'unit-1',
          admittedAt: '2026-06-18T08:30:00.000Z',
        },
      },
      diagnosticQueue: [
        {
          id: 'lab-1',
          providerTestCode: 'CBC',
          status: 'SUBMITTED',
          createdAt: '2026-06-18T09:00:00.000Z',
        },
      ],
      clinicalArtifacts: [
        {
          artifact: {
            id: 'dc-1',
            kind: 'DISCHARGE_SUMMARY',
            updatedAt: '2026-06-18T11:00:00.000Z',
            authorId: 'Dr A',
          },
          dischargeSummary: {
            summary: '<p>Stable for discharge</p>',
            followUp: '2026-06-25T09:00:00.000Z',
          },
        },
      ],
      documents: [
        {
          documentId: 'doc-1',
          sourceKind: 'RENDERED_DOCUMENT',
          sourceId: 'doc-1',
          kind: 'DISCHARGE_SUMMARY',
          title: 'Discharge summary',
          status: 'ACTIVE',
          signingStatus: 'SIGNED',
          pdfUrl: 'https://files.test/discharge.pdf',
          createdAt: '2026-06-18T11:00:00.000Z',
          updatedAt: '2026-06-18T11:30:00.000Z',
        },
      ],
    });

    expect(patch.mode).toBe('INPATIENT');
    expect(patch.roomId).toBe('room-1');
    expect(patch.unitId).toBe('unit-1');
    expect(patch.admittedAt).toBe('2026-06-18T08:30:00.000Z');
    expect(patch.startedAt).toBe('2026-06-18T08:30:00.000Z');
    expect(patch.readyForDischarge?.value).toBe(true);
    expect(patch.readyForDischarge?.byName).toBe('Dr Discharge');
    expect(patch.readyForDischarge?.at).toBe('2026-06-18T10:05:00.000Z');
    expect(patch.diagnosticOrders).toEqual([
      {
        id: 'lab-1',
        orderCode: 'CBC',
        createdAt: '2026-06-18T09:00:00.000Z',
        status: 'SUBMITTED',
      },
    ]);
    expect(patch.dischargeSummary).toBe('<p>Stable for discharge</p>');
    expect(patch.dischargeSummaryId).toBe('dc-1');
    expect(patch.dischargeSavedAt).toBe('2026-06-18T11:00:00.000Z');
    expect(patch.documents?.[0]).toEqual(
      expect.objectContaining({
        id: 'doc-1',
        sourceKind: 'RENDERED_DOCUMENT',
        sourceId: 'doc-1',
        status: 'ACTIVE',
        signingStatus: 'SIGNED',
        pdfUrl: 'https://files.test/discharge.pdf',
      })
    );
    expect(patch.stepStatus).toEqual({
      DIAGNOSTICS: 'COMPLETED',
      SUMMARY: 'COMPLETED',
      SOAP: 'COMPLETED',
    });
  });

  it('hydrates ready-for-billing from the invoice billing stage so it survives a refresh', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'in-progress', updatedAt: '2026-06-18T11:00:00.000Z' },
      invoice: {
        visitBillingStage: 'READY_FOR_BILLING',
        readyForBillingByName: 'Front Desk',
        readyForBillingActorId: 'system',
        readyForBillingAt: '2026-06-18T11:05:00.000Z',
      },
    });
    expect(patch.readyForBilling?.value).toBe(true);
    expect(patch.readyForBilling?.byName).toBe('Front Desk');
    expect(patch.readyForBilling?.byUserId).toBe('system');
    expect(patch.readyForBilling?.at).toBe('2026-06-18T11:05:00.000Z');
    // Discharge is not implied by billing.
    expect(patch.readyForDischarge).toBeUndefined();
  });

  it('reads startedAt from encounter.periodStart for an outpatient encounter with no admission', () => {
    // Bug #1903: the visit timer must start for outpatient encounters, which have
    // no admission block. `startedAt` comes from `encounter.periodStart` (stamped
    // to the status-change time when the encounter goes In Progress).
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: {
        id: 'enc-1',
        appointmentKind: 'OUTPATIENT',
        status: 'in-progress',
        periodStart: '2026-07-02T14:05:00.000Z',
      },
    });
    expect(patch.startedAt).toBe('2026-07-02T14:05:00.000Z');
    expect(patch.admittedAt).toBeUndefined();
  });

  it('keeps ready-for-billing ticked once the invoice is SETTLED after payment', () => {
    // Regression: paying advances the single-slot billing stage to SETTLED, overwriting
    // READY_FOR_BILLING, and the backend reports readyForBilling: false. The milestone is
    // monotonic — a paid visit was, by definition, ready for billing — so it must stay ticked.
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'in-progress', updatedAt: '2026-07-02T10:00:00.000Z' },
      readyForBilling: false,
      visitBillingStage: 'SETTLED',
      invoice: {
        status: 'PAID',
        visitBillingStage: 'SETTLED',
        paidAt: '2026-07-02T10:19:31.000Z',
      },
    });
    expect(patch.readyForBilling?.value).toBe(true);
  });

  it('keeps ready-for-billing ticked for a PAID invoice even without an explicit stage', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'in-progress' },
      readyForBilling: false,
      invoice: { status: 'PAID', paidAt: '2026-07-02T10:19:31.000Z' },
    });
    expect(patch.readyForBilling?.value).toBe(true);
  });

  it('does not tick ready-for-billing for an unpaid DRAFT invoice', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'in-progress' },
      readyForBilling: false,
      visitBillingStage: 'DRAFT',
      invoice: { status: 'AWAITING_PAYMENT', visitBillingStage: 'DRAFT' },
    });
    expect(patch.readyForBilling).toBeUndefined();
  });

  it('persists ready-for-discharge from the encounter onleave status (marked, not yet discharged)', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'onleave', updatedAt: '2026-07-02T10:00:00.000Z' },
      readyForDischarge: true,
      readyForDischargeByName: 'Dr Patel',
    });
    expect(patch.readyForDischarge?.value).toBe(true);
    expect(patch.readyForDischarge?.byName).toBe('Dr Patel');
  });

  it('persists ready-for-discharge from the bootstrap flag even when encounter.status is absent', () => {
    // The backend surfaces readiness as a top-level boolean; the old code only read
    // encounter.status/encounter.readyForDischarge and dropped the flag on refresh.
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1' },
      readyForDischarge: true,
    });
    expect(patch.readyForDischarge?.value).toBe(true);
  });

  it('keeps ready-for-discharge ticked once the visit is fully discharged (status finished)', () => {
    // A full discharge advances status onleave -> finished and stamps admission.dischargedAt, so
    // the backend reports readyForDischarge: false — but the milestone is monotonic and must persist.
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: {
        id: 'enc-1',
        status: 'finished',
        admission: { dischargedAt: '2026-07-02T10:49:00.000Z' },
      },
      readyForDischarge: false,
    });
    expect(patch.readyForDischarge?.value).toBe(true);
    expect(patch.readyForDischarge?.at).toBe('2026-07-02T10:49:00.000Z');
  });

  it('does not tick ready-for-discharge for an open, un-marked encounter', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: { id: 'enc-1', status: 'in-progress' },
      readyForDischarge: false,
    });
    expect(patch.readyForDischarge).toBeUndefined();
  });

  it('hydrates both ready states from explicit bootstrap flags', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      encounter: {
        id: 'enc-1',
        status: 'in-progress',
        readyForBilling: true,
        readyForDischarge: true,
        updatedAt: '2026-06-18T11:00:00.000Z',
      },
    });
    expect(patch.readyForBilling?.value).toBe(true);
    expect(patch.readyForDischarge?.value).toBe(true);
  });

  it('normalizes backend section locks and capabilities when present', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      sectionLocks: {
        soap: { locked: true, reason: 'Record finalized' },
        invoice: { locked: false },
        // Unknown sections and malformed entries are ignored.
        unknownSection: { locked: true },
        treatment: { reason: 'no locked flag' },
      },
      capabilities: {
        canEditSoap: false,
        canCollectPayment: true,
        notACapability: true,
      },
    });
    expect(patch.sectionLocks).toEqual({
      soap: { locked: true, reason: 'Record finalized' },
      invoice: { locked: false, reason: undefined },
    });
    expect(patch.capabilities).toEqual({ canEditSoap: false, canCollectPayment: true });
  });

  it('reads section locks from the legacy `locks` key and omits absent contracts', () => {
    const withLocks = normalizeWorkspaceBootstrapForEncounter({
      locks: { discharge: { locked: true } },
    });
    expect(withLocks.sectionLocks).toEqual({ discharge: { locked: true, reason: undefined } });

    const without = normalizeWorkspaceBootstrapForEncounter({ encounter: { id: 'enc-1' } });
    expect(without.sectionLocks).toBeUndefined();
    expect(without.capabilities).toBeUndefined();
  });

  it('reads capability flags from the backend `permissions` key', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      permissions: { canEditSoap: true, canCollectPayment: false, notACapability: true },
    });
    expect(patch.capabilities).toEqual({ canEditSoap: true, canCollectPayment: false });
  });

  it('normalizes the primary action and finalization gate from the bootstrap', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      primaryAction: {
        kind: 'DISCHARGE',
        label: 'Discharge patient',
        detail: 'All requirements met',
        enabled: true,
      },
      finalizationGate: {
        enabled: false,
        disabledReason: 'Forms not signed',
        requiredFormsSigned: false,
        billingReady: true,
        notAGateFlag: true,
      },
    });
    expect(patch.primaryAction).toEqual({
      kind: 'DISCHARGE',
      label: 'Discharge patient',
      detail: 'All requirements met',
      enabled: true,
      disabledReason: undefined,
    });
    expect(patch.finalizationGate).toEqual({
      enabled: false,
      disabledReason: 'Forms not signed',
      requiredFormsSigned: false,
      billingReady: true,
    });
  });

  it('skips an unlabelled primary action and a gate without an enabled flag', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      primaryAction: { kind: 'NONE' },
      finalizationGate: { disabledReason: 'no enabled flag' },
    });
    expect(patch.primaryAction).toBeUndefined();
    expect(patch.finalizationGate).toBeUndefined();
  });

  it('splits package-expanded treatment items into services and prescriptions by kind', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      treatmentItems: [
        {
          id: 'ti-consult',
          productId: 'prod-consult',
          servicePackageKind: 'CONSULTATION',
          name: 'Wellness Consult',
          quantity: 1,
          priceSnapshot: { unitPrice: 40 },
          billingStatus: 'UNBILLED',
        },
        {
          id: 'ti-procedure',
          productId: 'prod-proc',
          servicePackageKind: 'PROCEDURE',
          name: 'Nail Trim',
          quantity: 2,
          priceSnapshot: { unitPrice: 10 },
          billingStatus: 'BILLED',
        },
        {
          id: 'ti-med',
          productId: 'prod-med',
          servicePackageKind: 'MEDICATION',
          name: 'Amoxicillin',
          quantity: 1,
          priceSnapshot: { unitPrice: 12 },
          productSnapshot: { instructions: 'Twice daily' },
          billingStatus: 'UNBILLED',
        },
      ],
    });

    // Service / procedure components land in Services & Packages.
    expect(patch.services).toEqual([
      expect.objectContaining({
        id: 'ti-consult',
        kind: 'SERVICE',
        amountCents: 4000,
        billed: false,
      }),
      expect.objectContaining({
        id: 'ti-procedure',
        kind: 'SERVICE',
        amountCents: 2000,
        billed: true,
      }),
    ]);
    // Medication component is routed to the prescription section, not Services.
    expect(patch.services?.some((item) => item.id === 'ti-med')).toBe(false);
    expect(patch.prescription).toEqual([
      expect.objectContaining({
        id: 'ti-med',
        medicineName: 'Amoxicillin',
        fulfillment: 'IN_HOUSE',
        priceCents: 1200,
        instructions: 'Twice daily',
        inventoryItemId: 'prod-med',
      }),
    ]);
    expect(patch.stepStatus?.TREATMENT).toBe('COMPLETED');
  });

  it('preserves the dispensed quantity on a package-expanded medication', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      treatmentItems: [
        {
          id: 'ti-med',
          productId: 'prod-med',
          servicePackageKind: 'MEDICATION',
          name: 'Amoxicillin',
          quantity: 3,
          priceSnapshot: { unitPrice: 12 },
          billingStatus: 'UNBILLED',
        },
      ],
    });

    // qty drives the editable Qty box, stock decrement and billing — a numeric `quantity`
    // must survive as PrescriptionItem's string `qty`, not reload blank.
    expect(patch.prescription?.[0]).toEqual(expect.objectContaining({ id: 'ti-med', qty: '3' }));
  });

  it('leaves qty unset on a medication treatment item with no quantity', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      treatmentItems: [
        {
          id: 'ti-med-noqty',
          servicePackageKind: 'MEDICATION',
          name: 'Amoxicillin',
          billingStatus: 'UNBILLED',
        },
      ],
    });

    expect(patch.prescription?.[0].qty).toBeUndefined();
  });

  it('keeps a billed prescription-linked item in the prescription section even when its kind is not a medication', () => {
    // After billing/dispense the backend can persist the drug as a treatment-item
    // row whose kind is no longer MEDICATION/PRESCRIPTION but which still links to a
    // prescription artifact. It must stay in the prescription section (read-only via
    // `billed`), not be misfiled under Services & Packages or dropped entirely.
    const patch = normalizeWorkspaceBootstrapForEncounter({
      treatmentItems: [
        {
          id: 'ti-billed-rx',
          productId: 'prod-drug',
          servicePackageKind: 'SERVICE',
          prescriptionId: 'rx-artifact-1',
          name: 'Metronidazole',
          quantity: 1,
          priceSnapshot: { unitPrice: 18 },
          billingStatus: 'BILLED',
        },
      ],
    });

    expect(patch.services ?? []).not.toContainEqual(
      expect.objectContaining({ id: 'ti-billed-rx' })
    );
    expect(patch.prescription).toEqual([
      expect.objectContaining({
        id: 'ti-billed-rx',
        medicineName: 'Metronidazole',
        priceCents: 1800,
        billed: true,
      }),
    ]);
  });

  it('merges stored prescriptions with medication treatment items without duplicating ids', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      prescriptions: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          dosage: '50mg',
          fulfillment: 'PRESCRIPTION_ONLY',
          priceCents: 800,
        },
      ],
      treatmentItems: [
        {
          id: 'rx-1',
          servicePackageKind: 'PRESCRIPTION',
          name: 'Carprofen duplicate',
          quantity: 1,
          priceSnapshot: { unitPrice: 8 },
        },
        {
          id: 'ti-med-2',
          productId: 'prod-med-2',
          servicePackageKind: 'MEDICATION',
          name: 'Gabapentin',
          quantity: 1,
          priceSnapshot: { unitPrice: 5 },
        },
      ],
    });

    expect(patch.prescription).toEqual([
      expect.objectContaining({
        id: 'rx-1',
        medicineName: 'Carprofen',
        fulfillment: 'PRESCRIPTION_ONLY',
      }),
      expect.objectContaining({ id: 'ti-med-2', medicineName: 'Gabapentin' }),
    ]);
    // The PRESCRIPTION-kind treatment item is not also rendered as a service row.
    expect(patch.services).toBeUndefined();
  });

  it('reads the nested { artifact, prescription } envelope and per-line items', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      prescriptions: [
        {
          artifact: {
            id: 'artifact-1',
            kind: 'PRESCRIPTION',
            status: 'COMPLETED',
            summary: 'Carprofen 75 mg Tablets',
          },
          prescription: {
            id: 'rx-1',
            items: [
              {
                id: 'line-1',
                medication: '',
                strength: '75mg',
                dosage: '75mg',
                route: 'PO',
                frequency: 'BID',
                quantity: '2',
                metadata: { dosageForm: 'Tablet' },
              },
            ],
            medications: [{ medication: '', inventoryItemId: 'inv-1' }],
          },
        },
      ],
      // Same backend id as the artifact — must not produce a duplicate row.
      treatmentItems: [
        {
          id: 'rx-1',
          prescriptionId: 'rx-1',
          servicePackageKind: 'PRESCRIPTION',
          name: 'Treatment items',
          quantity: 1,
        },
      ],
    });

    expect(patch.prescription).toEqual([
      expect.objectContaining({
        id: 'line-1',
        // Per-line medication is blank, so the artifact summary is the label.
        medicineName: 'Carprofen 75 mg Tablets',
        strength: '75mg',
        dosageForm: 'Tablet',
        dosage: '75mg',
        route: 'PO',
        frequency: 'BID',
        qty: '2',
      }),
    ]);
    expect(patch.services).toBeUndefined();
  });

  it('flags an artifact-sourced prescription line as billed from its medication treatment item', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      prescriptions: [
        {
          artifact: { id: 'artifact-1', kind: 'PRESCRIPTION', summary: 'Paracetamol' },
          prescription: {
            id: 'rx-1',
            items: [{ id: 'line-1', medication: 'Paracetamol', inventoryItemId: 'inv-9' }],
            medications: [{ medication: 'Paracetamol', inventoryItemId: 'inv-9' }],
          },
        },
      ],
      // The billed status lives on the medication treatment item and links to the artifact by
      // prescriptionId. Inventory id alone is not enough because the same drug can be prescribed
      // more than once.
      treatmentItems: [
        {
          id: 'ti-1',
          prescriptionId: 'rx-1',
          productId: 'inv-9',
          servicePackageKind: 'MEDICATION',
          name: 'Paracetamol',
          quantity: 1,
          billingStatus: 'BILLED',
        },
      ],
    });

    expect(patch.prescription).toEqual([expect.objectContaining({ id: 'line-1', billed: true })]);
  });

  it('does not mark a same-drug artifact prescription as billed without a prescription link', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      prescriptions: [
        {
          artifact: { id: 'artifact-2', kind: 'PRESCRIPTION', summary: 'Paracetamol repeat' },
          prescription: {
            id: 'rx-repeat',
            items: [{ id: 'line-repeat', medication: 'Paracetamol', inventoryItemId: 'inv-9' }],
          },
        },
      ],
      treatmentItems: [
        {
          id: 'ti-billed-other',
          prescriptionId: 'rx-original',
          productId: 'inv-9',
          servicePackageKind: 'MEDICATION',
          name: 'Paracetamol',
          quantity: 1,
          billingStatus: 'BILLED',
        },
      ],
    });

    expect(patch.prescription).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'line-repeat', billed: false })])
    );
  });

  it('keeps an artifact-sourced prescription line unbilled when no billed treatment item matches', () => {
    const patch = normalizeWorkspaceBootstrapForEncounter({
      prescriptions: [
        {
          artifact: { id: 'artifact-1', kind: 'PRESCRIPTION', summary: 'Paracetamol' },
          prescription: {
            id: 'rx-1',
            items: [{ id: 'line-1', medication: 'Paracetamol', inventoryItemId: 'inv-9' }],
          },
        },
      ],
      treatmentItems: [],
    });

    expect(patch.prescription).toEqual([expect.objectContaining({ id: 'line-1', billed: false })]);
  });

  it('reconciles a document packet and builds a packet PDF blob URL', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { packetId: 'packet-1', status: 'SIGNED' } });
    const packet = await reconcileWorkspaceDocumentPacket('org-1', 'packet-1');
    expect(postData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/document-packets/packet-1/reconcile',
      {}
    );
    expect(packet).toEqual({ packetId: 'packet-1', status: 'SIGNED' });

    const blob = new Blob(['pdf']);
    (api.get as jest.Mock).mockResolvedValue({ data: blob });
    const createObjectURL = jest.fn().mockReturnValue('blob:packet-pdf');
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });

    const url = await getEncounterDocumentPacketPdfUrl('org-1', 'enc-1');
    expect(api.get).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/document-packet/pdf',
      { responseType: 'blob' }
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(url).toBe('blob:packet-pdf');
  });

  describe('deletePrescriptionTreatmentItem', () => {
    it('returns false without calling the backend when the prescription has no ids', async () => {
      const deleted = await deletePrescriptionTreatmentItem('org-1', 'enc-1', {});
      expect(deleted).toBe(false);
      expect(getData).not.toHaveBeenCalled();
      expect(deleteData).not.toHaveBeenCalled();
    });

    it('deletes the unbilled treatment row matched by prescription id', async () => {
      (getData as jest.Mock).mockResolvedValue({
        data: [
          { id: 'ti-1', prescriptionId: 'rx-1', billingStatus: 'PENDING' },
          { id: 'ti-2', prescriptionId: 'rx-2' },
        ],
      });

      const deleted = await deletePrescriptionTreatmentItem('org-1', 'enc-1', { id: 'rx-1' });
      expect(deleted).toBe(true);
      expect(deleteData).toHaveBeenCalledWith(
        '/v1/workspace/organisations/org-1/treatment-items/ti-1'
      );
    });

    it('matches on inventory item id when no prescription id link exists', async () => {
      (getData as jest.Mock).mockResolvedValue({
        data: [{ id: 'ti-9', inventoryItemId: 'inv-9' }],
      });

      const deleted = await deletePrescriptionTreatmentItem('org-1', 'enc-1', {
        inventoryItemId: 'inv-9',
      });
      expect(deleted).toBe(true);
      expect(deleteData).toHaveBeenCalledWith(
        '/v1/workspace/organisations/org-1/treatment-items/ti-9'
      );
    });

    it('never deletes billed rows, whether flagged by boolean or status', async () => {
      (getData as jest.Mock).mockResolvedValue({
        data: [
          { id: 'ti-bool', prescriptionId: 'rx-1', billed: true },
          { id: 'ti-status', prescriptionId: 'rx-1', status: 'INVOICED' },
        ],
      });

      const deleted = await deletePrescriptionTreatmentItem('org-1', 'enc-1', { id: 'rx-1' });
      expect(deleted).toBe(false);
      expect(deleteData).not.toHaveBeenCalled();
    });

    it('returns false when the matched row has no backend id', async () => {
      (getData as jest.Mock).mockResolvedValue({
        data: [{ prescriptionId: 'rx-1' }],
      });

      const deleted = await deletePrescriptionTreatmentItem('org-1', 'enc-1', { id: 'rx-1' });
      expect(deleted).toBe(false);
      expect(deleteData).not.toHaveBeenCalled();
    });
  });

  it('persists a single treatment line via the create endpoint', async () => {
    await persistEncounterTreatmentLine('org-1', 'enc-1', {
      refId: 'svc-1',
      kind: 'SERVICE',
      name: 'Consultation',
      qty: 2,
      unitPriceCents: 4500,
    } as never);

    expect(postData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items',
      expect.objectContaining({
        productId: 'svc-1',
        servicePackageKind: 'SERVICE',
        quantity: 2,
        priceSnapshot: { unitPrice: 45 },
        productSnapshot: expect.objectContaining({ name: 'Consultation' }),
      })
    );
  });

  describe('normalization fallback branches', () => {
    it('resolves the outpatient mode from the appointment kind', () => {
      expect(
        normalizeWorkspaceBootstrapForEncounter({ appointment: { kind: 'OUTPATIENT' } }).mode
      ).toBe('OUTPATIENT');
      expect(
        normalizeWorkspaceBootstrapForEncounter({ encounter: { encounterClass: 'AMB' } }).mode
      ).toBe('OUTPATIENT');
      expect(normalizeWorkspaceBootstrapForEncounter({}).mode).toBeUndefined();
    });

    it('maps every diagnostic status vocabulary onto the workspace status', () => {
      const patch = normalizeWorkspaceBootstrapForEncounter({
        diagnosticQueue: [
          { id: 'd1', status: 'FINAL', createdAt: new Date('2026-01-01T00:00:00.000Z') },
          { id: 'd2', status: 'RUNNING' },
          { id: 'd3', status: 'AT_THE_LAB' },
          { status: 'weird' },
        ],
      });

      expect(patch.diagnosticOrders?.map((d) => d.status)).toEqual([
        'COMPLETED',
        'SUBMITTED',
        'SUBMITTED',
        'CREATED',
      ]);
      // Missing id/orderCode fall back to indexed placeholders; unparseable createdAt is stamped now.
      expect(patch.diagnosticOrders?.[3].id).toBe('diagnostic-4');
      expect(patch.diagnosticOrders?.[3].orderCode).toBe('DX-4');
    });

    it('picks the newest discharge summary and stringifies non-string summaries', () => {
      const patch = normalizeWorkspaceBootstrapForEncounter({
        clinicalArtifacts: [
          {
            artifact: {
              id: 'old',
              kind: 'DISCHARGE_SUMMARY',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            dischargeSummary: { summary: 'Old summary' },
          },
          {
            artifact: {
              id: 'new',
              kind: 'DISCHARGE_SUMMARY',
              updatedAt: '2026-02-01T00:00:00.000Z',
              signedBy: 'Dr B',
            },
            dischargeSummary: { summary: 42, followUp: '2026-02-10' },
          },
          { artifact: { id: 'soap', kind: 'SOAP' } },
        ],
      });

      expect(patch.dischargeSummaryId).toBe('new');
      expect(patch.dischargeSummary).toBe('42');
      expect(patch.followUpAt).toBe('2026-02-10');
      expect(patch.dischargeSavedByName).toBe('Dr B');
    });

    it('parses string boolean capability flags and ignores junk values', () => {
      const patch = normalizeWorkspaceBootstrapForEncounter({
        permissions: { canEditSoap: 'true', canPrescribe: 'false', canViewFinance: 'maybe' },
      });

      expect(patch.capabilities).toEqual({ canEditSoap: true, canPrescribe: false });
    });

    it('reads flat prescription payloads with quantity/duration fallbacks', () => {
      const patch = normalizeWorkspaceBootstrapForEncounter({
        prescriptions: [
          {
            id: 'rx-flat',
            name: 'Flatline',
            dosage: '5mg',
            duration: '7',
            quantity: '14',
            fulfillment: 'PRESCRIPTION_ONLY',
            priceSnapshot: { unitPrice: 12.5 },
          },
        ],
      });

      expect(patch.prescription).toEqual([
        expect.objectContaining({
          id: 'rx-flat',
          medicineName: 'Flatline',
          strength: '5mg',
          durationDays: '7',
          qty: '14',
          fulfillment: 'PRESCRIPTION_ONLY',
          priceCents: 1250,
        }),
      ]);
    });
  });
});
