import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfessionalStep from "../../../../components/Steps/TeamOnboarding/ProfessionalStep";
import { updateUserProfile } from "@/app/services/profileService";
import { UserProfile } from "@/app/types/profile";

// --- Mocks ---

// 1. Mock Service
jest.mock("@/app/services/profileService", () => ({
  updateUserProfile: jest.fn(),
}));

// 2. Mock Child Components
jest.mock(
  "../../../../components/Inputs/FormInput/FormInput",
  () =>
    ({ inname, onChange, value, error, inlabel }: any) => (
      <div data-testid={`wrapper-${inname}`}>
        <label>{inlabel}</label>
        <input
          data-testid={`input-${inname}`}
          name={inname}
          value={value}
          onChange={onChange}
        />
        {error && <span data-testid={`error-${inname}`}>{error}</span>}
      </div>
    )
);

jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("ProfessionalStep Component", () => {
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn(); // Although not used in UI, it's in props
  const mockSetFormData = jest.fn();
  const mockOrgId = "org-123";

  const emptyFormData: UserProfile = {
    professionalDetails: {
      linkedin: "",
      medicalLicenseNumber: "",
      yearsOfExperience: 0,
      specialization: "",
      qualification: "",
      biography: "",
    },
  } as unknown as UserProfile;

  const validFormData: UserProfile = {
    professionalDetails: {
      linkedin: "https://linkedin.com/in/test",
      medicalLicenseNumber: "LIC-123",
      yearsOfExperience: 5,
      specialization: "General Surgery",
      qualification: "MD",
      biography: "Bio text",
    },
  } as unknown as UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders all inputs correctly", () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    expect(screen.getByText("Professional details")).toBeInTheDocument();
    expect(screen.getByTestId("input-linkedin")).toBeInTheDocument();
    expect(screen.getByTestId("input-license number")).toBeInTheDocument();
    expect(screen.getByTestId("input-Years of experience")).toBeInTheDocument();
    expect(screen.getByTestId("input-Specialisation")).toBeInTheDocument();
    expect(screen.getByTestId("input-Qualification")).toBeInTheDocument();
    expect(screen.getByTestId("input-Biography")).toBeInTheDocument();
    expect(screen.getByTestId("btn-next")).toBeInTheDocument();
  });

  // --- Section 2: Input & State Handling ---
  it("updates form data on input change", () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    // LinkedIn
    fireEvent.change(screen.getByTestId("input-linkedin"), {
      target: { value: "link" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    // License
    fireEvent.change(screen.getByTestId("input-license number"), {
      target: { value: "123" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    // Years (Number logic)
    fireEvent.change(screen.getByTestId("input-Years of experience"), {
      target: { value: "5" },
    });
    // Check specific implementation detail if needed, but checking call count is usually sufficient for controlled inputs in unit tests
    expect(mockSetFormData).toHaveBeenCalled();

    // Specialisation
    fireEvent.change(screen.getByTestId("input-Specialisation"), {
      target: { value: "Cardio" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    // Qualification
    fireEvent.change(screen.getByTestId("input-Qualification"), {
      target: { value: "MBBS" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    // Bio
    fireEvent.change(screen.getByTestId("input-Biography"), {
      target: { value: "My Bio" },
    });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // --- Section 3: Validation ---
  it("shows errors for missing required fields", async () => {
    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(screen.getByTestId("error-Years of experience")).toHaveTextContent(
        "Years of experience is required"
      );
      expect(screen.getByTestId("error-Specialisation")).toHaveTextContent(
        "Specialisation is required"
      );
      expect(screen.getByTestId("error-Qualification")).toHaveTextContent(
        "Qualification is required"
      );
    });

    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("handles null/undefined professionalDetails object gracefully during validation", async () => {
    const nullData = {} as UserProfile; // professionalDetails is undefined

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={nullData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      // Should still show errors because optional chaining returns undefined, triggering !undefined
      expect(screen.getByText("Professional details")).toBeInTheDocument();
    });

    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  // --- Section 4: Submission & Error Handling ---
  it("submits successfully when data is valid", async () => {
    (updateUserProfile as jest.Mock).mockResolvedValue({});

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(validFormData, mockOrgId);
    });
  });

  it("logs error if API update fails", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (updateUserProfile as jest.Mock).mockRejectedValue(new Error("API Error"));

    render(
      <ProfessionalStep
        nextStep={mockNextStep}
        prevStep={mockPrevStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error updating profile:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
