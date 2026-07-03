import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import TreatmentStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useTaskStore } from '@/app/stores/taskStore';
import type { Task } from '@/app/features/tasks/types/task';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  deletePrescriptionArtifact,
  savePrescriptionArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import { finalizePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { fetchPrescriptionLabelPdf } from '@/app/features/inventory/services/dispensaryService';
import {
  listScheduleTaskTemplates,
  listPrescriptionTemplatesForWorkspace,
  resolveScheduleTasksFromTemplate,
  resolvePrescriptionTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import {
  changeTaskStatus,
  createTask,
  loadTasksForPrimaryOrg,
  updateTask,
} from '@/app/features/tasks/services/taskService';
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
  deletePrescriptionTreatmentItem: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  savePrescriptionArtifact: jest.fn().mockResolvedValue({ resourceType: 'MedicationRequest' }),
  deletePrescriptionArtifact: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/app/features/appointments/services/prescriptionWorkflowService', () => ({
  finalizePrescription: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listScheduleTaskTemplates: jest.fn().mockResolvedValue([]),
  resolveScheduleTasksFromTemplate: jest.fn().mockResolvedValue([]),
  listPrescriptionTemplatesForWorkspace: jest.fn().mockResolvedValue([]),
  getInpatientScheduleForEncounter: jest
    .fn()
    .mockResolvedValue({ resourceType: 'Bundle', entry: [] }),
  resolvePrescriptionTemplate: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  loadTasksForPrimaryOrg: jest.fn().mockResolvedValue(undefined),
  changeTaskStatus: jest.fn().mockResolvedValue(undefined),
  updateTask: jest.fn().mockResolvedValue(undefined),
  createTask: jest.fn().mockResolvedValue({ _id: 'new-task' }),
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
            strength: '625',
            strengthUnit: 'mg',
            dosageForm: 'Tablet',
            route: 'Oral',
            frequency: 'BID (twice daily)',
            durationDays: '5',
            durationUnit: 'days',
            qty: '10',
            refill: '2',
            instructions: 'Do not skip dosage',
            fulfillment: 'IN_HOUSE',
            priceCents: 16500,
            stockQty: 14,
          },
          {
            id: 'rx-2',
            medicineName: 'Prednisone',
            strength: '10',
            strengthUnit: 'mg',
            dosageForm: 'Tablet',
            route: 'Oral',
            frequency: 'SID (once daily)',
            durationDays: '5',
            durationUnit: 'days',
            qty: '5',
            refill: '1',
            instructions: 'Morning with food',
            fulfillment: 'IN_HOUSE',
            priceCents: 9000,
            stockQty: 3,
            lowStock: true,
          },
        ],
        schedule: [],
      },
    },
  }));
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

// Schedule tasks now derive from the task store (single source of truth). Seed the
// equivalent real employee tasks so the timeline renders them exactly as it would
// after a backend load. Returns the derived ScheduleTask ids for assertions.
const buildTask = (over: Partial<Task>): Task =>
  ({
    _id: 'task-x',
    organisationId: ORG,
    appointmentId: APPT,
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'RECORD',
    name: 'Task',
    status: 'PENDING',
    ...over,
  }) as Task;

const seedScheduleTasks = () => {
  useTaskStore.getState().setTasksForOrg(ORG, [
    // No dueAt → undated rows always show (day-window filtering is exercised by its
    // own test), so these tests focus purely on view/assign/status behaviour.
    buildTask({
      _id: 'task-1',
      name: 'Record observation for analgesic',
      category: 'RECORD',
      assignedTo: 'member-1',
      status: 'COMPLETED',
      source: 'ORG_TEMPLATE',
    }),
    buildTask({
      _id: 'task-2',
      name: 'Feed patient meal',
      category: 'CARE',
      assignedTo: 'member-1',
      status: 'IN_PROGRESS',
    }),
  ]);
};

const resetTasks = () => useTaskStore.setState({ tasksById: {}, taskIdsByOrgId: {} });

