import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddressStep from "../../../../components/Steps/CreateOrg/AddressStep";
import { updateOrg } from "../../../../services/orgService";
import { Organisation } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("../../../../services/orgService", () => ({
  updateOrg: jest.fn(),
}));

// Mock Buttons component since it might have complex logic/styles
jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: { onClick: () => void; text: string }) => (
    <button onClick={onClick} data-testid="next-button">
      {text}
    </button>
  ),
}));

// Mock FormInput to simplify testing
jest.mock(
  "../../../../components/Inputs/FormInput/FormInput",
  () =>
    ({ inlabel, onChange, value, error }: any) => (
      <div data-testid={`input-wrapper-${inlabel}`}>
        <label>{inlabel}</label>
        <input
          aria-label={inlabel}
          value={value}
          onChange={onChange}
          data-testid={`input-${inlabel}`}
        />
        {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
      </div>
    )
);

describe("AddressStep Component", () => {
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();
  const mockSetFormData = jest.fn();

  const emptyFormData: Organisation = {
    address: {
      addressLine: "",
      city: "",
      state: "",
      postalCode: "",
    },
  } as unknown as Organisation;

  const validFormData: Organisation = {
    address: {
      addressLine: "123 Main St",
      city: "Tech City",
      state: "CA",
      postalCode: "90210",
    },
  } as unknown as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders all address input fields", () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.getByTestId("input-Address line 1")).toBeInTheDocument();
    expect(screen.getByTestId("input-City")).toBeInTheDocument();
    expect(screen.getByTestId("input-State/Province")).toBeInTheDocument();
    expect(screen.getByTestId("input-Postal code")).toBeInTheDocument();
    expect(screen.getByTestId("next-button")).toBeInTheDocument();
  });

  // --- Section 2: Input Handling ---
  it("updates form data on input change", () => {
    // We need a wrapper to update local state in the test if we want to simulate controlled inputs perfectly,
    // but verifying the setFormData call is sufficient for unit testing the component's prop usage.
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    const addressInput = screen.getByTestId("input-Address line 1");
    fireEvent.change(addressInput, { target: { value: "New Address" } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ addressLine: "New Address" }),
      })
    );
  });

  it("updates city, state, and postal code correctly", () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId("input-City"), {
      target: { value: "New City" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ city: "New City" }),
      })
    );

    fireEvent.change(screen.getByTestId("input-State/Province"), {
      target: { value: "NY" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ state: "NY" }),
      })
    );

    fireEvent.change(screen.getByTestId("input-Postal code"), {
      target: { value: "10001" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ postalCode: "10001" }),
      })
    );
  });

  // --- Section 3: Validation ---
  it("shows validation errors if fields are empty on submit", async () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(screen.getByTestId("error-Address line 1")).toHaveTextContent(
        "Address is required"
      );
      expect(screen.getByTestId("error-City")).toHaveTextContent(
        "City is required"
      );
      expect(screen.getByTestId("error-State/Province")).toHaveTextContent(
        "State is required"
      );
      expect(screen.getByTestId("error-Postal code")).toHaveTextContent(
        "PostalCode is required"
      );
    });

    expect(updateOrg).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  // --- Section 4: Submission & Error Handling ---
  it("calls updateOrg and nextStep on successful submission", async () => {
    (updateOrg as jest.Mock).mockResolvedValue({});

    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalledWith(validFormData);
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  it("logs error if updateOrg fails", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("Network Error");
    (updateOrg as jest.Mock).mockRejectedValue(error);

    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(updateOrg).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error updating organization:",
        error
      );
      expect(mockNextStep).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
