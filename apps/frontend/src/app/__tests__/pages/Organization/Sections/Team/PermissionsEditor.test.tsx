import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionsEditor from '@/app/features/organization/pages/Organization/Sections/Team/PermissionsEditor';
import {
  computeEffectivePermissions,
  uniq,
} from '@/app/features/organization/pages/Organization/Sections/Team/permissionsEditorUtils';
import { Permission, PERMISSIONS, ROLE_PERMISSIONS } from '@/app/lib/permissions';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled} data-testid="primary-btn">
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled} data-testid="secondary-btn">
      {text}
    </button>
  ),
}));

describe('PermissionsEditor utility functions', () => {
  describe('uniq', () => {
    it('removes duplicate values from array', () => {
      const result = uniq(['a', 'b', 'a', 'c', 'b']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for empty input', () => {
      expect(uniq([])).toEqual([]);
    });

    it('returns same array when no duplicates', () => {
      expect(uniq(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('computeEffectivePermissions', () => {
    it('returns role defaults when no extra or revoked permissions', () => {
      const result = computeEffectivePermissions({
        role: 'ADMIN',
        extraPerissions: [],
        revokedPermissions: [],
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('adds extra permissions to role defaults', () => {
      const extraPerm = PERMISSIONS.INVENTORY_VIEW_ANY;
      const result = computeEffectivePermissions({
        role: 'ADMIN',
        extraPerissions: [extraPerm],
        revokedPermissions: [],
      });
      expect(result).toContain(extraPerm);
    });

    it('removes revoked permissions from role defaults', () => {
      const result = computeEffectivePermissions({
        role: 'ADMIN',
        extraPerissions: [],
        revokedPermissions: [PERMISSIONS.APPOINTMENTS_VIEW_ANY],
      });
      expect(result).not.toContain(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
    });

    it('handles undefined extra and revoked permissions', () => {
      const result = computeEffectivePermissions({
        role: 'ADMIN',
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('removes duplicates from combined permissions', () => {
      const result = computeEffectivePermissions({
        role: 'ADMIN',
        extraPerissions: [PERMISSIONS.APPOINTMENTS_VIEW_ANY],
        revokedPermissions: [],
      });
      const counts = result.reduce((acc: Record<string, number>, p: string) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});
      Object.values(counts).forEach((count) => {
        expect(count).toBe(1);
      });
    });
  });
});

describe('PermissionsEditor component', () => {
  const mockOnSave = jest.fn();
  const adminRole = 'ADMIN' as const;
  const defaultPermissions: Permission[] = [
    PERMISSIONS.APPOINTMENTS_VIEW_ANY,
    PERMISSIONS.COMPANIONS_VIEW_ANY,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restores both analytics view permissions when the row is re-enabled', async () => {
    // ADMIN holds analytics:view:any and analytics:view:clinical together.
    // Turning the row off drops both; turning it back on must return both,
    // not just the first - otherwise view:clinical is unrecoverable from the UI.
    render(
      <PermissionsEditor role={adminRole} value={ROLE_PERMISSIONS.ADMIN} onSave={mockOnSave} />
    );

    const analyticsView = screen.getByLabelText('Analytics view permission');
    fireEvent.click(analyticsView); // off
    fireEvent.click(analyticsView); // back on

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockOnSave).toHaveBeenCalled());
    const saved = mockOnSave.mock.calls.at(-1)?.[0];
    expect(saved.revokedPermissions).not.toContain(PERMISSIONS.ANALYTICS_VIEW_CLINICAL);
    expect(saved.revokedPermissions).not.toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
  });

  it('renders permissions accordion', () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByTestId('accordion-Permissions')).toBeInTheDocument();
  });

  it('renders permission rows with labels', () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Companions')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Labs')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('renders reset to defaults button', () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByText('Reset to role defaults')).toBeInTheDocument();
  });

  it('shows save and cancel buttons when permissions are modified via reset', async () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    const resetButton = screen.getByText('Reset to role defaults');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByTestId('primary-btn')).toBeInTheDocument();
      expect(screen.getByTestId('secondary-btn')).toBeInTheDocument();
    });
  });

  it('shows dash for rows without view or edit permissions', () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders checkboxes for permission rows', () => {
    render(<PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('resets draft permissions when the value prop changes', () => {
    const { rerender } = render(
      <PermissionsEditor role={adminRole} value={defaultPermissions} onSave={mockOnSave} />
    );

    expect(screen.getByText('Reset to role defaults')).toBeInTheDocument();

    rerender(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.TASKS_VIEW_ANY]}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Reset to role defaults')).toBeInTheDocument();
  });
});

describe('PermissionsEditor toggle, save and cancel behaviour', () => {
  const mockOnSave = jest.fn();
  const adminRole = 'ADMIN' as const;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  const view = (label: string) =>
    screen.getByRole('checkbox', { name: `${label} view permission` });
  const edit = (label: string) =>
    screen.getByRole('checkbox', { name: `${label} edit permission` });

  it('turning a view permission off also removes its edit permission', () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.APPOINTMENTS_EDIT_ANY]}
        onSave={mockOnSave}
      />
    );

    expect(view('Appointments')).toBeChecked();
    expect(edit('Appointments')).toBeChecked();

    fireEvent.click(view('Appointments'));

    expect(view('Appointments')).not.toBeChecked();
    expect(edit('Appointments')).not.toBeChecked();
  });

  it('enabling an edit permission also enables its view permission', () => {
    render(<PermissionsEditor role={adminRole} value={[]} onSave={mockOnSave} />);

    expect(view('Appointments')).not.toBeChecked();

    fireEvent.click(edit('Appointments'));

    expect(edit('Appointments')).toBeChecked();
    expect(view('Appointments')).toBeChecked();
  });

  it('enabling edit when view is already on keeps view enabled', () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(edit('Appointments'));

    expect(view('Appointments')).toBeChecked();
    expect(edit('Appointments')).toBeChecked();
  });

  it('falls back to the first priority permission when none is a role default', () => {
    // ADMIN role has subscription:view:any but NOT subscription:edit:any,
    // so enabling Subscriptions edit exercises the enablePriority[0] fallback.
    render(<PermissionsEditor role={adminRole} value={[]} onSave={mockOnSave} />);

    fireEvent.click(edit('Subscriptions'));

    expect(edit('Subscriptions')).toBeChecked();
    expect(view('Subscriptions')).toBeChecked();
  });

  it('enabling a view permission on its own does not enable edit', () => {
    render(<PermissionsEditor role={adminRole} value={[]} onSave={mockOnSave} />);

    fireEvent.click(view('Companions'));

    expect(view('Companions')).toBeChecked();
    expect(edit('Companions')).not.toBeChecked();
  });

  it('disabling an edit permission leaves the view permission intact', () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.APPOINTMENTS_EDIT_ANY]}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(edit('Appointments'));

    expect(view('Appointments')).toBeChecked();
    expect(edit('Appointments')).not.toBeChecked();
  });

  it('computes and saves the extra/revoked payload', async () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.COMPANIONS_VIEW_ANY]}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(edit('Subscriptions'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('primary-btn'));
    });

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    const payload = mockOnSave.mock.calls[0][0];
    expect(payload.extraPerissions).toEqual([PERMISSIONS.SUBSCRIPTION_EDIT_ANY]);
    expect(Array.isArray(payload.revokedPermissions)).toBe(true);
    expect(payload.revokedPermissions.length).toBeGreaterThan(0);
  });

  it('cancels changes and restores the original permission set', () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.COMPANIONS_VIEW_ANY]}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(view('Appointments'));
    expect(view('Appointments')).not.toBeChecked();
    expect(screen.getByTestId('secondary-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('secondary-btn'));

    expect(view('Appointments')).toBeChecked();
    expect(screen.queryByTestId('secondary-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-btn')).not.toBeInTheDocument();
  });

  it('renders read-only mode without editing controls', () => {
    render(
      <PermissionsEditor
        role={adminRole}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
        onSave={mockOnSave}
        readOnly
      />
    );

    expect(screen.queryByText('Reset to role defaults')).not.toBeInTheDocument();
    expect(view('Appointments')).toBeDisabled();
    expect(edit('Appointments')).toBeDisabled();
  });
});