describe('TreatmentStep', () => {
  beforeEach(() => {
    reset();
    resetTasks();
    resetInventory();
    resetCatalog();
    seedPrescriptionInventory();
    (savePrescriptionArtifact as jest.Mock).mockClear();
    // Echo back the saved artifact id (mirrors the create/update response) so finalize targets
    // the real id and the save handler does not append a duplicate local row.
    (savePrescriptionArtifact as jest.Mock).mockImplementation((_ctx, rx) =>
      Promise.resolve({ resourceType: 'MedicationRequest', id: rx.id })
    );
    (finalizePrescription as jest.Mock).mockClear();
    (finalizePrescription as jest.Mock).mockResolvedValue({});
    (listScheduleTaskTemplates as jest.Mock).mockClear();
    (resolveScheduleTasksFromTemplate as jest.Mock).mockClear();
    (listPrescriptionTemplatesForWorkspace as jest.Mock).mockClear();
    (resolvePrescriptionTemplate as jest.Mock).mockClear();
    (loadTasksForPrimaryOrg as jest.Mock).mockClear();
    (persistTreatmentItems as jest.Mock).mockClear();
    (persistTreatmentItems as jest.Mock).mockResolvedValue(undefined);
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockClear();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({});
    (listScheduleTaskTemplates as jest.Mock).mockResolvedValue([]);
    (resolveScheduleTasksFromTemplate as jest.Mock).mockResolvedValue([]);
    (listPrescriptionTemplatesForWorkspace as jest.Mock).mockResolvedValue([]);
    (resolvePrescriptionTemplate as jest.Mock).mockResolvedValue([]);
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

    expect(screen.getByText('Additional services & packages')).toBeInTheDocument();
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
    expect(screen.getAllByLabelText('Refills').length).toBeGreaterThan(0);
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

  it('adds prescription template rows without replacing existing or duplicating medications', async () => {
    (listPrescriptionTemplatesForWorkspace as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-otitis',
        name: 'Otitis prescription',
        items: [
          {
            inventoryItemId: 'inv-existing',
            medicineName: 'Existing med',
            dosageForm: 'Capsule',
            route: 'Oral',
            frequency: 'SID (once daily)',
            durationDays: '4',
            durationUnit: 'days',
            qty: '4',
            refill: '0',
            instructions: 'Template duplicate should be skipped',
            fulfillment: 'IN_HOUSE',
          },
          {
            inventoryItemId: 'inv-otic',
            medicineName: 'Otic drops',
            dosageForm: 'Drops',
            route: 'Otic',
            frequency: 'BID (twice daily)',
            durationDays: '7',
            durationUnit: 'days',
            qty: '1',
            refill: '0',
            instructions: 'Apply after cleaning',
            fulfillment: 'IN_HOUSE',
          },
        ],
      },
    ]);
    const existingPrescription = {
      id: 'rx-existing',
      medicineName: 'Existing med',
      dosageForm: 'Capsule',
      route: 'Oral',
      frequency: 'SID (once daily)',
      durationDays: '4',
      durationUnit: 'days',
      qty: '4',
      refill: '0',
      instructions: 'Keep current clinician directions',
      fulfillment: 'IN_HOUSE' as const,
    };
    const enc = { ...seedAndGet(), prescription: [existingPrescription] };
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

    await waitFor(() => expect(listPrescriptionTemplatesForWorkspace).toHaveBeenCalledWith(ORG));
    fireEvent.change(screen.getByLabelText(/search medicines or prescription templates/i), {
      target: { value: 'otitis' },
    });
    fireEvent.click(screen.getByRole('button', { name: /otitis prescription/i }));

    const prescription = useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription;
    expect(prescription).toHaveLength(2);
    expect(prescription?.[0]).toMatchObject({
      medicineName: 'Existing med',
      instructions: 'Keep current clinician directions',
    });
    const added = prescription?.[1];
    expect(added).toMatchObject({
      inventoryItemId: 'inv-otic',
      medicineName: 'Otic drops',
      dosageForm: 'Drops',
      route: 'Otic',
      frequency: 'BID (twice daily)',
      durationDays: '7',
      qty: '1',
      instructions: 'Apply after cleaning',
    });
  });

  it('auto-loads a service-linked prescription template once service context is available', async () => {
    (resolvePrescriptionTemplate as jest.Mock).mockResolvedValue([
      {
        inventoryItemId: 'inv-linked',
        medicineName: 'Linked med',
        dosageForm: 'Tablet',
        route: 'Oral',
        frequency: 'SID (once daily)',
        durationDays: '3',
        durationUnit: 'days',
        qty: '3',
        fulfillment: 'IN_HOUSE',
      },
    ]);
    const enc = { ...seedAndGet(), prescription: [] };
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

    await waitFor(() =>
      expect(resolvePrescriptionTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: ORG,
          appointmentId: APPT,
          serviceId: 'svc-acupuncture',
          packageId: 'svc-cerenia',
        })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0]
    ).toMatchObject({
      medicineName: 'Linked med',
      frequency: 'SID (once daily)',
      qty: '3',
    });
  });

  it('deletes a persisted unbilled prescription via the artifact DELETE endpoint', async () => {
    (deletePrescriptionArtifact as jest.Mock).mockClear();
    (deletePrescriptionArtifact as jest.Mock).mockResolvedValue(true);
    const seeded = seedAndGet();
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

    fireEvent.click(screen.getByRole('button', { name: /remove amoxicillin/i }));

    await waitFor(() => expect(deletePrescriptionArtifact).toHaveBeenCalledWith(ORG, 'rx-1'));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.prescription.some((p) => p.id === 'rx-1')
    ).toBe(false);
  });

  it('restores the row and warns when deleting a finalized/billed prescription returns 409', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (deletePrescriptionArtifact as jest.Mock).mockClear();
    (deletePrescriptionArtifact as jest.Mock).mockRejectedValue({ response: { status: 409 } });
    const seeded = seedAndGet();
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

    fireEvent.click(screen.getByRole('button', { name: /remove amoxicillin/i }));

    expect(
      await screen.findByText(/finalized or billed and can no longer be removed/i)
    ).toBeInTheDocument();
    // The row is restored after the conflict.
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.prescription.some((p) => p.id === 'rx-1')
    ).toBe(true);
    errorSpy.mockRestore();
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
    // The editable cells (qty/refills/duration/instructions) render as empty floating-label
    // input boxes for a row that has no values yet. Form/Route render as dropdown triggers
    // because inventory did not supply them.
    expect((screen.getByLabelText('Qty') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Refills') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Duration') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Instructions') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: /^Form$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Route$/ })).toBeInTheDocument();
  });

  it('edits prescription fields through the line controls', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Qty is a plain input; Frequency is the shared (room/unit-style) LabelDropdown.
    fireEvent.change(screen.getAllByLabelText('Qty')[0], { target: { value: '20' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Frequency/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Every 12 hours' }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].qty).toBe(
      '20'
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].frequency
    ).toBe('Every 12 hours');
  });

  it('shows a persisted frequency value on the frequency dropdown trigger', () => {
    const enc = {
      ...seedAndGet(),
      prescription: [
        {
          id: 'rx-custom-frequency',
          medicineName: 'Custom frequency med',
          frequency: 'BID (twice daily)',
          fulfillment: 'IN_HOUSE' as const,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: /Frequency: BID \(twice daily\)/ })
    ).toBeInTheDocument();
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

  it('blocks save and does not advance for an incomplete prescription, even without org/encounter', () => {
    const onOpenInvoice = jest.fn();
    // Incomplete in-house prescription (missing frequency/duration/qty). Render WITHOUT
    // organisationId/encounterId — the validation gate must still run before advancing.
    const enc = {
      ...seedAndGet(),
      prescription: [
        {
          id: 'rx-incomplete',
          medicineName: 'Amoxicillin',
          route: 'Oral',
          dosageForm: 'Tablet',
          fulfillment: 'IN_HOUSE' as const,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={onOpenInvoice} />);

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(onOpenInvoice).not.toHaveBeenCalled();
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT
    ).not.toBe('COMPLETED');
    expect(
      screen.getByText(/Complete all prescription details before saving/i)
    ).toBeInTheDocument();
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

    expect(await screen.findByText(/Unable to save treatment items/)).toBeInTheDocument();
    expect(onOpenInvoice).not.toHaveBeenCalled();
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT
    ).not.toBe('COMPLETED');
    errorSpy.mockRestore();
  });

  it('renders inpatient schedule and opens Quick Actions to add a task', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    // Add is no longer inline — it opens the Quick Actions Tasks side modal.
    fireEvent.click(screen.getByRole('button', { name: /add schedule task/i }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('TASKS');
  });

  it('navigates schedule days and filters tasks by the selected day', () => {
    const todayString = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const enc = seedAndGet('INPATIENT');
    // A task scoped to today should appear on the default day and disappear when
    // navigating away — exercising the real day-window filter. The row derives from
    // the task store (single source of truth), dated via the task's dueAt.
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    useTaskStore.getState().setTasksForOrg(ORG, [
      buildTask({
        _id: 'task-today',
        name: 'Day-scoped observation',
        category: 'RECORD',
        assignedTo: 'member-1',
        status: 'IN_PROGRESS',
        dueAt: today,
      }),
    ]);
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Header shows today's date; the row title renders as read-only text (no input).
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

  it('appends a task template found via the schedule search and creates tasks', async () => {
    (listScheduleTaskTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-care',
        name: 'Post-op care pathway',
        kind: 'TASK_ASSIGNMENT',
        status: 'PUBLISHED',
      },
    ]);
    (resolveScheduleTasksFromTemplate as jest.Mock).mockResolvedValue([
      {
        description: 'Record vitals',
        subtext: 'Check temperature and appetite',
        category: 'Care',
        status: 'UPCOMING',
        autoGenerated: true,
        sourceRefId: 'tpl-care',
        time: '9:00 AM',
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

    // Searching by the template's name surfaces it as an appendable suggestion.
    fireEvent.change(await screen.findByLabelText(/search tasks, assignees or templates/i), {
      target: { value: 'Post-op' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /post-op care pathway/i }));

    await waitFor(() =>
      expect(resolveScheduleTasksFromTemplate).toHaveBeenCalledWith(ORG, 'tpl-care')
    );
    // Resolved blocks are created as real employee tasks (not staged local rows).
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Record vitals',
          description: 'Check temperature and appetite',
          audience: 'EMPLOYEE_TASK',
        })
      )
    );
  });

  it('opens a task in Quick Actions from the schedule View action', () => {
    const enc = seedAndGet('INPATIENT');
    seedScheduleTasks();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /view record observation for analgesic/i }));
    const state = useAppointmentWorkspaceStore.getState();
    expect(state.activeSideAction).toBe('TASKS');
    // View focuses the backing task's id (the single source of truth).
    expect(state.focusTaskId).toBe('task-1');
  });

  it('reassigns and changes status of a schedule task inline', async () => {
    const enc = seedAndGet('INPATIENT');
    seedScheduleTasks();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Changing status persists via the task endpoints and optimistically updates the
    // task store, so the derived schedule row re-renders from the shared source.
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Pending' }));
    await waitFor(() =>
      expect(changeTaskStatus).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'task-2', status: 'PENDING' })
      )
    );
    expect(useTaskStore.getState().tasksById['task-2'].status).toBe('PENDING');

    // Reassigning persists via updateTask.
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    await waitFor(() => expect(updateTask).toHaveBeenCalled());
  });

  it('locks the status of completed schedule tasks (no caret, not changeable)', () => {
    const enc = seedAndGet('INPATIENT');
    seedScheduleTasks();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The seeded task store has a COMPLETED task; its status renders as a static pill
    // (a "Completed" label that is not a Status dropdown button). Completed tasks are
    // still shown — never hidden — so the record stays visible after a refresh.
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // One completed + one changeable seeded task → exactly one Status dropdown button.
    expect(screen.getAllByRole('button', { name: 'Status' })).toHaveLength(1);
  });

  it('filters inpatient schedule tasks to an empty state', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/search tasks, assignees or templates/i), {
      target: { value: 'not in schedule' },
    });

    expect(screen.getByText('No schedule tasks match this search.')).toBeInTheDocument();
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
    expect(
      screen.queryByLabelText(/search medicines or prescription templates/i)
    ).not.toBeInTheDocument();
    // Prescription editable fields keep the floating-label input style but are read-only.
    const refills = screen.getAllByLabelText('Refills')[0] as HTMLInputElement;
    expect(refills).toHaveAttribute('readonly');
    // The schedule Add control is disabled in view-only mode.
    expect(screen.getByRole('button', { name: /add schedule task/i })).toBeDisabled();
  });

  it('locks service removal once ready for billing but keeps prescriptions deletable', () => {
    const enc = { ...seedAndGet(), readyForBilling: { value: true } };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Services lock their delete once ready for billing (billed items have no delete at all).
    expect(screen.getByLabelText(/remove acupuncture/i)).toBeDisabled();
    // Prescriptions are NOT locked by ready-for-billing — only an actually billed/paid
    // prescription is read-only. An unbilled prescription stays deletable.
    expect(screen.getByLabelText(/remove prednisone/i)).not.toBeDisabled();
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
