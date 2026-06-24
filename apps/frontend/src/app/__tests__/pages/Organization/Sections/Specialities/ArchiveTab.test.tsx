import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span data-testid="icon-delete" />,
  MdOutlineUnarchive: () => <span data-testid="icon-restore" />,
}));

jest.mock('react-icons/ai', () => ({
  AiOutlineInfoCircle: () => <span data-testid="icon-info" />,
}));

const mockRestoreService = jest.fn();
const mockDeleteService = jest.fn();
const mockRestorePackage = jest.fn();
const mockDeletePackage = jest.fn();
const mockLoadSpecialityCatalog = jest.fn();
let mockServices: any[] = [];
let mockPackages: any[] = [];

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: (selector: any) =>
    selector({
      services: mockServices,
      packages: mockPackages,
      restoreService: mockRestoreService,
      deleteService: mockDeleteService,
      restorePackage: mockRestorePackage,
      deletePackage: mockDeletePackage,
      loadSpecialityCatalog: mockLoadSpecialityCatalog,
    }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `$ ${amount.toFixed(2)}`,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: { title: string; onClose?: () => void }) => (
    <div>
      <h2>{title}</h2>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Secondary', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: { text: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/organization/services/catalogCalculations', () => ({
  computeServiceTotal: () => ({ total: 50 }),
}));

import ArchiveTab from '@/app/features/organization/pages/Specialities/ArchiveTab';

const SPEC_ID = 'spec-1';

describe('ArchiveTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRestoreService.mockResolvedValue(undefined);
    mockDeleteService.mockResolvedValue(undefined);
    mockRestorePackage.mockResolvedValue(undefined);
    mockDeletePackage.mockResolvedValue(undefined);
    mockServices = [];
    mockPackages = [];
  });

  it('shows empty state when no archived items', () => {
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('No archived services or packages.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-info')).toBeInTheDocument();
  });

  it('filters services by specialityId and ARCHIVED status', () => {
    mockServices = [
      {
        id: 's1',
        name: 'X-Ray',
        code: 'XR',
        type: 'LAB',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
      {
        id: 's2',
        name: 'Consult',
        code: 'CO',
        type: 'CONSULTATION',
        specialityId: SPEC_ID,
        status: 'ACTIVE',
      },
      {
        id: 's3',
        name: 'Other',
        code: 'OT',
        type: 'PROCEDURE',
        specialityId: 'other-spec',
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('X-Ray')).toBeInTheDocument();
    expect(screen.queryByText('Consult')).not.toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('renders service with type label and total', () => {
    mockServices = [
      {
        id: 's1',
        name: 'Blood Panel',
        code: 'BP01',
        type: 'LAB',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('Blood Panel')).toBeInTheDocument();
    expect(screen.getByText('Lab / Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('$ 50.00')).toBeInTheDocument();
    expect(screen.getByText('BP01')).toBeInTheDocument();
  });

  it('renders restore and delete buttons for services', () => {
    mockServices = [
      {
        id: 's1',
        name: 'Ultrasound',
        code: 'US',
        type: 'PROCEDURE',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByRole('button', { name: 'Restore Ultrasound' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Ultrasound permanently' })
    ).toBeInTheDocument();
  });

  it('calls restoreService and notifies on restore click', async () => {
    mockServices = [
      {
        id: 's1',
        name: 'Ultrasound',
        code: 'US',
        type: 'PROCEDURE',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Ultrasound' }));
    expect(mockRestoreService).toHaveBeenCalledWith('s1');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Service restored' })
      )
    );
  });

  it('calls deleteService and notifies on delete click', async () => {
    mockServices = [
      {
        id: 's1',
        name: 'Ultrasound',
        code: 'US',
        type: 'PROCEDURE',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ultrasound permanently' }));
    expect(mockDeleteService).not.toHaveBeenCalled();
    expect(screen.getByText('Delete service')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteService).toHaveBeenCalledWith('s1');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Service deleted' })
      )
    );
  });

  it('renders archived packages', () => {
    mockPackages = [
      {
        id: 'p1',
        name: 'Wellness Plan',
        code: 'WP1',
        durationText: 'Approx. 60 mins',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('Wellness Plan')).toBeInTheDocument();
    expect(screen.getByText('WP1')).toBeInTheDocument();
    expect(screen.getByText('Approx. 60 mins')).toBeInTheDocument();
    expect(screen.getByText('Package')).toBeInTheDocument();
  });

  it('calls restorePackage and notifies on package restore', async () => {
    mockPackages = [
      {
        id: 'p1',
        name: 'Wellness Plan',
        code: 'WP1',
        durationText: 'Approx. 60 mins',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Wellness Plan' }));
    expect(mockRestorePackage).toHaveBeenCalledWith('p1');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package restored' })
      )
    );
  });

  it('calls deletePackage and notifies on package delete', async () => {
    mockPackages = [
      {
        id: 'p1',
        name: 'Wellness Plan',
        code: 'WP1',
        durationText: 'Approx. 60 mins',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Wellness Plan permanently' }));
    expect(mockDeletePackage).not.toHaveBeenCalled();
    expect(screen.getByText('Delete package')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeletePackage).toHaveBeenCalledWith('p1');
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Package deleted' })
      )
    );
  });

  it('renders both services and packages sections together', () => {
    mockServices = [
      {
        id: 's1',
        name: 'X-Ray',
        code: 'XR',
        type: 'LAB',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    mockPackages = [
      {
        id: 'p1',
        name: 'Senior Care',
        code: 'SC1',
        durationText: 'Approx. 90 mins',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Packages')).toBeInTheDocument();
    expect(screen.getByText('X-Ray')).toBeInTheDocument();
    expect(screen.getByText('Senior Care')).toBeInTheDocument();
    expect(screen.queryByText('No archived services or packages.')).not.toBeInTheDocument();
  });

  it('uses raw type string for unknown type codes', () => {
    mockServices = [
      {
        id: 's1',
        name: 'Custom Svc',
        code: 'CS',
        type: 'CUSTOM_TYPE',
        specialityId: SPEC_ID,
        status: 'ARCHIVED',
      },
    ];
    render(<ArchiveTab specialityId={SPEC_ID} organisationId="org-1" />);
    expect(screen.getByText('CUSTOM_TYPE')).toBeInTheDocument();
  });
});
