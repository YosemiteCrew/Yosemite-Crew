import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UniversalSearchPalette from '@/app/ui/layout/UniversalSearch/UniversalSearchPalette';
import { startRouteLoader } from '@/app/lib/routeLoader';

const pushMock = jest.fn();
const openMock = jest.fn();
const closeMock = jest.fn();
const setHeaderSearchQueryMock = jest.fn();

let pathnameValue = '/appointments';
let isOpenValue = true;

const appointmentsMock = [
  {
    id: 'appt-1',
    status: 'UPCOMING',
    concern: 'Checkup',
    companion: { name: 'Buddy', parent: { name: 'Sam' } },
  },
] as any;

const tasksMock = [
  {
    _id: 'task-1',
    name: 'Give meds',
    description: 'After breakfast',
    status: 'PENDING',
    category: 'Medication',
  },
] as any;

const companionsMock = [
  {
    companion: { id: 'comp-1', name: 'Buddy', type: 'DOG', status: 'ACTIVE' },
    parent: { firstName: 'Sam', lastName: 'Lee' },
  },
] as any;

const invoicesMock = [
  {
    id: 'inv-1',
    status: 'PAID',
    appointmentId: 'appt-1',
  },
] as any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameValue,
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
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
  useFormsStore: (selector: any) =>
    selector({
      formIds: ['form-1'],
      formsById: {
        'form-1': {
          _id: 'form-1',
          name: 'SOAP Form',
          category: 'Prescription',
          status: 'Published',
          description: 'SOAP template',
        },
      },
    }),
}));

jest.mock('@/app/stores/inventoryStore', () => ({
  useInventoryStore: (selector: any) =>
    selector({
      itemIdsByOrgId: {
        'org-1': ['item-1'],
      },
      itemsById: {
        'item-1': {
          id: 'item-1',
          status: 'ACTIVE',
          basicInfo: {
            name: 'Dog Food',
            category: 'Food',
            description: 'Nutrition',
          },
        },
      },
    }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
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
  });

  it('opens palette with keyboard shortcut even when currently closed', () => {
    isOpenValue = false;
    render(<UniversalSearchPalette />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('renders quick links when query is empty', () => {
    render(<UniversalSearchPalette />);

    expect(screen.getByText('Open Appointments')).toBeInTheDocument();
    expect(screen.getByText('Open Tasks')).toBeInTheDocument();
    expect(screen.getByText('Open Finance')).toBeInTheDocument();
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
});
