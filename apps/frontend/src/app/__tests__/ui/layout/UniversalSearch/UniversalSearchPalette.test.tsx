import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UniversalSearchPalette from '@/app/ui/layout/UniversalSearch/UniversalSearchPalette';
import { startRouteLoader } from '@/app/lib/routeLoader';

const pushMock = jest.fn();
const openMock = jest.fn();
const closeMock = jest.fn();
const setHeaderSearchQueryMock = jest.fn();

let pathnameValue = '/appointments';
let isOpenValue = true;
let isPhoneValue = false;

const BASE_APPOINTMENTS = [
  {
    id: 'appt-1',
    status: 'UPCOMING',
    concern: 'Checkup',
    companion: { name: 'Buddy', parent: { name: 'Sam' } },
  },
];

const BASE_TASKS = [
  {
    _id: 'task-1',
    name: 'Give meds',
    description: 'After breakfast',
    status: 'PENDING',
    category: 'Medication',
  },
];

const BASE_COMPANIONS = [
  {
    companion: { id: 'comp-1', name: 'Buddy', type: 'DOG', status: 'ACTIVE' },
    parent: { firstName: 'Sam', lastName: 'Lee' },
  },
];

const BASE_INVOICES = [
  {
    id: 'inv-1',
    status: 'PAID',
    appointmentId: 'appt-1',
  },
];

const BASE_FORMS_STATE = {
  formIds: ['form-1'],
  formsById: {
    'form-1': {
      _id: 'form-1',
      name: 'SOAP Form',
      category: 'Prescription',
      status: 'Published',
      description: 'SOAP template',
    },
  } as Record<string, any>,
};

const BASE_INVENTORY_STATE = {
  itemIdsByOrgId: { 'org-1': ['item-1'] } as Record<string, string[]>,
  itemsById: {
    'item-1': {
      id: 'item-1',
      status: 'ACTIVE',
      basicInfo: { name: 'Dog Food', category: 'Food', description: 'Nutrition' },
    },
  } as Record<string, any>,
};

// Mutable holders so individual tests can inject sparse/edge fixtures. Reset in
// beforeEach. Referenced by the hoisted jest.mock factories at call-time.
let appointmentsMock: any[] = BASE_APPOINTMENTS;
let tasksMock: any[] = BASE_TASKS;
let companionsMock: any[] = BASE_COMPANIONS;
let invoicesMock: any[] = BASE_INVOICES;
let formsState: typeof BASE_FORMS_STATE = BASE_FORMS_STATE;
let inventoryState: typeof BASE_INVENTORY_STATE = BASE_INVENTORY_STATE;
let primaryOrgIdValue: string | undefined = 'org-1';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameValue,
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
}));

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  useIsPhone: () => isPhoneValue,
  PHONE_MEDIA_QUERY: '(max-width: 767px)',
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => appointmentsMock,
}));

jest.mock('@/app/hooks/useTask', () => ({
  useTasksForPrimaryOrg: () => tasksMock,
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: () => companionsMock,
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: () => invoicesMock,
}));

jest.mock('@/app/stores/formsStore', () => ({
  useFormsStore: (selector: any) => selector(formsState),
}));

jest.mock('@/app/stores/inventoryStore', () => ({
  useInventoryStore: (selector: any) =>
    selector({
      itemIdsByOrgId: inventoryState.itemIdsByOrgId,
      itemsById: inventoryState.itemsById,
    }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: primaryOrgIdValue }),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => selector({ setQuery: setHeaderSearchQueryMock }),
}));

jest.mock('@/app/stores/universalSearchStore', () => ({
  useUniversalSearchStore: (selector: any) =>
    selector({
      isOpen: isOpenValue,
      open: openMock,
      close: closeMock,
    }),
}));

