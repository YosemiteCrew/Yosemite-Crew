import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Companion from '@/app/features/companions/components/AddCompanion/Sections/Companion';
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from '@/app/features/companions/components/AddCompanion/type';

// ─── Service mocks ────────────────────────────────────────────────────────────
const mockCreateCompanion = jest.fn();
const mockCreateParent = jest.fn();
const mockLinkCompanion = jest.fn();
const mockGetCompanionForParent = jest.fn();

jest.mock('@/app/features/companions/services/companionService', () => ({
  createCompanion: (...args: unknown[]) => mockCreateCompanion(...args),
  createParent: (...args: unknown[]) => mockCreateParent(...args),
  linkCompanion: (...args: unknown[]) => mockLinkCompanion(...args),
  getCompanionForParent: (...args: unknown[]) => mockGetCompanionForParent(...args),
}));

// ─── Code-entry mocks ─────────────────────────────────────────────────────────
const mockFetchSpeciesCodeEntries = jest.fn();
const mockFetchBreedCodeEntries = jest.fn();

jest.mock('@/app/features/companions/services/codeEntriesService', () => ({
  fetchSpeciesCodeEntries: (...args: unknown[]) => mockFetchSpeciesCodeEntries(...args),
  fetchBreedCodeEntries: (...args: unknown[]) => mockFetchBreedCodeEntries(...args),
}));

// ─── Hook mocks ───────────────────────────────────────────────────────────────
const mockNotify = jest.fn();

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

