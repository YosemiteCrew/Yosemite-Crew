import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { logger } from '@/app/lib/logger';

// --- Mocks ---

// Mock Icons
jest.mock('@/app/ui/icons/Icon', () => ({
  Icon: () => <div data-testid="error-icon" />,
}));

// Mock Country List
jest.mock('@/app/lib/data/countryList', () => [
  { name: 'United States', code: 'US' },
  { name: 'Canada', code: 'CA' },
]);

// Mock Global Fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

// Mock environment variables for API key
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'TEST_API_KEY',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('GoogleSearchDropDown Component', () => {
  const mockOnChange = jest.fn();
  const mockSetFormData = jest.fn();
  type ControlledProps = Omit<React.ComponentProps<typeof GoogleSearchDropDown>, 'value'> & {
    initialValue?: string;
  };
  const ControlledGoogleSearchDropDown = ({ initialValue = '', ...props }: ControlledProps) => {
    const [value, setValue] = React.useState(initialValue);
    return (
      <GoogleSearchDropDown
        {...props}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          props.onChange?.(event);
        }}
      />
    );
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // --- 1. Initial Rendering ---

  it('renders the input field correctly', () => {
    render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address Search"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(screen.getByLabelText('Address Search')).toBeInTheDocument();
  });

  it('renders with an initial value', () => {
    render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value="123 Main St"
        onChange={mockOnChange}
      />
    );
  });

  it('displays error message when error prop is provided', () => {
    render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value=""
        error="Invalid address"
        onChange={mockOnChange} // FIX: Added onChange here to prevent console error
      />
    );

    expect(screen.getByText('Invalid address')).toBeInTheDocument();
  });

  // --- 2. Interaction & API Calls (Autocomplete) ---

  it('calls Google Places Autocomplete API on input change after debounce', async () => {
    // Mock successful autocomplete response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place_123',
              text: { text: 'New York, NY' },
              structuredFormat: {
                mainText: { text: 'New York' },
                secondaryText: { text: 'NY, USA' },
              },
            },
          },
        ],
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input); // Trigger focus to allow dropdown open
    fireEvent.change(input, { target: { value: 'New' } });

    // Fast-forward debounce timer (400ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ input: 'New' }),
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'TEST_API_KEY',
        }),
      })
    );

    // Dropdown should appear with detailed, left-aligned content
    expect(await screen.findByText('New York')).toBeInTheDocument();
    expect(screen.getByText('NY, USA')).toBeInTheDocument();
  });

  it('renders query predictions that have no place id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            queryPrediction: {
              text: { text: 'coffee near me' },
              structuredFormat: {
                mainText: { text: 'coffee' },
                secondaryText: { text: 'near me' },
              },
            },
          },
        ],
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cof' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('coffee')).toBeInTheDocument();
    expect(screen.getByText('near me')).toBeInTheDocument();
  });

  it('does not fetch again when the query is unchanged', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [{ placePrediction: { text: { text: 'Result' } } }],
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Repeat' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Same trimmed query again should be short-circuited by lastQueriedRef.
    fireEvent.change(input, { target: { value: 'Repeat ' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles autocomplete API failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Fail' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should log error but not crash
    expect(errorSpy).toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });

  // --- 3. Selection & Details Fetching ---

  it('fetches place details and autofills form data on selection (Organisation Mode)', async () => {
    // 1. Mock Autocomplete Response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place_123',
              structuredFormat: {
                mainText: { text: 'Google HQ' },
                secondaryText: { text: 'Mountain View, CA' },
              },
            },
          },
        ],
      }),
    });

    // 2. Mock Place Details Response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'place_123',
        displayName: { text: 'Google Plex' },
        formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
        websiteUri: 'https://google.com',
        nationalPhoneNumber: '(650) 253-0000',
        location: { latitude: 37.422, longitude: -122.084 },
        addressComponents: [
          { types: ['country'], shortText: 'US', longText: 'United States' },
          { types: ['locality'], longText: 'Mountain View' },
          { types: ['administrative_area_level_1'], longText: 'California', shortText: 'CA' },
          { types: ['postal_code'], longText: '94043' },
        ],
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
      />
    );

    // Trigger autocomplete
    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Goo' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Click suggestion
    const suggestion = await screen.findByText('Google HQ');

    // Component uses onMouseDown/onPointerDown to prevent blur
    await act(async () => {
      fireEvent.mouseDown(suggestion);
    });

    // 1. Verify Place Details API call
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('places/place_123'),
      expect.objectContaining({ method: 'GET' })
    );

    // 2. Verify setFormData call
    expect(mockSetFormData).toHaveBeenCalled();

    // Simulate the functional state update
    const updateFn = mockSetFormData.mock.calls[0][0];
    const prevState = {};
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      name: 'Google Plex',
      phoneNo: '6502530000', // Normalized by component
      website: 'https://google.com',
      googlePlacesId: 'place_123',
      address: {
        country: 'United States', // From mock countries JSON
        // addressLine is derived from prediction text ("Google HQ, Mountain View, CA")
        // with city/state tail stripped → "Google HQ"
        addressLine: 'Google HQ',
        city: 'Mountain View',
        state: 'California', // longText preferred over shortText
        postalCode: '94043',
        latitude: 37.422,
        longitude: -122.084,
      },
    });

    // 3. Verify input value update trigger
    expect(mockOnChange).toHaveBeenCalled();
  });

  it("handles autofill correctly for 'onlyAddress' mode (UserProfile)", async () => {
    // Setup Place Details Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place_456',
              structuredFormat: {
                mainText: { text: '123 Test St' },
                secondaryText: { text: 'Test City, TX, USA' },
              },
            },
          },
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        formattedAddress: '123 Test St, Test City, TX, USA',
        addressComponents: [
          { types: ['locality'], longText: 'Test City' },
          { types: ['administrative_area_level_1'], longText: 'Texas', shortText: 'TX' },
        ],
        location: { latitude: 10, longitude: 20 },
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
        onlyAddress={true}
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ho' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const suggestion = await screen.findByRole('button', { name: /123 Test St/ });
    fireEvent.mouseDown(suggestion);

    await waitFor(() => expect(mockSetFormData).toHaveBeenCalled());

    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn({ personalDetails: { address: {} } });

    // addressLine = "123 Test St, Test City, TX, USA" stripped to "123 Test St"
    // city="Test City", state="Texas" (longText preferred), latitude/longitude populated
    expect(newState.personalDetails.address).toEqual(
      expect.objectContaining({
        addressLine: '123 Test St',
        city: 'Test City',
        state: 'Texas',
        latitude: 10,
        longitude: 20,
      })
    );
  });

  it('renders primary and secondary address text for suggestions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place_789',
              text: { text: '1600 Amphitheatre Parkway, Mountain View, CA, USA' },
              structuredFormat: {
                mainText: { text: '1600 Amphitheatre Parkway' },
                secondaryText: { text: 'Mountain View, CA, USA' },
              },
            },
          },
        ],
      }),
    });

    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1600' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const primary = await screen.findByText('1600 Amphitheatre Parkway');
    const secondary = screen.getByText('Mountain View, CA, USA');

    expect(primary).toBeInTheDocument();
    expect(secondary).toBeInTheDocument();
    expect(primary.closest('button')).toHaveClass('text-left');
  });

  // --- 4. UX & Event Handling ---

  it('closes dropdown when clicking outside', async () => {
    // Setup open dropdown
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [{ placePrediction: { text: { text: 'Result' } } }],
      }),
    });

    render(
      <div>
        <ControlledGoogleSearchDropDown
          initialValue=""
          inlabel="Search"
          intype="text"
          onChange={mockOnChange}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Test' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: /Result/ })).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByText('Result')).not.toBeInTheDocument();
  });

  it('does not fetch if input is readonly or too short', async () => {
    // Short query
    render(
      <ControlledGoogleSearchDropDown
        initialValue="A"
        inlabel="Search"
        intype="text"
        onChange={mockOnChange}
      />
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Readonly case - mockOnChange needed for React, even if readonly prop is true on component
    render(
      <ControlledGoogleSearchDropDown
        initialValue="Long Enough"
        inlabel="Search"
        intype="text"
        onChange={mockOnChange}
        readonly
      />
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- 5. Prediction text derivation edge cases ---

  const openWithSuggestions = async (suggestions: unknown[], query = 'Query') => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions }),
    });
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('renders "Unknown location" with no secondary text for an empty suggestion', async () => {
    // A suggestion object that is neither a placePrediction nor a queryPrediction
    // maps to { kind: 'query', description: '' } → primary falls back to the placeholder.
    await openWithSuggestions([{}]);
    expect(await screen.findByText('Unknown location')).toBeInTheDocument();
  });

  it('derives secondary text from mainText/secondaryText and description variants', async () => {
    await openWithSuggestions([
      // secondaryText equals primary → secondary suppressed
      {
        placePrediction: {
          placeId: 'p_alpha',
          structuredFormat: { mainText: { text: 'Alpha' }, secondaryText: { text: 'Alpha' } },
        },
      },
      // no secondaryText, description starts with primary → tail after primary is used
      {
        placePrediction: {
          placeId: 'p_beta',
          text: { text: 'Beta, State, Country' },
          structuredFormat: { mainText: { text: 'Beta' } },
        },
      },
      // no secondaryText, description does not start with primary → whole description used
      {
        placePrediction: {
          placeId: 'p_gamma',
          text: { text: 'Delta Region' },
          structuredFormat: { mainText: { text: 'Gamma' } },
        },
      },
      // no secondaryText, description equals primary → secondary suppressed
      {
        placePrediction: {
          placeId: 'p_echo',
          text: { text: 'Echo' },
          structuredFormat: { mainText: { text: 'Echo' } },
        },
      },
      // queryPrediction with only structuredFormat.mainText (no text.text)
      {
        queryPrediction: {
          structuredFormat: { mainText: { text: 'QueryOnly' } },
        },
      },
    ]);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('State, Country')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta Region')).toBeInTheDocument();
    expect(screen.getByText('Echo')).toBeInTheDocument();
    expect(screen.getByText('QueryOnly')).toBeInTheDocument();
    // 'Alpha' and 'Echo' rows have their secondary line suppressed → only one text node each
    expect(screen.getAllByText('Alpha')).toHaveLength(1);
    expect(screen.getAllByText('Echo')).toHaveLength(1);
  });

  it('handles an autocomplete response with no suggestions array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Nothing' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sends an empty API key header when the env var is absent', async () => {
    const savedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'NoKey' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': '' }),
      })
    );
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = savedKey;
  });

  // --- 6. Selection / autofill edge cases ---

  const selectFirstSuggestion = async (
    autocomplete: unknown,
    props: Partial<React.ComponentProps<typeof GoogleSearchDropDown>> = {},
    detailsResponse?: { ok: boolean; json?: () => Promise<unknown> } | 'reject'
  ) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => autocomplete,
    });
    if (detailsResponse === 'reject') {
      mockFetch.mockRejectedValueOnce(new Error('network'));
    } else if (detailsResponse) {
      mockFetch.mockResolvedValueOnce(detailsResponse);
    }
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
        {...props}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Pick' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const button = await screen.findByRole('button');
    await act(async () => {
      fireEvent.mouseDown(button);
    });
  };

  it('autofills organisation mode with fallbacks (no phone, no location, city/state fallbacks, startsWith cut)', async () => {
    await selectFirstSuggestion(
      {
        suggestions: [
          {
            placePrediction: {
              placeId: 'p_thane',
              structuredFormat: {
                mainText: { text: 'Thane Store' },
                secondaryText: { text: 'Thane West, Maharashtra, India' },
              },
            },
          },
        ],
      },
      {},
      {
        ok: true,
        json: async () => ({
          id: 'p_thane',
          displayName: { text: 'Thane Store' },
          // no nationalPhoneNumber → normalizeGooglePhoneNumber('') path
          // no location → latitude/longitude null → undefined
          addressComponents: [
            { types: ['country'], shortText: 'US', longText: 'United States' },
            // no locality → falls through to postal_town
            { types: ['postal_town'], longText: 'Thane' },
            // admin_area_level_1 has only shortText → state falls back to shortText
            { types: ['administrative_area_level_1'], shortText: 'MH' },
          ],
        }),
      }
    );

    expect(mockSetFormData).toHaveBeenCalled();
    const newState = mockSetFormData.mock.calls[0][0]({});
    expect(newState).toEqual(
      expect.objectContaining({
        name: 'Thane Store',
        phoneNo: '',
        googlePlacesId: 'p_thane',
        address: expect.objectContaining({
          addressLine: 'Thane Store',
          city: 'Thane',
          state: 'MH',
          country: 'United States',
          latitude: undefined,
          longitude: undefined,
        }),
      })
    );
  });

  it('calls onAddressSelect and skips setFormData when provided (details without components)', async () => {
    const onAddressSelect = jest.fn();
    await selectFirstSuggestion(
      {
        suggestions: [
          {
            placePrediction: {
              placeId: 'p_addr',
              structuredFormat: {
                mainText: { text: 'Foo' },
                secondaryText: { text: 'Bar' },
              },
            },
          },
        ],
      },
      { onAddressSelect },
      {
        ok: true,
        // No locality/postal_town → city falls through to administrative_area_level_2.
        json: async () => ({
          addressComponents: [{ types: ['administrative_area_level_2'], longText: 'District X' }],
        }),
      }
    );
    expect(onAddressSelect).toHaveBeenCalledTimes(1);
    expect(onAddressSelect).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'District X', state: '', country: '' })
    );
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it('recovers gracefully when the place details fetch rejects', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    await selectFirstSuggestion(
      {
        suggestions: [
          {
            placePrediction: {
              placeId: 'p_fail',
              structuredFormat: {
                mainText: { text: 'Fail Place' },
                secondaryText: { text: 'Somewhere' },
              },
            },
          },
        ],
      },
      {},
      'reject'
    );
    // details stays undefined → autofill still runs without crashing
    expect(mockSetFormData).toHaveBeenCalled();
    const newState = mockSetFormData.mock.calls[0][0]({});
    expect(newState.name).toBe('');
    expect(newState.googlePlacesId).toBeUndefined();
    errorSpy.mockRestore();
  });

  it('does not fetch place details for a query prediction (no placeId)', async () => {
    await selectFirstSuggestion({
      suggestions: [
        {
          queryPrediction: {
            text: { text: 'pizza near me' },
          },
        },
      ],
    });
    // Only the autocomplete fetch happened — no details GET.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // --- 7. Focus / blur / short query / pointer handling ---

  it('short-circuits input changes before the field is focused', () => {
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    // Typing without focusing first → shouldFetchRef is false → no debounce scheduled.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'NoFocus' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clears predictions when the trimmed query drops below two characters', async () => {
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // fetchPredictions early-returns for a one-char query — no network call.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reopens the dropdown on refocus when predictions already exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [{ placePrediction: { placeId: 'p1', text: { text: 'Result' } } }],
      }),
    });
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Result' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: /Result/ })).toBeInTheDocument();

    // Blur closes the dropdown but keeps predictions in state.
    fireEvent.blur(input);
    expect(screen.queryByRole('button', { name: /Result/ })).not.toBeInTheDocument();

    // Refocus should reopen because predictions.length > 0.
    fireEvent.focus(input);
    expect(await screen.findByRole('button', { name: /Result/ })).toBeInTheDocument();
  });

  it('selects a prediction via pointerdown as well as mousedown', async () => {
    // Also exercises the details-fetch API key fallback when the env var is absent.
    const savedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'p_pointer',
              structuredFormat: {
                mainText: { text: 'Pointer Place' },
                secondaryText: { text: 'City' },
              },
            },
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p_pointer', displayName: { text: 'Pointer Place' } }),
    });
    render(
      <ControlledGoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        initialValue=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Point' } });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const button = await screen.findByRole('button', { name: /Pointer Place/ });
    await act(async () => {
      fireEvent.pointerDown(button);
    });
    expect(mockSetFormData).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining('places/p_pointer'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': '' }),
      })
    );
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = savedKey;
  });

  it('renders safely when value is nullish', () => {
    render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value={undefined as unknown as string}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
