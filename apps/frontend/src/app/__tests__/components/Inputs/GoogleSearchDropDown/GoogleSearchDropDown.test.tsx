import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import GoogleSearchDropDown from "@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown";

// --- Mocks ---

// Mock Icons
jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <div data-testid="error-icon" />,
}));

// Mock Country List
jest.mock("@/app/utils/countryList.json", () => [
  { name: "United States", code: "US" },
  { name: "Canada", code: "CA" },
]);

// Mock Global Fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

// Mock environment variables for API key
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "TEST_API_KEY",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("GoogleSearchDropDown Component", () => {
  const mockOnChange = jest.fn();
  const mockSetFormData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // --- 1. Initial Rendering ---

  it("renders the input field correctly", () => {
    render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address Search"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(screen.getByLabelText("Address Search")).toBeInTheDocument();
  });

  it("renders with an initial value", () => {
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

  it("displays error message when error prop is provided", () => {
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

    expect(screen.getByText("Invalid address")).toBeInTheDocument();
    expect(screen.getByTestId("error-icon")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("is-invalid");
  });

  // --- 2. Interaction & API Calls (Autocomplete) ---

  it("calls Google Places Autocomplete API on input change after debounce", async () => {
    // Mock successful autocomplete response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "place_123",
              text: { text: "New York, NY" },
              structuredFormat: {
                mainText: { text: "New York" },
                secondaryText: { text: "NY, USA" },
              },
            },
          },
        ],
      }),
    });

    // Initial render
    const { rerender } = render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input); // Trigger focus to allow dropdown open

    // Simulate prop update (typing)
    rerender(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value="New"
        onChange={mockOnChange}
      />
    );

    // Fast-forward debounce timer (400ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:autocomplete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ input: "New" }),
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "TEST_API_KEY",
        }),
      })
    );

    // Dropdown should appear with result
    expect(await screen.findByText("New York")).toBeInTheDocument();
  });

  it("handles autocomplete API failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    // Silence console.error for this specific test as the component logs errors
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { rerender } = render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value=""
        onChange={mockOnChange}
      />
    );

    fireEvent.focus(screen.getByRole("textbox"));

    // Trigger update
    rerender(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value="Fail"
        onChange={mockOnChange}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    // Should log error but not crash
    expect(consoleSpy).toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  // --- 3. Selection & Details Fetching ---

  it("fetches place details and autofills form data on selection (Organisation Mode)", async () => {
    // 1. Mock Autocomplete Response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "place_123",
              structuredFormat: {
                mainText: { text: "Google HQ" },
                secondaryText: { text: "Mountain View, CA" },
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
        id: "place_123",
        displayName: { text: "Google Plex" },
        formattedAddress:
          "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        websiteUri: "https://google.com",
        nationalPhoneNumber: "(650) 253-0000",
        location: { latitude: 37.422, longitude: -122.084 },
        addressComponents: [
          { types: ["country"], shortText: "US" },
          { types: ["locality"], longText: "Mountain View" },
          { types: ["administrative_area_level_1"], shortText: "CA" },
          { types: ["postal_code"], longText: "94043" },
        ],
      }),
    });

    const { rerender } = render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
      />
    );

    // Trigger autocomplete
    fireEvent.focus(screen.getByRole("textbox"));
    rerender(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value="Goo"
        onChange={mockOnChange}
        setFormData={mockSetFormData}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    // Click suggestion
    const suggestion = await screen.findByText("Google HQ");

    // Component uses onMouseDown/onPointerDown to prevent blur
    await act(async () => {
      fireEvent.mouseDown(suggestion);
    });

    // 1. Verify Place Details API call
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("places/place_123"),
      expect.objectContaining({ method: "GET" })
    );

    // 2. Verify setFormData call
    expect(mockSetFormData).toHaveBeenCalled();

    // Simulate the functional state update
    const updateFn = mockSetFormData.mock.calls[0][0];
    const prevState = {};
    const newState = updateFn(prevState);

    expect(newState).toEqual({
      name: "Google Plex",
      phoneNo: "6502530000", // Normalized by component
      website: "https://google.com",
      googlePlacesId: "place_123",
      address: {
        country: "United States", // From mock countries JSON
        addressLine: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        city: "Mountain View",
        state: "CA",
        postalCode: "94043",
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
          { placePrediction: { placeId: "place_456", text: { text: "Home" } } },
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        formattedAddress: "123 Test St",
        addressComponents: [{ types: ["locality"], longText: "Test City" }],
        location: { latitude: 10, longitude: 20 },
      }),
    });

    const { rerender } = render(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value=""
        onChange={mockOnChange}
        setFormData={mockSetFormData}
        onlyAddress={true}
      />
    );

    fireEvent.focus(screen.getByRole("textbox"));
    rerender(
      <GoogleSearchDropDown
        intype="text"
        inname="address"
        inlabel="Address"
        value="Ho"
        onChange={mockOnChange}
        setFormData={mockSetFormData}
        onlyAddress={true}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    const suggestion = await screen.findByText("Home");
    fireEvent.mouseDown(suggestion);

    await waitFor(() => expect(mockSetFormData).toHaveBeenCalled());

    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn({ personalDetails: { address: {} } });

    // Verify UserProfile structure update (nested under personalDetails.address)
    expect(newState.personalDetails.address).toEqual(
      expect.objectContaining({
        addressLine: "123 Test St",
        city: "Test City",
        latitude: 10,
        longitude: 20,
      })
    );
  });

  // --- 4. UX & Event Handling ---

  it("closes dropdown when clicking outside", async () => {
    // Setup open dropdown
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [{ placePrediction: { text: { text: "Result" } } }],
      }),
    });

    const { rerender } = render(
      <div>
        <GoogleSearchDropDown
          value=""
          inlabel="Search"
          intype="text"
          onChange={mockOnChange}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    rerender(
      <div>
        <GoogleSearchDropDown
          value="Test"
          inlabel="Search"
          intype="text"
          onChange={mockOnChange}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(await screen.findByText("Result")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(screen.queryByText("Result")).not.toBeInTheDocument();
  });

  it("does not fetch if input is readonly or too short", async () => {
    // Short query
    render(
      <GoogleSearchDropDown
        value="A"
        inlabel="Search"
        intype="text"
        onChange={mockOnChange}
      />
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Readonly case - mockOnChange needed for React, even if readonly prop is true on component
    render(
      <GoogleSearchDropDown
        value="Long Enough"
        inlabel="Search"
        intype="text"
        onChange={mockOnChange}
        readonly
      />
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