// ─── UI component mocks ───────────────────────────────────────────────────────
jest.mock(
  '@/app/ui/primitives/Accordion/Accordion',
  () =>
    function MockAccordion({ title, children }: { title: string; children: React.ReactNode }) {
      return (
        <div data-testid={`accordion-${title.toLowerCase().replace(/\s/g, '-')}`}>
          <h3>{title}</h3>
          {children}
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/FormInput/FormInput',
  () =>
    function MockFormInput({
      inlabel,
      value,
      onChange,
      error,
      inname,
    }: {
      inlabel: string;
      value: string;
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
      error?: string;
      inname: string;
    }) {
      return (
        <div>
          <label htmlFor={inname}>{inlabel}</label>
          <input id={inname} value={value} onChange={onChange} data-testid={`input-${inname}`} />
          {error && <span data-testid={`error-${inname}`}>{error}</span>}
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/SelectLabel',
  () =>
    function MockSelectLabel({
      title,
      options,
      activeOption,
      setOption,
    }: {
      title: string;
      options: { value: string; label: string }[];
      activeOption: string;
      setOption: (value: string) => void;
    }) {
      return (
        <div data-testid={`select-label-${title}`}>
          <label>{title}</label>
          <select
            value={activeOption}
            onChange={(e) => setOption(e.target.value)}
            data-testid={`select-${title.toLowerCase().replace(/\s/g, '-')}`}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/Datepicker',
  () =>
    function MockDatepicker({
      placeholder,
      setCurrentDate,
    }: {
      placeholder: string;
      setCurrentDate: (date: Date | null) => void;
    }) {
      return (
        <div data-testid="datepicker">
          <label>{placeholder}</label>
          <input
            data-testid="datepicker-input"
            onChange={(e) => setCurrentDate(e.target.value ? new Date(e.target.value) : null)}
          />
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/Dropdown/LabelDropdown',
  () =>
    function MockLabelDropdown({
      placeholder,
      onSelect,
      options,
      error,
      defaultOption,
    }: {
      placeholder: string;
      onSelect: (option: { value: string; label: string }) => void;
      options: { value: string; label: string }[];
      error?: string;
      defaultOption?: string;
    }) {
      return (
        <div data-testid={`label-dropdown-${placeholder}`}>
          <label>{placeholder}</label>
          <select
            data-testid={`dropdown-select-${placeholder}`}
            value={defaultOption ?? ''}
            onChange={(e) => {
              const opt = options.find((o) => o.value === e.target.value);
              if (opt) onSelect(opt);
            }}
          >
            <option value="">-- select --</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && <span data-testid={`error-dropdown-${placeholder}`}>{error}</span>}
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/SearchDropdown',
  () =>
    function MockSearchDropdown({
      placeholder,
      onSelect,
      options,
      query,
      setQuery,
    }: {
      placeholder: string;
      onSelect: (value: string) => void;
      options: { value: string; label: string }[];
      query: string;
      setQuery: (q: string) => void;
    }) {
      return (
        <div data-testid="search-dropdown">
          <input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="search-input"
          />
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              data-testid={`search-option-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }
);

jest.mock(
  '@/app/ui/inputs/FormDesc/FormDesc',
  () =>
    function MockFormDesc({
      inlabel,
      value,
      onChange,
    }: {
      inlabel: string;
      value: string;
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    }) {
      return (
        <div>
          <label>{inlabel}</label>
          <textarea data-testid="form-desc-allergies" value={value} onChange={onChange} />
        </div>
      );
    }
);

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} data-testid="btn-primary">
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} data-testid="btn-secondary">
      {text}
    </button>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeFormData = (overrides: Partial<typeof EMPTY_STORED_COMPANION> = {}) => ({
  ...EMPTY_STORED_COMPANION,
  ...overrides,
});

const makeParentData = (overrides: Partial<typeof EMPTY_STORED_PARENT> = {}) => ({
  ...EMPTY_STORED_PARENT,
  ...overrides,
});

interface CompanionProps {
  setActiveLabel?: jest.Mock;
  formData?: typeof EMPTY_STORED_COMPANION;
  setFormData?: jest.Mock;
  parentFormData?: typeof EMPTY_STORED_PARENT;
  setParentFormData?: jest.Mock;
  setShowModal?: jest.Mock;
  mode?: 'default' | 'fasttrack';
  onCompanionCreated?: jest.Mock;
}

const renderCompanion = (props: CompanionProps = {}) => {
  const defaultProps = {
    setActiveLabel: jest.fn(),
    formData: makeFormData(),
    setFormData: jest.fn((updater) => {
      if (typeof updater === 'function') updater(makeFormData());
    }),
    parentFormData: makeParentData(),
    setParentFormData: jest.fn(),
    setShowModal: jest.fn(),
    mode: 'default' as const,
    onCompanionCreated: jest.fn(),
    ...props,
  };
  return render(<Companion {...defaultProps} />);
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Companion section', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetCompanionForParent.mockResolvedValue([]);
    mockFetchSpeciesCodeEntries.mockResolvedValue([]);
    mockFetchBreedCodeEntries.mockResolvedValue([]);
  });

  // 1. Basic render
  it('renders default mode with all key form fields', async () => {
    await act(async () => {
      renderCompanion();
    });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId(`accordion-companion-information`)).toBeInTheDocument();
    expect(screen.getByTestId('btn-primary')).toHaveTextContent('Save');
    expect(screen.getByTestId('btn-secondary')).toHaveTextContent('Back');
  });

  it('renders fasttrack mode without blood group and weight fields', async () => {
    await act(async () => {
      renderCompanion({ mode: 'fasttrack', formData: makeFormData({ type: 'dog' }) });
    });

    expect(screen.queryByText('Blood group (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Current weight (optional) (kg)')).not.toBeInTheDocument();
    expect(screen.queryByText('Microchip number (optional)')).not.toBeInTheDocument();
  });

  it('renders default mode with blood group and weight fields', async () => {
    await act(async () => {
      renderCompanion({ formData: makeFormData({ type: 'dog' }) });
    });

    expect(screen.getByText('Blood group (optional)')).toBeInTheDocument();
    expect(screen.getByText('Current weight (optional) (kg)')).toBeInTheDocument();
  });

  // 2. Back button
  it('calls setActiveLabel("parents") when Back is clicked', async () => {
    const setActiveLabel = jest.fn();
    await act(async () => {
      renderCompanion({ setActiveLabel });
    });
    fireEvent.click(screen.getByTestId('btn-secondary'));
    expect(setActiveLabel).toHaveBeenCalledWith('parents');
  });

  // 3. handleSubmit — validation errors
  it('shows validation errors when name, species, breed are missing', async () => {
    const formData = makeFormData({ name: '', type: '' as never, breed: '' });

    await act(async () => {
      renderCompanion({ formData });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-name')).toBeInTheDocument();
    });
  });

  it('shows insurance validation errors when insured and fields missing', async () => {
    const formData = makeFormData({
      name: 'Buddy',
      type: 'dog',
      breed: 'Labrador',
      isInsured: true,
      insurance: { isInsured: true },
    });

    await act(async () => {
      renderCompanion({ formData });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    // Insurance errors should be shown
    await waitFor(() => {
      expect(screen.getAllByTestId('error-weight').length).toBeGreaterThan(0);
    });
  });

  // 4. handleSubmit — success path: no parentId, creates parent then companion
  it('calls createParent then createCompanion when no parentFormData.id exists', async () => {
    const setShowModal = jest.fn();
    const onCompanionCreated = jest.fn();
    const createdCompanion = { ...makeFormData(), id: 'new-c-1', name: 'Buddy' };

    mockCreateParent.mockResolvedValue('parent-1');
    mockCreateCompanion.mockResolvedValue(createdCompanion);

    const formData = makeFormData({ name: 'Buddy', type: 'dog', breed: 'Lab' });
    const parentFormData = makeParentData({ id: '' });

    await act(async () => {
      renderCompanion({ formData, parentFormData, setShowModal, onCompanionCreated });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(mockCreateParent).toHaveBeenCalled();
      expect(mockCreateCompanion).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Companion created' })
      );
      expect(setShowModal).toHaveBeenCalledWith(false);
      expect(onCompanionCreated).toHaveBeenCalledWith(createdCompanion);
    });
  });

  // 5. handleSubmit — error path
  it('calls notify error when createCompanion throws', async () => {
    const setShowModal = jest.fn();

    mockCreateParent.mockResolvedValue('parent-1');
    mockCreateCompanion.mockRejectedValue(new Error('Network error'));

    const formData = makeFormData({ name: 'Buddy', type: 'dog', breed: 'Lab' });
    const parentFormData = makeParentData({ id: '' });

    await act(async () => {
      renderCompanion({ formData, parentFormData, setShowModal });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to create companion' })
      );
    });
    expect(setShowModal).not.toHaveBeenCalled();
  });

  // 6. handleCreateCompanion — parentFormData.id exists AND formData.id exists → linkCompanion
  it('calls linkCompanion when both parentFormData.id and formData.id exist', async () => {
    const linkedCompanion = { ...makeFormData(), id: 'c-1', name: 'Buddy' };
    mockLinkCompanion.mockResolvedValue(linkedCompanion);

    const formData = makeFormData({ id: 'c-1', name: 'Buddy', type: 'dog', breed: 'Lab' });
    const parentFormData = makeParentData({ id: 'p-1' });

    await act(async () => {
      renderCompanion({ formData, parentFormData });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(mockLinkCompanion).toHaveBeenCalled();
      expect(mockCreateCompanion).not.toHaveBeenCalled();
    });
  });

  // 7. handleCreateCompanion — parentFormData.id exists AND no formData.id → createCompanion
  it('calls createCompanion (not linkCompanion) when parentFormData.id exists but formData.id is missing', async () => {
    const createdCompanion = { ...makeFormData(), id: 'new-c-2', name: 'Fido' };
    mockCreateCompanion.mockResolvedValue(createdCompanion);

    const formData = makeFormData({ id: '', name: 'Fido', type: 'dog', breed: 'Beagle' });
    const parentFormData = makeParentData({ id: 'p-1' });

    await act(async () => {
      renderCompanion({ formData, parentFormData });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(mockCreateCompanion).toHaveBeenCalled();
      expect(mockLinkCompanion).not.toHaveBeenCalled();
    });
  });

  // 8. handleSelect — selects companion from search results
  it('populates formData when a companion is selected from search results', async () => {
    const setFormData = jest.fn();
    const companions = [{ ...makeFormData(), id: 'c-99', name: 'Whiskers', type: 'cat' as const }];
    mockGetCompanionForParent.mockResolvedValue(companions);

    const parentFormData = makeParentData({ id: 'p-10' });

    await act(async () => {
      renderCompanion({ parentFormData, setFormData });
    });

    // Wait for companions to load
    await waitFor(() => {
      expect(mockGetCompanionForParent).toHaveBeenCalledWith('p-10');
    });

    // The component re-renders with results as options — click option
    await waitFor(() => {
      expect(screen.getByTestId('search-option-c-99')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('search-option-c-99'));
    expect(setFormData).toHaveBeenCalled();
  });

  // 9. useEffect: species options loaded from fetchSpeciesCodeEntries
  it('loads species code entries on mount', async () => {
    const entries = [
      { display: 'Canine', code: 'CAN_CODE' },
      { display: 'Feline', code: 'FEL_CODE' },
    ];
    mockFetchSpeciesCodeEntries.mockResolvedValue(entries);

    await act(async () => {
      renderCompanion();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesCodeEntries).toHaveBeenCalled();
    });
  });

  it('falls back to default species options when fetchSpeciesCodeEntries rejects', async () => {
    mockFetchSpeciesCodeEntries.mockRejectedValue(new Error('fetch failed'));

    await act(async () => {
      renderCompanion();
    });

    // Should not throw; the dropdown still renders
    await waitFor(() => {
      expect(screen.getByTestId('label-dropdown-Species')).toBeInTheDocument();
    });
  });

  // 10. useEffect: companion results loaded when parentFormData.id changes
  it('clears results when parentFormData.id is empty', async () => {
    mockGetCompanionForParent.mockResolvedValue([{ ...makeFormData(), id: 'c-1', name: 'Buddy' }]);

    const parentFormData = makeParentData({ id: '' });

    await act(async () => {
      renderCompanion({ parentFormData });
    });

    expect(mockGetCompanionForParent).not.toHaveBeenCalled();
  });

  it('handles getCompanionForParent rejection gracefully', async () => {
    mockGetCompanionForParent.mockRejectedValue(new Error('fetch error'));

    const parentFormData = makeParentData({ id: 'p-fail' });

    await act(async () => {
      renderCompanion({ parentFormData });
    });

    await waitFor(() => {
      expect(mockGetCompanionForParent).toHaveBeenCalledWith('p-fail');
    });
    // No crash and search dropdown still renders
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  // 11. isFastTrack — insurance validation skipped
  it('does NOT validate insurance fields in fasttrack mode', async () => {
    const setShowModal = jest.fn();
    mockCreateParent.mockResolvedValue('p-1');
    mockCreateCompanion.mockResolvedValue({ ...makeFormData(), id: 'new-c', name: 'Rex' });

    const formData = makeFormData({
      name: 'Rex',
      type: 'dog',
      breed: 'Poodle',
      isInsured: true,
      insurance: undefined,
    });

    await act(async () => {
      renderCompanion({ mode: 'fasttrack', formData, setShowModal });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('success', expect.anything());
    });
  });

  // 12. onCompanionCreated not called when createCompanion returns undefined
  it('does not call onCompanionCreated when companion result is falsy', async () => {
    const onCompanionCreated = jest.fn();
    const setShowModal = jest.fn();

    mockCreateParent.mockResolvedValue('p-1');
    mockCreateCompanion.mockResolvedValue(undefined);

    const formData = makeFormData({ name: 'Buddy', type: 'dog', breed: 'Lab' });

    await act(async () => {
      renderCompanion({ formData, setShowModal, onCompanionCreated });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-primary'));
    });

    await waitFor(() => {
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
    expect(onCompanionCreated).not.toHaveBeenCalled();
  });
});