describe('UniversalSearchPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathnameValue = '/appointments';
    isOpenValue = true;
    isPhoneValue = false;
    appointmentsMock = BASE_APPOINTMENTS;
    tasksMock = BASE_TASKS;
    companionsMock = BASE_COMPANIONS;
    invoicesMock = BASE_INVOICES;
    formsState = BASE_FORMS_STATE;
    inventoryState = BASE_INVENTORY_STATE;
    primaryOrgIdValue = 'org-1';
  });

  it('opens palette with keyboard shortcut even when currently closed', () => {
    isOpenValue = false;
    render(<UniversalSearchPalette />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('also opens with Ctrl/Cmd+P', () => {
    isOpenValue = false;
    render(<UniversalSearchPalette />);

    fireEvent.keyDown(document, { key: 'p', metaKey: true });

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('ignores non-shortcut keys while closed', () => {
    isOpenValue = false;
    render(<UniversalSearchPalette />);

    // The route-change effect calls close() once on mount; isolate the keydown.
    openMock.mockClear();
    closeMock.mockClear();
    fireEvent.keyDown(document, { key: 'ArrowDown' });

    expect(openMock).not.toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('shows the "Jump to" nav shortcuts on the empty-query state', () => {
    render(<UniversalSearchPalette />);

    expect(screen.getByText('Jump to')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    // The jump-to keycaps from the spec.
    expect(screen.getByText('G D')).toBeInTheDocument();
    expect(screen.getByText('G A')).toBeInTheDocument();
  });

  it("renders empty-state rows in the design's light treatment (no icon tile)", () => {
    globalThis.window.localStorage.clear();
    render(<UniversalSearchPalette />);

    const jumpRow = screen.getByText('Dashboard').closest('button') as HTMLButtonElement;
    expect(jumpRow).toHaveClass('yc-usp-row--plain');
    expect(jumpRow.querySelector('.yc-usp-icon')).toBeNull();
    expect(jumpRow.querySelector('.yc-usp-row-plain-label')).toBeInTheDocument();
  });

  it('lists opened records under "Recent" and leaves jump shortcuts out of it', async () => {
    globalThis.window.localStorage.clear();
    const first = render(<UniversalSearchPalette />);

    // A nav shortcut is not a record — it must never enter the recents list.
    fireEvent.click(screen.getByText('Dashboard').closest('button') as HTMLButtonElement);
    fireEvent.change(screen.getByLabelText('Universal search input'), {
      target: { value: 'Give meds' },
    });
    fireEvent.click((await screen.findByText('Give meds')).closest('button') as HTMLButtonElement);
    first.unmount();

    // Reopening the palette reads the persisted list back.
    render(<UniversalSearchPalette />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    const recentRow = screen
      .getAllByText('Give meds')
      .map((node) => node.closest('button'))
      .find((button) => button?.classList.contains('yc-usp-row--plain'));
    expect(recentRow).toBeDefined();
    expect(screen.queryByText('Recent')?.nextElementSibling).toBe(recentRow);

    // Selecting the recent row again re-records it rather than duplicating it.
    fireEvent.click(recentRow as HTMLButtonElement);
    // Namespaced per organisation: these titles are record names, so another
    // organisation's palette must never read them back.
    expect(
      JSON.parse(
        globalThis.window.localStorage.getItem('yc_universal_search_recents:org-1') ?? '[]'
      )
    ).toEqual([{ title: 'Give meds', href: '/tasks?taskId=task-1' }]);

    globalThis.window.localStorage.clear();
  });

  it("does not show another organisation's recents", async () => {
    globalThis.window.localStorage.setItem(
      'yc_universal_search_recents:org-other',
      JSON.stringify([{ title: 'Другой pet', href: '/companions?companionId=c-9' }])
    );

    render(<UniversalSearchPalette />);

    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
    expect(screen.queryByText('Другой pet')).not.toBeInTheDocument();

    globalThis.window.localStorage.clear();
  });

  it('navigates from a jump-to shortcut', async () => {
    render(<UniversalSearchPalette />);

    fireEvent.click(screen.getByText('Dashboard').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(startRouteLoader).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
      expect(closeMock).toHaveBeenCalled();
    });
  });

  it('groups query results under section eyebrows and marks the active row', () => {
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'lee' } });

    // Companion match → "Patients"; the IDEXX action → "Actions".
    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    // Active row + footer both surface the ↵ keycap.
    expect(screen.getAllByText('↵').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the desktop footer hints and closes from the ESC keycap', () => {
    render(<UniversalSearchPalette />);

    expect(screen.getByText(/Navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Open in workspace/)).toBeInTheDocument();
    expect(
      screen.getByText('Searches patients, visits, invoices, team, pages')
    ).toBeInTheDocument();

    // The route-change effect fires close() once on mount; isolate the click.
    closeMock.mockClear();
    fireEvent.click(screen.getByText('ESC'));
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('filters results and navigates to a selected item', async () => {
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'Give meds' } });

    const taskResult = await screen.findByText('Give meds');
    fireEvent.click(taskResult.closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(startRouteLoader).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/tasks?taskId=task-1');
      expect(closeMock).toHaveBeenCalled();
    });
  });

  it('navigates with the arrow keys and opens the active row on Enter', async () => {
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'lee' } });

    // Move onto the IDEXX action (last row) and open it.
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(setHeaderSearchQueryMock).toHaveBeenCalledWith('lee');
      expect(pushMock).toHaveBeenCalledWith('/appointments/idexx-workspace');
    });
  });

  it('creates IDEXX action and sets header query before routing', async () => {
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'hematology' } });

    const idexxAction = await screen.findByText('Search "hematology" in IDEXX Hub');
    fireEvent.click(idexxAction.closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(setHeaderSearchQueryMock).toHaveBeenCalledWith('hematology');
      expect(pushMock).toHaveBeenCalledWith('/appointments/idexx-workspace');
    });
  });

  it('renders the phone full-screen variant with a working Cancel and no dead controls', () => {
    isPhoneValue = true;
    render(<UniversalSearchPalette />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Searches patients, visits, invoices, team')).toBeInTheDocument();
    expect(screen.queryByText('ESC')).not.toBeInTheDocument();

    // The phone footer must expose no button other than a functional Cancel:
    // a rendered-but-inert control (the old "Filters" button) is a regression.
    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }

    // The route-change effect fires close() once on mount; isolate the click.
    closeMock.mockClear();
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('closes on the Escape key while open', () => {
    render(<UniversalSearchPalette />);

    closeMock.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to placeholder copy for records missing optional fields', () => {
    // The id-less rows exercise the `id ?? ''` nullish default AND the
    // `if (!id) return` guard in every module's builder.
    appointmentsMock = [
      ...BASE_APPOINTMENTS,
      { id: 'zzedge-appt', companion: { name: undefined, parent: undefined } },
      { companion: {} }, // no id → skipped
    ];
    tasksMock = [
      ...BASE_TASKS,
      { _id: 'zzedge-task' }, // no name/status/category
      {}, // no id → skipped
    ];
    companionsMock = [
      ...BASE_COMPANIONS,
      { companion: { id: 'zzedge-comp' }, parent: {} }, // no name/type; no firstName
      { companion: {}, parent: {} }, // no id → skipped
    ];
    invoicesMock = [
      ...BASE_INVOICES,
      { id: 'zzedge-inv' }, // no status/appointmentId
      {}, // no id → skipped
    ];
    formsState = {
      formIds: ['form-1', 'zzedge-form', 'blank-form', 'ghost-form'],
      formsById: {
        ...BASE_FORMS_STATE.formsById,
        'zzedge-form': { _id: 'zzedge-form' }, // no name/category/status
        'blank-form': {}, // present but id-less → nullish default, then skipped
        // 'ghost-form' intentionally absent → filtered out by the flatMap guard
      },
    };
    inventoryState = {
      itemIdsByOrgId: { 'org-1': ['item-1', 'zzedge-item', 'blank-item', 'ghost-item'] },
      itemsById: {
        ...BASE_INVENTORY_STATE.itemsById,
        'zzedge-item': { id: 'zzedge-item', basicInfo: {} }, // no name/category/status
        'blank-item': {}, // present but id-less → nullish default, then skipped
        // 'ghost-item' absent → filtered out
      },
    };

    render(<UniversalSearchPalette />);
    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'zzedge' } });

    // Each module's fallback copy surfaces for the sparse rows.
    expect(screen.getByText('Task')).toBeInTheDocument(); // task.name || 'Task'
    expect(screen.getByText('Form')).toBeInTheDocument(); // form.name || 'Form'
    expect(screen.getByText('Inventory item')).toBeInTheDocument();
    expect(screen.getByText(/No concern/)).toBeInTheDocument();
    expect(screen.getByText(/UNKNOWN/)).toBeInTheDocument(); // task.status fallback
    expect(screen.getByText(/General/)).toBeInTheDocument(); // task.category fallback
    expect(screen.getByText(/Unknown species/)).toBeInTheDocument();
    expect(screen.getByText(/Parent: Unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Custom/)).toBeInTheDocument(); // form.category fallback
    expect(screen.getByText(/Draft/)).toBeInTheDocument(); // form.status fallback
    expect(screen.getByText(/Uncategorized/)).toBeInTheDocument();
    expect(screen.getByText(/PENDING/)).toBeInTheDocument(); // invoice.status fallback

    // Ghost map entries (id present in the index but absent from the by-id map)
    // never render.
    expect(screen.queryByText(/ghost-form/)).toBeNull();
    expect(screen.queryByText(/ghost-item/)).toBeNull();
  });

  it('focuses and selects the input shortly after opening', () => {
    jest.useFakeTimers();
    try {
      render(<UniversalSearchPalette />);
      act(() => {
        jest.advanceTimersByTime(25);
      });
      expect(screen.getByLabelText('Universal search input')).toHaveFocus();
    } finally {
      jest.useRealTimers();
    }
  });

  it('yields no inventory results when there is no primary org', () => {
    primaryOrgIdValue = undefined;
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'Dog Food' } });

    expect(screen.queryByText('Dog Food')).toBeNull();
  });

  it('handles a primary org with no inventory bucket', () => {
    inventoryState = { itemIdsByOrgId: {}, itemsById: {} };
    render(<UniversalSearchPalette />);

    const input = screen.getByLabelText('Universal search input');
    fireEvent.change(input, { target: { value: 'Dog Food' } });

    expect(screen.queryByText('Dog Food')).toBeNull();
  });
});
