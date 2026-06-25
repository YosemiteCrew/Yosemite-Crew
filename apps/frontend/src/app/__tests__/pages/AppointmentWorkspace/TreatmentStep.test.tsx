import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import TreatmentStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { savePrescriptionArtifact } from '@/app/features/appointments/services/workspaceClinicalService';
import { finalizePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';
import {
  applyInpatientScheduleTemplate,
  createWorkspaceTemplateInstance,
  listInpatientScheduleTemplates,
  pauseInpatientScheduleTemplate,
  cancelInpatientScheduleTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import {
  getAppointmentWorkspaceBootstrap,
  persistTreatmentItems,
} from '@/app/features/appointments/services/workspaceAggregateService';

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/features/inventory/services/dispensaryService', () => ({
  fetchPrescriptionLabelPdf: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  persistTreatmentItems: jest.fn().mockResolvedValue(undefined),
  getAppointmentWorkspaceBootstrap: jest.fn().mockResolvedValue({}),
  normalizeWorkspaceBootstrapForEncounter: jest.fn().mockReturnValue({}),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  savePrescriptionArtifact: jest.fn().mockResolvedValue({ resourceType: 'MedicationRequest' }),
}));

jest.mock('@/app/features/appointments/services/prescriptionWorkflowService', () => ({
  finalizePrescription: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  applyInpatientScheduleTemplate: jest.fn().mockResolvedValue({ resourceType: 'Task' }),
  createWorkspaceTemplateInstance: jest.fn().mockResolvedValue({ id: 'instance-1' }),
  listInpatientScheduleTemplates: jest.fn().mockResolvedValue([]),
  getInpatientScheduleForEncounter: jest
    .fn()
    .mockResolvedValue({ resourceType: 'Bundle', entry: [] }),
  pauseInpatientScheduleTemplate: jest.fn().mockResolvedValue({ resourceType: 'Task' }),
  resumeInpatientScheduleTemplate: jest.fn().mockResolvedValue({ resourceType: 'Task' }),
  cancelInpatientScheduleTemplate: jest.fn().mockResolvedValue({ resourceType: 'Task' }),
  regenerateInpatientScheduleTemplate: jest.fn().mockResolvedValue({ resourceType: 'Task' }),
  resolvePrescriptionTemplate: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  loadTasksForPrimaryOrg: jest.fn().mockResolvedValue(undefined),
  changeTaskStatus: jest.fn().mockResolvedValue(undefined),
  updateTask: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useLoadTeam: jest.fn(),
  useTeamForPrimaryOrg: jest.fn().mockReturnValue([
    { _id: 'usr-sarah', practionerId: 'usr-sarah', name: 'Sarah Mitchell', status: 'Available' },
    { _id: 'usr-tim', practionerId: 'usr-tim', name: 'Dr. Tim Apple', status: 'Available' },
  ]),
}));

expect.extend(toHaveNoViolations);

const APPT = 'appt-treatment';
const ORG = 'org-treatment';

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'TREATMENT',
    activeSideAction: null,
  });

const resetInventory = () =>
  useInventoryStore.setState({
    itemsById: {},
    itemIdsByOrgId: {},
    turnoverByOrgId: {},
    statusByOrgId: {},
    errorByOrgId: {},
    lastFetchedByOrgId: {},
  });

