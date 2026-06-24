import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { logger } from '@/app/lib/logger';

// --- Mocks ---

// Mock Icons
jest.mock('@iconify/react/dist/iconify.js', () => ({
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
});
