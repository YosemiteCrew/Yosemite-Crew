import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryDocumentUpload from '@/app/features/companionHistory/components/HistoryDocumentUpload';

const createCompanionDocumentMock = jest.fn();

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, defaultOption, options, onSelect, error }: any) => (
    <div>
      <select
        data-testid={placeholder}
        value={defaultOption ?? ''}
        onChange={(e) => onSelect({ value: e.target.value })}
      >
        <option value="">Select</option>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, inname, value, onChange, error }: any) => (
    <div>
      <input aria-label={inlabel ?? inname} value={value} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/widgets/UploadImage/CompanionDoc', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('doc-key', 'application/pdf', 1234)}>
      Mock Upload
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) =>
    selector({
      primaryOrgId: 'org-1',
      orgsById: {
        'org-1': { name: 'Yosemite Vet' },
      },
    }),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  createCompanionDocument: (...args: any[]) => createCompanionDocumentMock(...args),
}));

describe('HistoryDocumentUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors for missing fields', async () => {
    render(<HistoryDocumentUpload companionId="comp-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('File is required')).toBeInTheDocument();
    expect(createCompanionDocumentMock).not.toHaveBeenCalled();
  });

  it('submits document and resets form on success', async () => {
    const onUploaded = jest.fn();
    createCompanionDocumentMock.mockResolvedValue({ _id: 'doc-1' });

    render(<HistoryDocumentUpload companionId="comp-1" onUploaded={onUploaded} />);

    fireEvent.change(screen.getByTestId('Category'), {
      target: { value: 'HEALTH' },
    });
    fireEvent.change(screen.getByTestId('Sub-category'), {
      target: { value: 'VACCINATION_AND_PARASITE_PREVENTION' },
    });
    fireEvent.change(screen.getByTestId('Visit type'), {
      target: { value: 'HOSPITAL' },
    });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Rabies Certificate' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createCompanionDocumentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Rabies Certificate',
          category: 'HEALTH',
          subcategory: 'VACCINATION_AND_PARASITE_PREVENTION',
          visitType: 'HOSPITAL',
          issuingBusinessName: 'Yosemite Vet',
          attachments: [
            {
              key: 'doc-key',
              mimeType: 'application/pdf',
              size: 1234,
            },
          ],
        }),
        'comp-1'
      );
    });

    expect(onUploaded).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });
});
