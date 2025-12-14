import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddressStep from "@/app/components/Steps/CreateOrg/AddressStep";
import { updateOrg } from "@/app/services/orgService";
import { Organisation } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Services
jest.mock("@/app/services/orgService", () => ({
  updateOrg: jest.fn(),
}));

// Mock UI Components
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ value, onChange, error, inlabel }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  );
});

// --- Test Data ---

// Fixed: Used valid 'type' literal ("HOSPITAL") and added required fields
const mockOrgData: Organisation = {
  _id: "org-temp",
  name: "New Org",
  type: "HOSPITAL", // Fixed: "Clinic" is not a valid type in Organisation union
  phoneNo: "", // Added required field
  taxId: "", // Added required field
  address: {
    addressLine: "",
    city: "",
    state: "",
    country: "USA", // Country pre-filled from previous step
    postalCode: "",
  },
} as Organisation;

describe("AddressStep Component", () => {
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();
  const mockSetFormData = jest.fn();
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // --- 1. Rendering and State Management ---

  it("renders all required input fields", () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={mockOrgData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.getByTestId("input-Address line 1")).toBeInTheDocument();
    expect(screen.getByTestId("input-City")).toBeInTheDocument();
    expect(screen.getByTestId("input-State/Province")).toBeInTheDocument();
    expect(screen.getByTestId("input-Postal code")).toBeInTheDocument();
    expect(screen.getByTestId("next-btn")).toBeInTheDocument();
  });

  it("updates form data on input change (Address line)", () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={mockOrgData}
        setFormData={mockSetFormData}
      />
    );

    const input = screen.getByTestId("input-Address line 1");
    fireEvent.change(input, { target: { value: "456 Oak Lane" } });

    // Verify setFormData is called with correct nested update logic
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockOrgData,
        address: expect.objectContaining({
          ...mockOrgData.address,
          addressLine: "456 Oak Lane",
        }),
      })
    );
  });

  // --- 2. Validation ---

  it("prevents next step and shows errors if required fields are empty", async () => {
    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={mockOrgData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));

    // Check all four required fields have errors
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

  // --- 3. Success Flow ---

  it("calls updateOrg and proceeds to next step on successful save", async () => {
    (updateOrg as jest.Mock).mockResolvedValue({});

    // Setup state as if it were fully filled out
    const completedOrgData: Organisation = {
      ...mockOrgData,
      address: {
        addressLine: "123 Main St",
        city: "Sampleton",
        state: "CA",
        country: "USA",
        postalCode: "90210",
      },
    } as Organisation;

    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={completedOrgData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));

    expect(updateOrg).toHaveBeenCalledWith(completedOrgData);

    await waitFor(() => {
      expect(mockNextStep).toHaveBeenCalledTimes(1);
    });

    // Should have no errors now
    expect(
      screen.queryByTestId("error-Address line 1")
    ).not.toBeInTheDocument();
  });

  // --- 4. Error Flow ---

  it("logs error and does not proceed if updateOrg fails", async () => {
    (updateOrg as jest.Mock).mockRejectedValue(new Error("Network fail"));

    const completedOrgData: Organisation = {
      ...mockOrgData,
      address: {
        addressLine: "123 Main St",
        city: "Sampleton",
        state: "CA",
        country: "USA",
        postalCode: "90210",
      },
    } as Organisation;

    render(
      <AddressStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={completedOrgData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error updating organization:",
        expect.any(Error)
      );
    });

    expect(mockNextStep).not.toHaveBeenCalled();
  });
});
