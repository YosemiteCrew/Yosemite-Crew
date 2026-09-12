import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/services/formDraftImportService', () => ({
  createDraftImport: jest.fn(),
  getDraftImport: jest.fn(),
  discardDraftImport: jest.fn(),
}));

jest.mock('@/app/features/forms/services/formService', () => ({
  loadForms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick, type, isDisabled }: any) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ options, onSelect }: any) => (
    <div>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onSelect(option)}>
          Choose {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import DeveloperFormDraftImport from '@/app/features/developers/pages/DeveloperFormDraftImport/DeveloperFormDraftImport';
import {
  createDraftImport,
  discardDraftImport,
  getDraftImport,
} from '@/app/services/formDraftImportService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useFormsStore } from '@/app/stores/formsStore';

const createDraftImportMock = createDraftImport as jest.Mock;
const getDraftImportMock = getDraftImport as jest.Mock;
const discardDraftImportMock = discardDraftImport as jest.Mock;

const VIEW = {
  id: 'd1',
  organisationId: 'org1',
  sourceFormId: 'form1',
  draftFormId: 'draftForm1',
  suppliedText: 'Patient name | input | required',
  fields: [
    { id: 'patient-name', type: 'input', label: 'Patient name', required: true, sourceLine: 1 },
  ],
  unsupportedConstructs: [{ line: 2, raw: 'Signature | inkblot', reason: 'Unknown type' }],
  diff: [
    {
      id: 'patient-name',
      change: 'added',
      after: { type: 'input', label: 'Patient name', required: true },
    },
  ],
  stale: false,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useOrgStore.setState({ primaryOrgId: 'org1' });
  useFormsStore.setState({
    formsById: {
      form1: {
        _id: 'form1',
        name: 'Consent form',
        category: 'Consent form',
        usage: 'Standalone' as any,
        updatedBy: 'u1',
        lastUpdated: '2026-09-01T00:00:00.000Z',
        status: 'Published',
        schema: [],
      } as any,
    },
    formIds: ['form1'],
  });
});

describe('DeveloperFormDraftImport page', () => {
  it('shows the import form before anything is submitted', () => {
    render(<DeveloperFormDraftImport />);
    expect(screen.getByLabelText(/Supplied form text/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview import' })).toBeDisabled();
  });

  it('only offers published forms as a diff source', () => {
    useFormsStore.setState({
      formsById: {
        form1: { ...useFormsStore.getState().formsById.form1 },
        draft1: {
          _id: 'draft1',
          name: 'Unpublished form',
          category: 'Consent form',
          usage: 'Standalone' as any,
          updatedBy: 'u1',
          lastUpdated: '2026-09-01T00:00:00.000Z',
          status: 'Draft',
          schema: [],
        } as any,
      },
      formIds: ['form1', 'draft1'],
    });
    render(<DeveloperFormDraftImport />);
    expect(screen.getByRole('button', { name: 'Choose Consent form' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Choose Unpublished form' })
    ).not.toBeInTheDocument();
  });

  it('submits the supplied text and renders the review', async () => {
    const user = userEvent.setup();
    createDraftImportMock.mockResolvedValue(VIEW);
    render(<DeveloperFormDraftImport />);

    await user.click(screen.getByRole('button', { name: 'Choose Consent form' }));
    await user.type(screen.getByLabelText(/Supplied form text/), 'Patient name | input | required');
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    expect(await screen.findByText('Proposed fields (1)')).toBeInTheDocument();
    expect(createDraftImportMock).toHaveBeenCalledWith('org1', {
      suppliedText: 'Patient name | input | required',
      sourceFormId: 'form1',
    });
    expect(screen.getByText('Unsupported constructs (1)')).toBeInTheDocument();
    expect(screen.getByText('Signature | inkblot')).toBeInTheDocument();
    expect(screen.getByTestId('diff-patient-name')).toHaveTextContent('Added');
  });

  it('shows an error when the import fails', async () => {
    const user = userEvent.setup();
    createDraftImportMock.mockRejectedValue(new Error('boom'));
    render(<DeveloperFormDraftImport />);

    await user.type(screen.getByLabelText(/Supplied form text/), 'x | input');
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    expect(await screen.findByText(/Could not import the supplied text/)).toBeInTheDocument();
  });

  it('refreshes a stale draft', async () => {
    const user = userEvent.setup();
    createDraftImportMock.mockResolvedValue({ ...VIEW, stale: true });
    getDraftImportMock.mockResolvedValue({ ...VIEW, stale: false });
    render(<DeveloperFormDraftImport />);

    await user.type(screen.getByLabelText(/Supplied form text/), 'x | input');
    await user.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByText(/source form changed/);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(getDraftImportMock).toHaveBeenCalledWith('org1', 'd1');
    await waitFor(() => expect(screen.queryByText(/source form changed/)).not.toBeInTheDocument());
  });

  it('discards the draft and returns to the form', async () => {
    const user = userEvent.setup();
    createDraftImportMock.mockResolvedValue(VIEW);
    discardDraftImportMock.mockResolvedValue(undefined);
    render(<DeveloperFormDraftImport />);

    await user.type(screen.getByLabelText(/Supplied form text/), 'x | input');
    await user.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByText('Proposed fields (1)');

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(discardDraftImportMock).toHaveBeenCalledWith('org1', 'd1');
    await waitFor(() => expect(screen.getByLabelText(/Supplied form text/)).toBeInTheDocument());
  });

  it('shows the 409 message when discard fails because it was already published', async () => {
    const user = userEvent.setup();
    createDraftImportMock.mockResolvedValue(VIEW);
    discardDraftImportMock.mockRejectedValue(new Error('already published'));
    render(<DeveloperFormDraftImport />);

    await user.type(screen.getByLabelText(/Supplied form text/), 'x | input');
    await user.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByText('Proposed fields (1)');

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(await screen.findByText(/already have been published/)).toBeInTheDocument();
  });
});