const resetCatalog = () =>
  useRevampCatalogStore.setState({
    specialities: [
      {
        id: 'spec-treatment',
        name: 'Rehabilitation',
        organisationId: ORG,
        teamMemberIds: [],
      },
    ],
    services: [
      {
        id: 'svc-physical-exam',
        code: 'CS-0001',
        name: 'Physical examination',
        description: 'Assess mobility and pain response',
        type: 'CONSULTATION',
        specialityId: 'spec-treatment',
        organisationId: ORG,
        grossAmount: 85,
        defaultDiscount: 0,
        maxDiscount: 100,
        durationMinutes: 30,
        isBookable: true,
        isInpatientPreferred: false,
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ],
    packages: [
      {
        id: 'pkg-arthritis-care',
        code: 'PK-0001',
        name: 'Arthritis care package',
        description: 'Includes exam, injection and follow-up',
        specialityId: 'spec-treatment',
        organisationId: ORG,
        durationText: 'Approx. 30 mins',
        isBookable: true,
        isInpatientPreferred: false,
        currency: 'USD',
        leadCount: 1,
        supportCount: 0,
        additionalDiscount: 0,
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00.000Z',
        breakdown: [
          {
            id: 'pkg-bd-1',
            childItemId: 'svc-mobility',
            type: 'CONSULTATION',
            name: 'Mobility exam',
            unitPrice: 85,
            quantity: 1,
            discount: 0,
          },
          {
            id: 'pkg-bd-2',
            childItemId: 'svc-injection',
            type: 'PROCEDURE',
            name: 'SC Injection',
            unitPrice: 70,
            quantity: 1,
            discount: 0,
          },
        ],
      },
    ],
    status: 'ready',
    loadedSpecialityIds: ['spec-treatment:active'],
  });

const inventoryItem = (id: string, name: string, category = 'Medicine'): InventoryItem => ({
  id,
  organisationId: ORG,
  basicInfo: {
    name,
    category,
    subCategory: '',
    department: '',
    description: '',
    status: 'Active',
  },
  classification: {},
  pricing: { selling: '12.5' },
  vendor: { supplierName: '', brand: '', vendor: '', license: '', paymentTerms: '' },
  stock: {
    current: '14',
    allocated: '2',
    available: '12',
    reorderLevel: '5',
    reorderQuantity: '',
    stockLocation: '',
  },
  batch: { batch: '', manufactureDate: '', expiryDate: '' },
});

const seedPrescriptionInventory = () => {
  useInventoryStore
    .getState()
    .setInventoryForOrg(ORG, [
      inventoryItem('inv-gaba', 'Gabapentin'),
      inventoryItem('inv-carp', 'Carprofen'),
    ]);
};

const seedAndGet = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, mode);
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: {
      ...state.encountersById,
      [APPT]: {
        ...state.encountersById[APPT],
        services: [
          {
            id: 'li-1',
            refId: 'svc-cerenia',
            kind: 'PACKAGE',
            name: 'SC Injection - Cerenia 0.5ml',
            qty: 1,
            instructions: "Don't give bath for 2 days, wash wound post",
            unitPriceCents: 10000,
            amountCents: 10000,
            breakdown: [
              { id: 'bd-1', name: 'Syringe', qty: 2, instructions: '-', amountCents: 1500 },
              {
                id: 'bd-2',
                name: 'Cerenia (injectable medicine)',
                qty: 1,
                instructions: '-',
                amountCents: 4500,
              },
            ],
          },
          {
            id: 'li-2',
            refId: 'svc-acupuncture',
            kind: 'SERVICE',
            name: 'Acupuncture',
            qty: 1,
            instructions: '-',
            unitPriceCents: 13500,
            amountCents: 13500,
          },
        ],
        prescription: [
          {
            id: 'rx-1',
            medicineName: 'Amoxicillin - 625',
            dosage: '1 tab',
            route: 'Oral',
            frequency: 'BID',
            durationDays: '5 days',
            refill: 'x 2',
            instructions: 'Do not skip dosage',
            fulfillment: 'IN_HOUSE',
            priceCents: 16500,
            stockQty: 14,
          },
          {
            id: 'rx-2',
            medicineName: 'Prednisone',
            dosage: '10mg',
            route: 'Oral',
            frequency: 'QD',
            durationDays: '5 days',
            refill: 'x 1',
            instructions: 'Morning with food',
            fulfillment: 'IN_HOUSE',
            priceCents: 9000,
            stockQty: 3,
            lowStock: true,
          },
        ],
        schedule:
          mode === 'INPATIENT'
            ? [
                {
                  id: 'sch-1',
                  time: '10:00 AM',
                  description: 'Record observation for analgesic',
                  category: 'Record',
                  assignedToName: 'Sarah Mitchell',
                  status: 'COMPLETED',
                  autoGenerated: true,
                },
                {
                  id: 'sch-2',
                  time: '12:00 PM',
                  description: 'Feed patient meal',
                  category: 'Care',
                  assignedToName: 'Sarah Mitchell',
                  status: 'UPCOMING',
                  autoGenerated: false,
                },
              ]
            : [],
      },
    },
  }));
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

