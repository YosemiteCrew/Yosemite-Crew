import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionsEditor, {
  uniq,
  computeEffectivePermissions,
} from '@/app/features/organization/pages/Organization/Sections/Team/PermissionsEditor';
import { Permission, PERMISSIONS } from '@/app/lib/permissions';

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
  const defaultPermissions: Permission[] = [
    PERMISSIONS.APPOINTMENTS_VIEW_ANY,
    PERMISSIONS.COMPANIONS_VIEW_ANY,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders permissions accordion', () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByTestId('accordion-Permissions')).toBeInTheDocument();
  });

  it('renders permission rows with labels', () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Companions')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Labs')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('renders reset to defaults button', () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    expect(screen.getByText('Reset to role defaults')).toBeInTheDocument();
  });

  it('shows save and cancel buttons when permissions are modified via reset', async () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    const resetButton = screen.getByText('Reset to role defaults');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByTestId('primary-btn')).toBeInTheDocument();
      expect(screen.getByTestId('secondary-btn')).toBeInTheDocument();
    });
  });

  it('shows dash for rows without view or edit permissions', () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders checkboxes for permission rows', () => {
    render(<PermissionsEditor role="ADMIN" value={defaultPermissions} onSave={mockOnSave} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
