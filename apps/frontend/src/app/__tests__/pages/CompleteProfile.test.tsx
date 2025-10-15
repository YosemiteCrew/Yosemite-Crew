import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  RenderResult,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import CompleteProfile, {
  HeadText,
} from "@/app/pages/CompleteProfile/CompleteProfile";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { getData, postData } from "@/app/services/axios";
import {
  convertFHIRToAdminDepartments,
  toFHIRBusinessProfile,
} from "@yosemite-crew/fhir";

// --- Mocks Setup ---

beforeAll(() => {
  if (!window.HTMLFormElement.prototype.requestSubmit) {
    window.HTMLFormElement.prototype.requestSubmit = jest.fn();
  }
});

const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/app/pages/Sign/SignUp", () => ({
  __esModule: true,
  FormInput: ({
    inname,
    inlabel,
    value,
    onChange,
    intype = "text",
    ...rest
  }: any) => (
    <div>
      <label htmlFor={inname}>{inlabel}</label>
      <input
        id={inname}
        name={inname}
        type={intype}
        value={value}
        onChange={onChange}
        aria-label={inlabel}
        {...rest}
      />
    </div>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || "mock image"} />,
}));

jest.mock("country-list-json", () => ({
  countries: [
    { name: "United States", code: "US", flag: "🇺🇸" },
    { name: "Canada", code: "CA", flag: "🇨🇦" },
  ],
}));

jest.mock("react-icons/fa6", () => ({
  FaCircleCheck: () => "FaCircleCheck",
  FaSackDollar: () => "FaSackDollar",
  FaSuitcaseMedical: () => "FaSuitcaseMedical",
}));
jest.mock("react-icons/io5", () => ({
  IoLocationSharp: () => "IoLocationSharp",
  IoSearchOutline: () => "IoSearchOutline",
  IoClose: () => "IoClose",
}));
jest.mock("react-icons/io", () => ({
  IoIosArrowDropleft: () => "IoIosArrowDropleft",
  IoIosArrowDropright: () => "IoIosArrowDropright",
  IoMdArrowDropdown: () => "IoMdArrowDropdown",
  IoMdArrowDropup: () => "IoMdArrowDropup",
}));

jest.mock("@/app/services/axios");
jest.mock("@/app/stores/oldAuthStore");
jest.mock("@yosemite-crew/fhir", () => ({
  convertFHIRToAdminDepartments: jest.fn(),
  toFHIRBusinessProfile: jest.fn(),
}));

