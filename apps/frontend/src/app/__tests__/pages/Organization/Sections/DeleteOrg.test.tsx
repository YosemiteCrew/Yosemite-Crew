import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DeleteOrg from '@/app/features/organization/pages/Organization/Sections/DeleteOrg';

const deleteOrgMock = jest.fn();

jest.mock('@/app/features/organization/services/orgService', () => ({
  deleteOrg: () => deleteOrgMock(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => (props: any) => (
  <input aria-label={props.inlabel} value={props.value} onChange={props.onChange} />
));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

describe('DeleteOrg section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteOrgMock.mockResolvedValue(undefined);
  });

  it('renders the danger-zone card with description and delete trigger', () => {
    render(<DeleteOrg />);

    expect(screen.getByText('Delete organization')).toBeInTheDocument();
    expect(screen.getByText('Removes the clinic and revokes all team access')).toBeInTheDocument();
    expect(screen.getByText('Delete…')).toBeInTheDocument();
  });

  it('opens the confirmation modal with the org-specific copy', () => {
    render(<DeleteOrg />);

    fireEvent.click(screen.getByText('Delete…'));

    expect(
      screen.getByText('Are you sure you want to delete this organization?')
    ).toBeInTheDocument();
    expect(screen.getByText('All organization settings')).toBeInTheDocument();
  });

  it('opens modal and deletes when email is provided', async () => {
    render(<DeleteOrg />);

    fireEvent.click(screen.getByText('Delete…'));
    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByText('Delete'));

    expect(deleteOrgMock).toHaveBeenCalled();
  });
});
