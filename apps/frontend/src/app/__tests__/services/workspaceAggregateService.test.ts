import {
  createEncounterDocumentPacket,
  createEncounterTreatmentItem,
  deleteEncounterTreatmentItem,
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
import { deleteData, getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
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
        readyForDischargeByName: 'Dr Discharge',
        readyForDischargeAt: '2026-06-18T10:05:00.000Z',
        admission: {
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
    expect(patch.unitId).toBe('unit-1');
    expect(patch.admittedAt).toBe('2026-06-18T08:30:00.000Z');
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
        readyForBillingAt: '2026-06-18T11:05:00.000Z',
      },
    });
    expect(patch.readyForBilling?.value).toBe(true);
    expect(patch.readyForBilling?.byName).toBe('Front Desk');
    expect(patch.readyForBilling?.at).toBe('2026-06-18T11:05:00.000Z');
    // Discharge is not implied by billing.
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
                dosage: '75mg',
                route: 'PO',
                frequency: 'BID',
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
        dosage: '75mg',
        route: 'PO',
        frequency: 'BID',
      }),
    ]);
    expect(patch.services).toBeUndefined();
  });
});
