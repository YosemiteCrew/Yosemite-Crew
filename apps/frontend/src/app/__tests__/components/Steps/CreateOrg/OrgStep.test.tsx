import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrgStep from "../../../../components/Steps/CreateOrg/OrgStep";
import { createOrg } from "../../../../services/orgService";
import { useRouter } from "next/navigation";
import { validatePhone, getCountryCode } from "../../../../utils/validators";
import { Organisation } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../../../services/orgService");
jest.mock("../../../../utils/validators");

jest.mock(
  "../../../../components/Inputs/FormInput/FormInput",
  () =>
    ({ inname, onChange, value, error }: any) => (
      <div data-testid={`wrapper-${inname}`}>
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

jest.mock(
  "../../../../components/Inputs/Dropdown/Dropdown",
  () =>
    ({ onChange, value, error }: any) => (
      <div data-testid="wrapper-country">
        <select
          data-testid="input-country"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          <option value="US">United States</option>
        </select>
        {error && <span data-testid="error-country">{error}</span>}
      </div>
    )
);

jest.mock(
  "../../../../components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown",
  () =>
    ({ onChange, value, error }: any) => (
      <div data-testid="wrapper-name">
        <input data-testid="input-name" value={value} onChange={onChange} />
        {error && <span data-testid="error-name">{error}</span>}
      </div>
    )
);

jest.mock(
  "../../../../components/UploadImage/LogoUploader",
  () =>
    ({ setImageUrl }: any) => (
      <button
        data-testid="upload-logo"
        onClick={() => setImageUrl("https://mock-logo.com/image.png")}
      >
        Upload Logo
      </button>
    )
);

jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button data-testid="btn-back">{text}</button>,
}));

describe("OrgStep Component", () => {
  const mockNextStep = jest.fn();
  const mockSetFormData = jest.fn();
  const mockRouterReplace = jest.fn();

  const emptyFormData = {
    name: "",
    type: "",
    address: { country: "" },
    phoneNo: "",
    taxId: "",
    imageURL: "",
  } as unknown as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
  });

  // --- Section 1: Rendering ---
  it("renders all main inputs and type options", () => {
    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText("Organisation")).toBeInTheDocument();
    expect(screen.getByTestId("input-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-country")).toBeInTheDocument();
    expect(screen.getByTestId("input-number")).toBeInTheDocument();
    expect(screen.getByTestId("input-tax id")).toBeInTheDocument();

    const typeButtons = screen.getAllByRole("button");
    expect(typeButtons.length).toBeGreaterThan(0);
  });

  // --- Section 2: Input & State Handling ---
  it("updates form data when inputs change", () => {
    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "My Org" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Org" })
    );

    fireEvent.change(screen.getByTestId("input-country"), {
      target: { value: "US" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ country: "US" }),
      })
    );

    fireEvent.change(screen.getByTestId("input-number"), {
      target: { value: "123456" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNo: "123456" })
    );

    const buttons = screen.getAllByRole("button");
    if (buttons.length > 3) {
      fireEvent.click(buttons[1]);
      expect(mockSetFormData).toHaveBeenCalled();
    }
  });

  it("updates logo url when uploader triggers", () => {
    let stateCallback: any;
    mockSetFormData.mockImplementation((cb: any) => {
      stateCallback = cb;
    });

    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("upload-logo"));

    const newState = stateCallback(emptyFormData);
    expect(newState.imageURL).toBe("https://mock-logo.com/image.png");
  });

  // --- Section 3: Validation ---
  it("shows errors for missing required fields", async () => {
    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(screen.getByTestId("error-name")).toHaveTextContent(
        "Name is required"
      );
      expect(screen.getByTestId("error-country")).toHaveTextContent(
        "Country is required"
      );
      // Updated expectation to match actual logic flow
      expect(screen.getByTestId("error-number")).toHaveTextContent(
        "Valid number is required"
      );
      expect(screen.getByTestId("error-tax id")).toHaveTextContent(
        "TaxID is required"
      );
    });

    expect(createOrg).not.toHaveBeenCalled();
  });

  it("validates phone number correctly", async () => {
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(false);

    const invalidPhoneData = {
      ...emptyFormData,
      name: "Valid Name",
      address: { country: "US" },
      phoneNo: "invalid",
      taxId: "123",
    };

    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={invalidPhoneData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(screen.getByTestId("error-number")).toHaveTextContent(
        "Valid number is required"
      );
    });

    expect(validatePhone).toHaveBeenCalledWith("+1invalid");
  });

  // --- Section 4: Submission ---
  it("submits successfully when data is valid", async () => {
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createOrg as jest.Mock).mockResolvedValue("new-org-id");

    const validData = {
      name: "Good Org",
      address: { country: "US" },
      phoneNo: "1234567890",
      taxId: "TAX-123",
      type: "VET",
    } as unknown as Organisation;

    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={validData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createOrg).toHaveBeenCalledWith(validData);
      expect(mockRouterReplace).toHaveBeenCalledWith(
        "/create-org?orgId=new-org-id"
      );
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  it("handles submission error gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createOrg as jest.Mock).mockRejectedValue(new Error("API Error"));

    const validData = {
      name: "Good Org",
      address: { country: "US" },
      phoneNo: "1234567890",
      taxId: "TAX-123",
    } as unknown as Organisation;

    render(
      <OrgStep
        nextStep={mockNextStep}
        formData={validData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createOrg).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating organization:",
        expect.any(Error)
      );
      expect(mockNextStep).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
