import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

import MigrationAuditUploadForm from '@/app/features/onboarding/pages/MigrationAudit/MigrationAuditUploadForm';

const csvFile = (name: string) => new File(['external_id\n1'], name, { type: 'text/csv' });

describe('MigrationAuditUploadForm', () => {
  it('publishes the limits and every section with its required/optional badge and columns', () => {
    render(
      <MigrationAuditUploadForm
        files={{}}
        onFileChange={jest.fn()}
        submitting={false}
        canSubmit={false}
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByText(/up to 5 MB and 5,000 rows/)).toBeInTheDocument();
    expect(screen.getByLabelText('Owners')).toBeInTheDocument();
    expect(
      screen.getByText('Columns: external_id, first_name, last_name, email, phone')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Required')).toHaveLength(3);
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('reports a chosen file and shows its name', async () => {
    const user = userEvent.setup();
    const onFileChange = jest.fn();
    render(
      <MigrationAuditUploadForm
        files={{}}
        onFileChange={onFileChange}
        submitting={false}
        canSubmit={false}
        onSubmit={jest.fn()}
      />
    );

    await user.upload(screen.getByLabelText('Owners'), csvFile('owners.csv'));
    expect(onFileChange).toHaveBeenCalledWith(
      'owners',
      expect.objectContaining({ name: 'owners.csv' })
    );
  });

  it('reports null when a chosen file is cleared', () => {
    const onFileChange = jest.fn();
    render(
      <MigrationAuditUploadForm
        files={{ owners: csvFile('owners.csv') }}
        onFileChange={onFileChange}
        submitting={false}
        canSubmit={false}
        onSubmit={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Owners'), { target: { files: [] } });
    expect(onFileChange).toHaveBeenCalledWith('owners', null);
  });

  it('disables the file inputs and shows the uploading label while submitting', () => {
    render(
      <MigrationAuditUploadForm
        files={{ owners: csvFile('owners.csv') }}
        onFileChange={jest.fn()}
        submitting
        canSubmit
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Owners')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled();
    expect(screen.getByText('owners.csv')).toBeInTheDocument();
  });

  it('calls onSubmit when the run button is clicked while enabled', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <MigrationAuditUploadForm
        files={{}}
        onFileChange={jest.fn()}
        submitting={false}
        canSubmit
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run migration audit' }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
