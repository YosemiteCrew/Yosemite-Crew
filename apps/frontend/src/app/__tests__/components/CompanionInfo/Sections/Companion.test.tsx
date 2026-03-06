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
          edit
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
        onClick={() => onSelect({ value: options[0]?.value ?? '' })}
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

    fireEvent.click(screen.getByText('edit'));

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
});