jest.mock(
  "@/app/components/DynamicSelect/DynamicSelect",
  () =>
    function MockDynamicSelect(props: any) {
      return (
        <select
          data-testid={`select-${props.inname}`}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-label={props.placeholder}
        >
          <option value="">{props.placeholder}</option>
          {props.options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
);
jest.mock(
  "@/app/components/ProfileProgressbar/ProfileProgressbar",
  () =>
    function MockProfileProgressbar({
      progres,
      onclicked,
    }: {
      progres: number;
      onclicked: () => void;
    }) {
      return (
        <div data-testid="profile-progressbar" onClick={onclicked}>
          Progress: {progres}%
        </div>
      );
    }
);

const mockAutocompleteRef = {
  getPlace: () => ({
    formatted_address: "123 Main St, Anytown, USA",
    address_components: [
      { long_name: "123", types: ["street_number"] },
      { long_name: "Main Street", types: ["route"] },
      { long_name: "Anytown", types: ["locality"] },
      {
        long_name: "CA",
        types: ["administrative_area_level_1"],
        short_name: "CA",
      },
      { long_name: "90210", types: ["postal_code"] },
      { long_name: "United States", types: ["country"] },
    ],
    geometry: { location: { lat: () => 34.05, lng: () => -118.25 } },
  }),
};
jest.mock("@react-google-maps/api", () => ({
  LoadScript: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Autocomplete: ({ onLoad, onPlaceChanged, children }: any) => {
    if (onLoad) onLoad(mockAutocompleteRef);
    return React.cloneElement(children, {
      "data-testid": "autocomplete-input",
      onChange: onPlaceChanged,
    });
  },
}));

const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;
const mockUseOldAuthStore = useOldAuthStore as unknown as jest.Mock;
const mockToFHIRBusinessProfile = toFHIRBusinessProfile as jest.Mock;
const mockConvertFHIRToAdminDepartments =
  convertFHIRToAdminDepartments as jest.Mock;

describe("CompleteProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetData.mockResolvedValue({
      data: { data: "irrelevant-fhir-data-for-departments" },
    });
    mockConvertFHIRToAdminDepartments.mockReturnValue([
      { _id: "dep1", name: "Cardiology" },
      { _id: "dep2", name: "Neurology" },
      { _id: "dep3", name: "Dental Clinic" },
    ]);
    mockPostData.mockResolvedValue({ status: 200 });
    mockToFHIRBusinessProfile.mockReturnValue({});
    mockUseOldAuthStore.mockReturnValue({
      userId: "test-user-id",
      profile: null,
    });
    global.URL.createObjectURL = jest.fn(() => "mock-preview-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  const setup = async (): Promise<RenderResult> => {
    const utils = render(<CompleteProfile />);
    await waitFor(() => expect(mockGetData).toHaveBeenCalledTimes(1));
    return utils;
  };

  const fillBusinessInfo = () => {
    fireEvent.change(screen.getByLabelText("Business Name"), {
      target: { value: "Test Clinic" },
    });
    fireEvent.change(
      screen.getByLabelText("Business Registration Number/PIMS ID"),
      { target: { value: "REG123" } }
    );
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByLabelText("Select Country"), {
      target: { value: "US" },
    });
  };

  const fillAddressInfo = () => {
    fireEvent.change(screen.getByLabelText("Address Line 1"), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByLabelText("Postal Code"), {
      target: { value: "90210" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Beverly Hills" },
    });
    fireEvent.change(screen.getByLabelText("State"), {
      target: { value: "CA" },
    });
  };

  const fillServiceInfo = async () => {
    fireEvent.click(screen.getByRole("button", { name: /Add Services/i }));
    fireEvent.click(await screen.findByText("Surgery and Operating Rooms"));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: /Add Department/i }));
    fireEvent.click(await screen.findByText("Cardiology"));
  };

  const fillAllForms = async () => {
    fillBusinessInfo();
    fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
    const addressForm = (
      await screen.findByLabelText("Address Line 1")
    ).closest("form");
    fillAddressInfo();
    fireEvent.click(within(addressForm!).getByRole("button", { name: /Next/i }));
    await screen.findByText(/specialized departments/i);
    await fillServiceInfo();
  };

  describe("Rendering and Initial Load", () => {
    test("renders the initial business tab and loads departments", async () => {
      await setup();
      expect(screen.getByLabelText("Business Name")).toBeInTheDocument();
    });

    test("pre-fills form with existing profile data from the store", async () => {
      mockUseOldAuthStore.mockReturnValue({
        userId: "test-user-id",
        profile: {
          businessName: "Existing Clinic",
          registrationNumber: "EXISTING123",
          country: "CA",
          phone: "9876543210",
        },
      });
    });
  });

  describe("Form Navigation", () => {
    test("navigates from business -> address -> services and back", async () => {
      await setup();
      fillBusinessInfo();
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      const addressForm = (
        await screen.findByLabelText("Address Line 1")
      ).closest("form");
      expect(screen.getByRole("heading", { name: "Address" })).toBeVisible();
      fireEvent.click(within(addressForm!).getByRole("button", { name: /Back/i }));
      expect(await screen.findByLabelText("Business Name")).toHaveValue(
        "Test Clinic"
      );
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      const addressFormAgain = (
        await screen.findByLabelText("Address Line 1")
      ).closest("form");
      fillAddressInfo();
      fireEvent.click(
        within(addressFormAgain!).getByRole("button", { name: /Next/i })
      );
      const serviceForm = (
        await screen.findByText(/specialized departments/i)
      ).closest("form");
      expect(serviceForm).toBeInTheDocument();
      fireEvent.click(within(serviceForm!).getByRole("button", { name: /Back/i }));
      expect(await screen.findByLabelText("Address Line 1")).toHaveValue(
        "123 Main St"
      );
    });
  });

  describe("User Flow and Submission", () => {
    test("completes the full user flow and submits successfully", async () => {
      await setup();
      await fillAllForms();
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
      await waitFor(() => {
        expect(mockToFHIRBusinessProfile).toHaveBeenCalledTimes(1);
        expect(mockPostData).toHaveBeenCalledTimes(1);
        expect(mockRouterPush).toHaveBeenCalledWith("/empty-dashboard");
      });
    });

    test("submits successfully when 'No' is selected for departments", async () => {
      await setup();
      fillBusinessInfo();
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      const addressForm = (
        await screen.findByLabelText("Address Line 1")
      ).closest("form");
      fillAddressInfo();
      fireEvent.click(within(addressForm!).getByRole("button", { name: /Next/i }));
      await screen.findByText(/specialized departments/i);
      fireEvent.click(screen.getByRole("button", { name: /Add Services/i }));
      fireEvent.click(await screen.findByText("Dental Clinic"));
      fireEvent.click(screen.getByRole("button", { name: "No" }));
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
    });
  });

  describe("Validation and Error Handling", () => {
    test("shows validation errors on each step correctly", async () => {
      await setup();
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      expect(
        await screen.findByText("Business Name is required")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Registration Number is required")
      ).toBeInTheDocument();
      fillBusinessInfo();
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
      const addressForm = (
        await screen.findByLabelText("Address Line 1")
      ).closest("form");
      fireEvent.click(within(addressForm!).getByRole("button", { name: /Next/i }));
      expect(
        await screen.findByText("Address Line 1 is required")
      ).toBeInTheDocument();
      expect(screen.getByText("Postal Code is required")).toBeInTheDocument();
      fillAddressInfo();
      fireEvent.click(within(addressForm!).getByRole("button", { name: /Next/i }));
      await screen.findByText(/specialized departments/i);
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
      expect(
        await screen.findByText("At least one service must be selected")
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
      expect(
        await screen.findByText("At least one department must be selected")
      ).toBeInTheDocument();
    });

    test("handles API failure when fetching departments", async () => {
      mockGetData.mockRejectedValue(new Error("API Error"));
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(<CompleteProfile />);
      fireEvent.click(
        await screen.findByRole("tab", { name: /Service and Department/i })
      );
      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
      fireEvent.click(screen.getByRole("button", { name: /Add Department/i }));
      expect(screen.queryByText("Cardiology")).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    test("handles submission failure from the API", async () => {
      mockPostData.mockRejectedValue(new Error("Network Error"));
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await setup();
      await fillAllForms();
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
      expect(mockRouterPush).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("handles error during FHIR conversion before submission", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await setup();
      await fillAllForms();
      fireEvent.click(screen.getByRole("button", { name: /Submit/i }));
      consoleSpy.mockRestore();
    });
  });

  describe("Component Interactions", () => {
    test("handles profile image upload, preview, and removal", async () => {
      const { container } = await setup();
      const file = new File(["dummy"], "example.png", { type: "image/png" });
      const input = container.querySelector("#logo-upload") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      const previewImage = await screen.findByAltText("Preview");
      expect(previewImage).toHaveAttribute("src", "mock-preview-url");
    });

    test("updates address from Google Maps Autocomplete", async () => {
      await setup();
      fillBusinessInfo();
      fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));

      const addressInput = await screen.findByTestId("autocomplete-input");
      fireEvent.change(addressInput);
    });

    test("allows searching, selecting, and deselecting services/departments", async () => {
      await setup();
      fireEvent.click(
        await screen.findByRole("tab", { name: /Service and Department/i })
      );
      fireEvent.click(screen.getByRole("button", { name: /Add Services/i }));
      const serviceSearch = screen.getByPlaceholderText("Search");
      fireEvent.change(serviceSearch, { target: { value: "dental" } });
      const dentalCheckbox = await screen.findByRole("checkbox", {
        name: /Dental Clinic/i,
      });
      fireEvent.click(dentalCheckbox);
      expect(dentalCheckbox).toBeChecked();
      fireEvent.click(dentalCheckbox);
      expect(dentalCheckbox).not.toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
      fireEvent.click(screen.getByRole("button", { name: /Add Department/i }));
      const departmentSearch = screen.getAllByPlaceholderText("Search")[1];
      fireEvent.change(departmentSearch, { target: { value: "cardio" } });
      const cardioCheckbox = await screen.findByRole("checkbox", {
        name: /Cardiology/i,
      });
      fireEvent.click(cardioCheckbox);
      expect(cardioCheckbox).toBeChecked();
    });

    test("clicking progress bar triggers submission and validation", async () => {
      await setup();
      fireEvent.click(screen.getByTestId("profile-progressbar"));
      expect(
        await screen.findByText("Business Name is required")
      ).toBeInTheDocument();
    });

    test("hides department selection when user clicks 'No'", async () => {
      await setup();
      fireEvent.click(
        await screen.findByRole("tab", { name: /Service and Department/i })
      );

      fireEvent.click(screen.getByRole("button", { name: /Add Services/i }));
      fireEvent.click(await screen.findByText("Dental Clinic"));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
      expect(
        await screen.findByRole("button", { name: /Add Department/i })
      ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "No" }));
    });
  });
});

describe("HeadText", () => {
  test("renders with span second by default", () => {
    render(<HeadText blktext="Hello" Spntext="World" />);
    expect(screen.getByRole("heading")).toHaveTextContent("Hello World");
  });

  test("renders with span first when spanFirst is true", () => {
    render(<HeadText blktext="World" Spntext="Hello" spanFirst />);
    expect(screen.getByRole("heading")).toHaveTextContent("Hello World");
  });
});