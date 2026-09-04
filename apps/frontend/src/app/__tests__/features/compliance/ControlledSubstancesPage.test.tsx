import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProtectedControlledSubstances from '@/app/features/compliance/pages/ControlledSubstances';
import { useControlledSubstanceLogs } from '@/app/features/compliance/hooks/useControlledSubstanceLogs';
import {
  createControlledSubstanceLog,
  getControlledSubstanceErrorMessage,
} from '@/app/features/compliance/services/controlledSubstanceService';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <div>skeleton</div>,
}));

jest.mock('@/app/features/compliance/hooks/useControlledSubstanceLogs', () => ({
  useControlledSubstanceLogs: jest.fn(),
}));
jest.mock('@/app/features/compliance/services/controlledSubstanceService', () => ({
  createControlledSubstanceLog: jest.fn(),
  getControlledSubstanceErrorMessage: jest.fn(() => 'friendly error'),
}));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@/app/hooks/useNotify', () => ({ useNotify: jest.fn() }));

// Stand-in for the presentational register: surfaces the wired props and
// fires onCreate on demand so the container's handleCreate is exercised.
const SAMPLE_INPUT = {
  loggedAt: '2026-09-03T14:30:00.000Z',
  drug: 'Ketamine',
  deaSchedule: 'III' as const,
  unit: 'MG' as const,
  amountDrawn: 2,
  amountAdministered: 2,
};
jest.mock('@/app/features/compliance/components/ControlledSubstanceRegister', () => ({
  __esModule: true,
  default: (props: {
    canRecord: boolean;
    creating: boolean;
    createError: string | null;
    onCreate: (input: typeof SAMPLE_INPUT) => void;
    entries: Array<{ id: string }>;
  }) => (
    <div>
      <span data-testid="entry-count">{props.entries.length}</span>
      <span data-testid="can-record">{String(props.canRecord)}</span>
      <span data-testid="create-error">{props.createError ?? ''}</span>
      <button type="button" onClick={() => props.onCreate(SAMPLE_INPUT)}>
        fire-create
      </button>
    </div>
  ),
}));

const mockUseLogs = useControlledSubstanceLogs as jest.Mock;
const mockCreate = createControlledSubstanceLog as jest.Mock;
const mockNotify = jest.fn();
const reload = jest.fn();
const can = jest.fn(() => true);

beforeEach(() => {
  jest.clearAllMocks();
  (useOrgStore as unknown as jest.Mock).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ primaryOrgId: 'org-1' })
  );
  (usePermissions as jest.Mock).mockReturnValue({ can });
  (useNotify as jest.Mock).mockReturnValue({ notify: mockNotify });
  mockUseLogs.mockReturnValue({
    logs: [{ id: 'log-1' }],
    loading: false,
    error: null,
    reload,
  });
});

describe('ProtectedControlledSubstances', () => {
  it('wires the register with the primary org logs and record permission', () => {
    render(<ProtectedControlledSubstances />);
    expect(screen.getByTestId('entry-count')).toHaveTextContent('1');
    expect(screen.getByTestId('can-record')).toHaveTextContent('true');
    expect(mockUseLogs).toHaveBeenCalledWith('org-1', {});
  });

  it('logs an entry, notifies success and reloads', async () => {
    mockCreate.mockResolvedValue({ id: 'log-2' });
    const user = userEvent.setup();
    render(<ProtectedControlledSubstances />);

    await user.click(screen.getByRole('button', { name: 'fire-create' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('org-1', SAMPLE_INPUT));
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Entry logged' })
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('surfaces a create error without reloading', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ProtectedControlledSubstances />);

    await user.click(screen.getByRole('button', { name: 'fire-create' }));

    await waitFor(() =>
      expect(screen.getByTestId('create-error')).toHaveTextContent('friendly error')
    );
    expect(getControlledSubstanceErrorMessage).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not call the API when there is no primary org', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ primaryOrgId: null })
    );
    const user = userEvent.setup();
    render(<ProtectedControlledSubstances />);

    await user.click(screen.getByRole('button', { name: 'fire-create' }));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
