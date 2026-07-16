import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Companion from '@/app/features/companions/components/Sections/Companion';

const updateCompanionMock = jest.fn();
const fetchSpeciesCodeEntriesMock = jest.fn();
const fetchBreedCodeEntriesMock = jest.fn();

jest.mock('@/app/features/companions/services/companionService', () => ({
  updateCompanion: (...args: any[]) => updateCompanionMock(...args),
}));

jest.mock('@/app/features/companions/services/codeEntriesService', () => ({
  fetchSpeciesCodeEntries: (...args: any[]) => fetchSpeciesCodeEntriesMock(...args),
  fetchBreedCodeEntries: (...args: any[]) => fetchBreedCodeEntriesMock(...args),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children, onEditClick, showEditIcon, isEditing }: any) => (
    <div>
      <div>{title}</div>
      {showEditIcon && !isEditing ? (
        <button type="button" onClick={onEditClick}>
          {`edit-${title}`}
        </button>
      ) : null}
      <div>{children}</div>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div>
      <input data-testid={`input-${inlabel}`} value={value ?? ''} onChange={(e) => onChange(e)} />
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ currentDate, setCurrentDate, placeholder, error }: any) => (
    <div>
      <input
        data-testid={`datepicker-${placeholder}`}
        value={currentDate ? 'set' : ''}
        onChange={() => setCurrentDate(new Date('2025-01-01T00:00:00.000Z'))}
      />
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/SelectLabel', () => ({
  __esModule: true,
  default: ({ title, options, setOption, activeOption }: any) => (
    <div>
      <div>{title}</div>
      <button
        type="button"
        data-testid={`select-${title}`}
        onClick={() => setOption(options[0].value)}
      >
        {activeOption}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption, error }: any) => (
    <div>
      <button
        type="button"
        data-testid={`dropdown-${placeholder}`}
        onClick={() =>
          onSelect({
            value:
              placeholder === 'Companion status'
                ? (options[1]?.value ?? options[0]?.value ?? '')
                : (options[0]?.value ?? ''),
          })
        }
      >
        {defaultOption || placeholder}
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('CompanionInfo Companion section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpeciesCodeEntriesMock.mockResolvedValue([
      { code: 'SP-DOG', display: 'canine' },
      { code: 'SP-CAT', display: 'feline' },
      { code: 'SP-HORSE', display: 'equine' },
    ]);
    fetchBreedCodeEntriesMock.mockResolvedValue([{ code: 'BR-1', display: 'Labrador' }]);
    updateCompanionMock.mockResolvedValue(undefined);
  });

  const companion = {
    companion: {
      id: 'comp-1',
      organisationId: 'org-1',
      parentId: 'parent-1',
      name: 'Buddy',
      status: 'active',
      type: 'dog',
      speciesCode: 'SP-DOG',
      breed: 'Labrador',
      breedCode: 'BR-1',
      dateOfBirth: new Date('2022-01-01T00:00:00.000Z'),
      gender: 'male',
      currentWeight: 10,
      colour: 'Brown',
      isneutered: true,
      ageWhenNeutered: '2',
      bloodGroup: 'DEA 1.1 Positive',
      countryOfOrigin: 'USA',
      source: 'breeder',
      microchipNumber: 'M-1',
      passportNumber: 'P-1',
      isInsured: true,
      insurance: { isInsured: true, companyName: 'InsureCo', policyNumber: 'PC-1' },
    },
    parent: {
      id: 'parent-1',
      firstName: 'Sam',
      lastName: 'M',
    },
  } as any;

  it('renders companion details including species/breed and insurance details', async () => {
    render(<Companion companion={companion} />);

    expect(screen.getByText('Companion information')).toBeInTheDocument();
    expect(screen.getByText('Species')).toBeInTheDocument();
    expect(screen.getByText('Breed')).toBeInTheDocument();
    expect(screen.getByText('Insurance company')).toBeInTheDocument();
    expect(screen.getByText('InsureCo')).toBeInTheDocument();
    expect(fetchSpeciesCodeEntriesMock).not.toHaveBeenCalled();
    expect(fetchBreedCodeEntriesMock).not.toHaveBeenCalled();
  });

  it('shows edit controls and updates companion via PUT payload', async () => {
    render(<Companion companion={companion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));

    await waitFor(() => {
      expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled();
      expect(fetchBreedCodeEntriesMock).toHaveBeenCalled();
    });

    expect(screen.getByTestId('dropdown-Species')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-Breed')).toBeInTheDocument();
    expect(screen.getByTestId('select-Insurance')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateCompanionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'comp-1',
          type: expect.any(String),
          breed: expect.any(String),
        })
      );
    });
  });

  it('shows status accordion and routes edit action through callback', () => {
    render(<Companion companion={companion} canEditCompanionStatus={true} />);

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Current status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'edit-Status' }));

    expect(screen.getByTestId('dropdown-Companion status')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dropdown-Companion status'));
    fireEvent.click(screen.getByText('Save'));

    expect(updateCompanionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comp-1',
        status: 'archived',
      })
    );
  });

  it('cancels status editing without saving', () => {
    render(<Companion companion={companion} canEditCompanionStatus={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Status' }));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByText('Current status')).toBeInTheDocument();
    expect(updateCompanionMock).not.toHaveBeenCalled();
  });

  it('logs and swallows an error when the status update fails', async () => {
    updateCompanionMock.mockRejectedValueOnce(new Error('status save failed'));
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    render(<Companion companion={companion} canEditCompanionStatus={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Status' }));
    fireEvent.click(screen.getByTestId('dropdown-Companion status'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleLogSpy.mockRestore();
  });

  it('cancels edit mode and restores the original companion values', () => {
    render(<Companion companion={companion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    expect(screen.getByTestId('dropdown-Species')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByTestId('dropdown-Species')).not.toBeInTheDocument();
    expect(screen.getByText('Species')).toBeInTheDocument();
  });

  it('shows validation errors for missing species, breed, and date of birth', async () => {
    const incompleteCompanion = {
      companion: {
        ...companion.companion,
        type: '',
        breed: '',
        dateOfBirth: undefined,
      },
      parent: companion.parent,
    } as any;

    render(<Companion companion={incompleteCompanion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Species is required')).toBeInTheDocument();
    expect(screen.getByText('Breed is required')).toBeInTheDocument();
    expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
    expect(updateCompanionMock).not.toHaveBeenCalled();
  });

  it('requires insurance company and policy number when marked insured', async () => {
    const uninsuredCompanion = {
      companion: {
        ...companion.companion,
        isInsured: false,
        insurance: undefined,
      },
      parent: companion.parent,
    } as any;

    render(<Companion companion={uninsuredCompanion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('select-Insurance'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Company name is required')).toBeInTheDocument();
    expect(screen.getByText('Policy number is required')).toBeInTheDocument();
    expect(updateCompanionMock).not.toHaveBeenCalled();
  });

  it('shows unable-to-resolve errors when species/breed codes cannot be determined', async () => {
    fetchSpeciesCodeEntriesMock.mockResolvedValue([]);
    const catCompanion = {
      companion: { ...companion.companion, type: 'cat', breed: 'Persian', speciesCode: '' },
      parent: companion.parent,
    } as any;

    render(<Companion companion={catCompanion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    // Selecting a species clears the breed field, so re-select a breed (from the
    // still-resolvable breed fixture) to isolate the species code-resolution failure.
    fireEvent.click(screen.getByTestId('dropdown-Species'));
    fireEvent.click(await screen.findByTestId('dropdown-Breed'));
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Unable to resolve species code for selected species.')
    ).toBeInTheDocument();
    expect(updateCompanionMock).not.toHaveBeenCalled();
  });

  it('recovers when code resolution throws and still allows the save to proceed', async () => {
    // Keep the initially-loaded species options code-less so the save-time lookup
    // is actually invoked (and can be made to reject) instead of short-circuiting.
    fetchSpeciesCodeEntriesMock.mockResolvedValue([]);
    const catCompanion = {
      companion: { ...companion.companion, type: 'cat', breed: 'Persian', speciesCode: '' },
      parent: companion.parent,
    } as any;

    render(<Companion companion={catCompanion} />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    // Selecting a species clears the breed field, so re-select a breed to satisfy
    // basic field validation before the code-resolution step runs.
    fireEvent.click(screen.getByTestId('dropdown-Species'));
    fireEvent.click(await screen.findByTestId('dropdown-Breed'));
    fetchSpeciesCodeEntriesMock.mockRejectedValueOnce(new Error('lookup failed'));
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleLogSpy.mockRestore();
  });

  it('logs and swallows an error when saving the companion form fails', async () => {
    updateCompanionMock.mockRejectedValueOnce(new Error('save failed'));
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    render(<Companion companion={companion} />);
    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleLogSpy.mockRestore();
  });

  it('updates the remaining edit-form fields via their change handlers', async () => {
    const unneuteredCompanion = {
      companion: { ...companion.companion, isneutered: false, ageWhenNeutered: '' },
      parent: companion.parent,
    } as any;

    render(<Companion companion={unneuteredCompanion} />);
    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    // Toggle neutered on to reveal the age input, then edit it.
    fireEvent.click(screen.getByTestId('select-Neutered status'));
    const ageInput = await screen.findByTestId('input-Age when neutered (optional)');
    fireEvent.change(ageInput, { target: { value: '2-0' } });

    fireEvent.change(screen.getByTestId('input-Color (optional)'), {
      target: { value: 'Golden' },
    });
    fireEvent.change(screen.getByTestId('input-Current weight (optional) (kg)'), {
      target: { value: 'not-a-number' },
    });
    fireEvent.change(screen.getByTestId('input-Microchip number (optional)'), {
      target: { value: 'MC-99' },
    });
    fireEvent.change(screen.getByTestId('input-Passport number (optional)'), {
      target: { value: 'P!@#123' },
    });
    fireEvent.click(screen.getByTestId('dropdown-Blood group (optional)'));
    fireEvent.click(screen.getByTestId('dropdown-Country of origin (optional)'));
    fireEvent.click(screen.getByTestId('select-My companion comes from:'));

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateCompanionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          colour: 'Golden',
          microchipNumber: 'MC-99',
          passportNumber: 'P123',
        })
      );
    });
  });

  it('changes species and breed selections, resetting the breed field', async () => {
    const catCompanion = {
      companion: { ...companion.companion, type: 'cat', breed: 'Persian' },
      parent: companion.parent,
    } as any;

    render(<Companion companion={catCompanion} />);
    fireEvent.click(screen.getByRole('button', { name: 'edit-Companion information' }));
    await waitFor(() => expect(fetchSpeciesCodeEntriesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('dropdown-Species'));
    fireEvent.click(screen.getByTestId('dropdown-Breed'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateCompanionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dog',
          breed: 'Labrador',
        })
      );
    });
  });
});