describe('TreatmentStep', () => {
  beforeEach(() => {
    reset();
    resetInventory();
    resetCatalog();
    seedPrescriptionInventory();
    (savePrescriptionArtifact as jest.Mock).mockClear();
    (savePrescriptionArtifact as jest.Mock).mockResolvedValue({
      resourceType: 'MedicationRequest',
    });
    (finalizePrescription as jest.Mock).mockClear();
    (finalizePrescription as jest.Mock).mockResolvedValue({});
    (applyInpatientScheduleTemplate as jest.Mock).mockClear();
    (createWorkspaceTemplateInstance as jest.Mock).mockClear();
    (listInpatientScheduleTemplates as jest.Mock).mockClear();
    (loadTasksForPrimaryOrg as jest.Mock).mockClear();
    (persistTreatmentItems as jest.Mock).mockClear();
    (persistTreatmentItems as jest.Mock).mockResolvedValue(undefined);
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockClear();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({});
    (applyInpatientScheduleTemplate as jest.Mock).mockResolvedValue({ resourceType: 'Task' });
    (createWorkspaceTemplateInstance as jest.Mock).mockResolvedValue({ id: 'instance-1' });
    (listInpatientScheduleTemplates as jest.Mock).mockResolvedValue([]);
    (loadTasksForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
  });

  it('filters service and medication add lists', () => {
    const enc = seedAndGet();
    seedPrescriptionInventory();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'arthritis' },
    });
    expect(screen.queryByRole('button', { name: /physical examination/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arthritis care package/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search medicines/i), {
      target: { value: 'carprofen' },
    });
    expect(screen.queryByRole('button', { name: /gabapentin/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /carprofen/i })).toBeInTheDocument();
  });

  it('renders services, packages and prescription sections', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('Services & Packages')).toBeInTheDocument();
    expect(screen.getAllByText('Prescription').length).toBeGreaterThan(0);
    expect(screen.getByText(/SC Injection - Cerenia 0\.5ml/)).toBeInTheDocument();
    expect(screen.getByText(/Amoxicillin - 625/)).toBeInTheDocument();
  });

  it('renders Rx badges, stock-health pills and numbered medication rows', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Each prescription row has a numbered name + an Rx badge.
    expect(screen.getByText(/^1\. Amoxicillin - 625$/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Prescription').length).toBeGreaterThan(0);
    // Stock health pills: Amoxicillin (14) in stock, Prednisone (3) low stock.
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    // Each row shows the line price at the right end and a Refill field.
    expect(screen.getByText('$165')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Refill').length).toBeGreaterThan(0);
    // Fulfillment is a pill dropdown (not checkboxes), defaulting to the value.
    expect(screen.getAllByRole('combobox', { name: /fulfillment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('In-house fulfilled').length).toBeGreaterThan(0);
    // The old "Medication" tag no longer appears on the cards.
    expect(screen.queryByText('Medication')).not.toBeInTheDocument();
  });

  it('adds and removes services from the workspace store', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    // Adding is search-driven: type to surface the result, then click it.
    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'physical' },
    });
    fireEvent.click(screen.getByRole('button', { name: /physical examination/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.services.at(-1)?.name).toBe(
      'Physical examination'
    );

    fireEvent.click(screen.getByRole('button', { name: /remove acupuncture/i }));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.services.find((item) => item.name === 'Acupuncture')
    ).toBeUndefined();
  });

  it('edits a service quantity and re-derives the amount', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    const first = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.services[0];
    const qtyInput = screen.getByLabelText(`Quantity for ${first.name}`);
    fireEvent.change(qtyInput, { target: { value: '3' } });
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.services[0];
    expect(updated.qty).toBe(3);
    expect(updated.amountCents).toBe(first.unitPriceCents * 3);
  });

  it('adds items purely from the search results (no click-to-add box)', () => {
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    // The dashed "click to search and add" boxes are gone — adding is search-only.
    expect(screen.queryByText(/click to search and add/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'physical' },
    });
    fireEvent.click(screen.getByRole('button', { name: /physical examination/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.services.at(-1)?.name).toBe(
      'Physical examination'
    );
  });

  it('expands package breakdown using the dark view action', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: /view sc injection - cerenia 0.5ml breakdown/i })
    );

    expect(screen.getByText('Syringe')).toBeInTheDocument();
    expect(screen.getByText('Cerenia (injectable medicine)')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /hide sc injection - cerenia 0.5ml breakdown/i })
    );
    expect(screen.queryByText('Syringe')).not.toBeInTheDocument();
  });

  it('copies service and prescription row values', () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The service name copy icon was removed; only the instructions remain copyable.
    fireEvent.click(screen.getByRole('button', { name: /copy instructions for acupuncture/i }));
    // The medication instructions field has its own inline copy button ("Copy
    // instructions", with no "for <name>" suffix).
    fireEvent.click(screen.getAllByRole('button', { name: /^copy instructions$/i })[0]);

    // Service + medication instructions are copy-able; the medication instructions
    // copy icon copies the first prescription's instruction text.
    expect(writeText).toHaveBeenCalledWith('Do not skip dosage');
  });

  it('adds prescriptions, updates fulfillment and removes medication', async () => {
    const seeded = seedAndGet();
    seedPrescriptionInventory();
    // Work with only the un-billed (editable) prescriptions for this flow.
    const enc = { ...seeded, prescription: seeded.prescription.filter((p) => !p.billed) };
    useAppointmentWorkspaceStore.setState((s) => ({
      encountersById: { ...s.encountersById, [APPT]: enc },
    }));
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    // Adding is search-driven: type to surface the medication, then click it.
    fireEvent.change(screen.getByLabelText(/search medicines/i), {
      target: { value: 'gabapentin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gabapentin/i }));
    // Adding stages the row locally only — it must NOT persist on add (that previously dropped
    // dosage/route/qty before the clinician filled them). Persisting happens on Save treatment.
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription.at(-1)
          ?.medicineName
      ).toBe('Gabapentin')
    );
    expect(savePrescriptionArtifact).not.toHaveBeenCalled();

    // Fulfillment is a compact pill dropdown: open it, then pick the option.
    fireEvent.change(screen.getAllByRole('combobox', { name: /fulfillment/i })[0], {
      target: { value: 'PRESCRIPTION_ONLY' },
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].fulfillment
    ).toBe('PRESCRIPTION_ONLY');

    fireEvent.click(screen.getByRole('button', { name: /remove prednisone/i }));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.prescription.find((item) => item.medicineName === 'Prednisone')
    ).toBeUndefined();
  });

  it('renders empty editable inputs for incomplete medication rows', () => {
    const enc = {
      ...seedAndGet(),
      prescription: [
        { id: 'rx-min', medicineName: 'Minimal med', fulfillment: 'IN_HOUSE' as const },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText(/Minimal med/)).toBeInTheDocument();
    // The editable cells (dose/route/freq/duration/refill/instructions) render as
    // empty floating-label input boxes for a row that has no values yet.
    expect((screen.getByLabelText('Strength') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Duration') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Instructions') as HTMLInputElement).value).toBe('');
  });

  it('edits a prescription field through the floating-label input', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    const dosageInputs = screen.getAllByLabelText('Strength');
    fireEvent.change(dosageInputs[0], { target: { value: '250mg' } });
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].dosage).toBe(
      '250mg'
    );
  });

  it('prints a label PDF for each saved prescription', async () => {
    const labelBlob = new Blob(['pdf'], { type: 'application/pdf' });
    (fetchPrescriptionLabelPdf as jest.Mock).mockResolvedValue(labelBlob);
    const openSpy = jest
      .spyOn(window, 'open')
      .mockReturnValue({ focus: jest.fn() } as unknown as Window);
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:label');
    window.URL.revokeObjectURL = jest.fn();
    const enc = seedAndGet();
    const printableIds = enc.prescription.filter((rx) => rx.id).map((rx) => rx.id);
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /print labels/i })[0]);

    await waitFor(() =>
      expect(fetchPrescriptionLabelPdf).toHaveBeenCalledTimes(printableIds.length)
    );
    printableIds.forEach((id) => expect(fetchPrescriptionLabelPdf).toHaveBeenCalledWith(ORG, id));
    expect(openSpy).toHaveBeenCalledWith('blob:label', '_blank');

    openSpy.mockRestore();
  });

  it('shows an error when there are no saved prescriptions to print', async () => {
    const enc = { ...seedAndGet(), prescription: [] };
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /print labels/i })[0]);

    expect(await screen.findByText(/save the treatment before printing/i)).toBeInTheDocument();
    expect(fetchPrescriptionLabelPdf).not.toHaveBeenCalled();
  });

  it('completes treatment and opens the invoice', () => {
    const onOpenInvoice = jest.fn();
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={onOpenInvoice} />);

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(onOpenInvoice).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
  });

  it('does not fetch a label when no organisation is available', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /print labels/i })[0]);

    expect(fetchPrescriptionLabelPdf).not.toHaveBeenCalled();
  });

  it('surfaces an error when label printing fails', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (fetchPrescriptionLabelPdf as jest.Mock).mockRejectedValue(new Error('boom'));
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:err');
    window.URL.revokeObjectURL = jest.fn();
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /print labels/i })[0]);

    expect(await screen.findByText(/unable to print prescription labels/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('persists staged treatment items, rehydrates, then opens the invoice', async () => {
    const onOpenInvoice = jest.fn();
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={onOpenInvoice}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    await waitFor(() => expect(onOpenInvoice).toHaveBeenCalled());
    expect(persistTreatmentItems).toHaveBeenCalledWith(ORG, 'enc-1', enc.services);
    expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith(ORG, APPT);
    expect(finalizePrescription).toHaveBeenCalledWith(ORG, 'rx-1');
    expect(finalizePrescription).toHaveBeenCalledWith(ORG, 'rx-2');
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
  });

  it('blocks the invoice and shows an error when treatment persistence fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (persistTreatmentItems as jest.Mock).mockRejectedValueOnce(new Error('save failed'));
    const onOpenInvoice = jest.fn();
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={onOpenInvoice}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save treatment items');
    expect(onOpenInvoice).not.toHaveBeenCalled();
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT
    ).not.toBe('COMPLETED');
    errorSpy.mockRestore();
  });

  it('renders inpatient schedule and adds a manual task', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule.length;
    fireEvent.click(screen.getByRole('button', { name: /add schedule task/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule).toHaveLength(
      before + 1
    );
  });

  it('navigates schedule days and filters tasks by the selected day', () => {
    const todayString = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const enc = seedAndGet('INPATIENT');
    // A task scoped to today should appear on the default day and disappear when
    // navigating away — exercising the real day-window filter.
    const datedEncounter = {
      ...enc,
      schedule: [
        {
          id: 'sch-today',
          time: '09:00 AM',
          description: 'Day-scoped observation',
          category: 'Record' as const,
          assignedToName: 'Sarah Mitchell',
          status: 'UPCOMING' as const,
          autoGenerated: false,
          startDate: todayString,
          endDate: todayString,
        },
      ],
    };
    render(
      <TreatmentStep appointmentId={APPT} encounter={datedEncounter} onOpenInvoice={jest.fn()} />
    );

    // Header shows today's date, not a hardcoded value.
    expect(screen.getByText(`Today ${todayString}`)).toBeInTheDocument();
    expect(screen.getByText('Day-scoped observation')).toBeInTheDocument();

    // Moving to the next day hides the day-scoped task...
    fireEvent.click(screen.getByRole('button', { name: /next day/i }));
    expect(screen.queryByText('Day-scoped observation')).not.toBeInTheDocument();
    expect(screen.getByText('No schedule tasks for this day.')).toBeInTheDocument();

    // ...and returning to today shows it again.
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    expect(screen.getByText('Day-scoped observation')).toBeInTheDocument();
  });

  it('applies an inpatient schedule template and refreshes tasks', async () => {
    (listInpatientScheduleTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-care',
        name: 'Post-op care pathway',
        kind: 'INPATIENT_SCHEDULE',
        status: 'PUBLISHED',
      },
    ]);
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        authorId="user-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /load schedule template/i }));
    fireEvent.click(screen.getByRole('button', { name: /post-op care pathway/i }));

    await waitFor(() =>
      expect(createWorkspaceTemplateInstance).toHaveBeenCalledWith(ORG, 'tpl-care', {
        appointmentId: APPT,
        encounterId: 'enc-1',
        authorId: 'user-1',
        data: {},
        status: 'DRAFT',
      })
    );
    expect(applyInpatientScheduleTemplate).toHaveBeenCalledWith(ORG, 'instance-1', {
      force: true,
      notify: false,
    });
    expect(loadTasksForPrimaryOrg).toHaveBeenCalledWith({ force: true, silent: true });
  });

  it('exposes schedule lifecycle controls after applying a template and pauses via backend', async () => {
    (listInpatientScheduleTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-care',
        name: 'Post-op care pathway',
        kind: 'INPATIENT_SCHEDULE',
        status: 'PUBLISHED',
      },
    ]);
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        authorId="user-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    // No lifecycle controls until a schedule instance is applied.
    expect(screen.queryByRole('button', { name: /^pause$/i })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /load schedule template/i }));
    fireEvent.click(screen.getByRole('button', { name: /post-op care pathway/i }));
    await waitFor(() => expect(applyInpatientScheduleTemplate).toHaveBeenCalled());

    // Controls now appear; pausing calls the backend and refreshes tasks.
    const pauseBtn = await screen.findByRole('button', { name: /^pause$/i });
    fireEvent.click(pauseBtn);
    await waitFor(() =>
      expect(pauseInpatientScheduleTemplate).toHaveBeenCalledWith(ORG, 'instance-1', {
        notify: false,
      })
    );
    // After pausing, the control flips to Resume.
    expect(await screen.findByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('cancels an applied schedule and hides the lifecycle controls', async () => {
    (listInpatientScheduleTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-care',
        name: 'Post-op care pathway',
        kind: 'INPATIENT_SCHEDULE',
        status: 'PUBLISHED',
      },
    ]);
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        authorId="user-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: /load schedule template/i }));
    fireEvent.click(screen.getByRole('button', { name: /post-op care pathway/i }));
    await waitFor(() => expect(applyInpatientScheduleTemplate).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /cancel schedule/i }));
    await waitFor(() =>
      expect(cancelInpatientScheduleTemplate).toHaveBeenCalledWith(ORG, 'instance-1', {
        notify: false,
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /cancel schedule/i })).not.toBeInTheDocument()
    );
  });

  it('reschedule expands the row so the real time picker is used', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Collapse the (initially expanded) first row, then Reschedule should re-open it
    // — revealing the breakdown's real Set Time picker instead of writing a fake time.
    fireEvent.click(screen.getByRole('button', { name: /hide record observation for analgesic/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /reschedule record observation for analgesic/i })
    );

    expect(
      screen.getByRole('button', { name: /hide record observation for analgesic/i })
    ).toBeInTheDocument();
    // The stored time is untouched by Reschedule itself.
    const task = useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0];
    expect(task?.time).toBe('10:00 AM');
  });

  it('uses inpatient schedule dropdowns, day controls and status pill', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Header day navigation is present and clickable.
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    fireEvent.click(screen.getByRole('button', { name: /next day/i }));
    // The first row is expanded by default, exposing the breakdown Record button.
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    // Assign the first task via its Assigned-to dropdown.
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].assignedToName
    ).toBe('Dr. Tim Apple');

    // The status pill only renders for changeable (non-completed) tasks. Change
    // the first such task to Pending.
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    const changeableIndex = before.findIndex((t) => t.status !== 'COMPLETED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Pending' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[changeableIndex].status
    ).toBe('PENDING');
  });

  it('locks the status of completed schedule tasks (no caret, not changeable)', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The mock schedule has a COMPLETED task; its status renders as a static pill
    // (a "Completed" label that is not a Status dropdown button).
    expect(screen.getByText('Completed')).toBeInTheDocument();
    const statusButtons = screen.getAllByRole('button', { name: 'Status' });
    const completedCount = enc.schedule.filter((t) => t.status === 'COMPLETED').length;
    const changeableCount = enc.schedule.filter((t) => t.status !== 'COMPLETED').length;
    expect(completedCount).toBeGreaterThan(0);
    expect(statusButtons).toHaveLength(changeableCount);
  });

  it('updates the task start date and time through the shared pickers', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Open the Starts datepicker and pick a day -> updates the task's startDate.
    fireEvent.click(screen.getByRole('button', { name: /^Starts, toggle calendar$/i }));
    const dayCells = document.querySelectorAll(
      '.react-datepicker__day:not(.react-datepicker__day--outside-month)'
    );
    fireEvent.click(dayCells[10]);
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].startDate
    ).toMatch(/\d{4}/);

    // Open the Set Time picker and pick a time -> updates the task's time (12h).
    fireEvent.click(screen.getByRole('button', { name: /Set Time/i }));
    const timeCells = document.querySelectorAll('.react-datepicker__time-list-item');
    fireEvent.click(timeCells[3]);
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].time).toMatch(
      /(AM|PM)/
    );
  });

  it('reuses the shared date and time pickers in the task breakdown', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The first row is expanded by default; the breakdown reuses the shared
    // Datepicker (Starts/Ends) and Timepicker (Set Time). The first task's time
    // (10:00 AM) is shown in 24-hour form by the Timepicker.
    expect(screen.getByRole('button', { name: /^Starts, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ends, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set Time: 10:00/i })).toBeInTheDocument();
  });

  it('filters inpatient schedule tasks to an empty state', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/search schedule tasks/i), {
      target: { value: 'not in schedule' },
    });

    expect(screen.getByText('No schedule tasks match this search.')).toBeInTheDocument();
  });

  it('renders empty date/time pickers for a task with no time or dates', () => {
    const enc = {
      ...seedAndGet('INPATIENT'),
      schedule: [
        {
          id: 'sch-min',
          description: 'Bare task',
          category: 'Care' as const,
          status: 'UPCOMING' as const,
          autoGenerated: false,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The row is expanded by default; the pickers render empty (label-only) with
    // no pre-filled value.
    expect(screen.getByRole('button', { name: /^Starts, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ends, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Time' })).toBeInTheDocument();
  });

  it('shows empty states when there are no services or prescriptions', () => {
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('No services or packages added yet.')).toBeInTheDocument();
    expect(screen.getByText('No prescription items added yet.')).toBeInTheDocument();
  });

  it('prints labels from the bottom Prescription button', async () => {
    (fetchPrescriptionLabelPdf as jest.Mock).mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' })
    );
    const openSpy = jest
      .spyOn(window, 'open')
      .mockReturnValue({ focus: jest.fn() } as unknown as Window);
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:icon');
    window.URL.revokeObjectURL = jest.fn();
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        organisationId={ORG}
        encounterId="enc-1"
        encounter={enc}
        onOpenInvoice={jest.fn()}
      />
    );

    // The bottom "Print Labels" button shares the label-print handler.
    const buttons = screen.getAllByRole('button', { name: /print labels/i });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(fetchPrescriptionLabelPdf).toHaveBeenCalledWith(ORG, 'rx-1'));
    openSpy.mockRestore();
  });

  it('renders read-only treatment sections without editing affordances', () => {
    const enc = { ...seedAndGet('INPATIENT'), viewOnly: true };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The "click to search and add" dashed containers are hidden in view-only mode.
    expect(screen.queryByText(/click to search and add service/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click to search and add medication/i)).not.toBeInTheDocument();
    // Prescription fields keep the floating-label input style but are read-only.
    const dosage = screen.getAllByLabelText('Strength')[0] as HTMLInputElement;
    expect(dosage).toHaveAttribute('readonly');
    expect(dosage.value).toBe('1 tab');
    // Schedule Add control and the breakdown Record button are disabled.
    expect(screen.getByRole('button', { name: /add schedule task/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Record$/i })).toBeDisabled();
  });

  it('locks destructive treatment removal once ready for billing', () => {
    const enc = { ...seedAndGet(), readyForBilling: { value: true } };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Un-billed items keep their delete control but it is disabled once ready for
    // billing (billed items have no delete control at all).
    expect(screen.getByLabelText(/remove acupuncture/i)).toBeDisabled();
    expect(screen.getByLabelText(/remove prednisone/i)).toBeDisabled();
    expect(screen.getByLabelText(/search for services and packages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search medicines/i)).toBeInTheDocument();
  });

  it('locks a billed line item (badge + read-only + no delete) while keeping others editable', () => {
    const enc = {
      ...seedAndGet(),
      prescription: [],
      services: [
        {
          id: 'li-billed',
          refId: 'svc-x',
          kind: 'SERVICE' as const,
          name: 'Consultation',
          qty: 1,
          instructions: 'Initial',
          unitPriceCents: 8500,
          amountCents: 8500,
          billed: true,
        },
        {
          id: 'li-live',
          refId: 'svc-y',
          kind: 'SERVICE' as const,
          name: 'Acupuncture',
          qty: 1,
          instructions: '-',
          unitPriceCents: 13500,
          amountCents: 13500,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The billed item shows a "Billed" badge, has no delete and no editable qty.
    expect(screen.getByText('Billed')).toBeInTheDocument();
    expect(screen.queryByLabelText(/remove consultation/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/quantity for consultation/i)).not.toBeInTheDocument();

    // The un-billed item stays fully editable (delete + qty input present).
    expect(screen.getByLabelText(/remove acupuncture/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity for acupuncture/i)).toBeInTheDocument();
  });

  it('always shows the search/add boxes so new items can be added alongside billed ones', () => {
    const enc = {
      ...seedAndGet(),
      services: [
        {
          id: 'li-billed',
          refId: 'svc-x',
          kind: 'SERVICE' as const,
          name: 'Consultation',
          qty: 1,
          unitPriceCents: 8500,
          amountCents: 8500,
          billed: true,
        },
      ],
      prescription: [
        {
          id: 'rx-billed',
          medicineName: 'Amoxicillin - 625',
          fulfillment: 'IN_HOUSE' as const,
          billed: true,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Adding stays available even though every existing item is billed/locked.
    expect(screen.getByLabelText(/search for services and packages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search medicines/i)).toBeInTheDocument();
    // Both the billed service and billed prescription show the badge and are
    // read-only (no delete control).
    expect(screen.getAllByText('Billed')).toHaveLength(2);
    expect(screen.queryByLabelText(/remove amoxicillin/i)).not.toBeInTheDocument();
  });

  it('does not render an in-step Skip to Summary button (it lives in the meta bar)', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /skip to summary/i })).not.toBeInTheDocument();
  });

  it('saves the treatment, completing the step and opening the invoice', () => {
    const enc = seedAndGet();
    const onOpenInvoice = jest.fn();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={onOpenInvoice} />);

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(onOpenInvoice).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
