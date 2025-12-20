import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import BookAppointment from "../../../pages/Companions/BookAppointment";
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from "@/app/services/appointmentService";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { useServiceStore } from "@/app/stores/serviceStore";
import { CompanionParent } from "../../../pages/Companions/types";

// --- Mocks ---

// 1. Mock Services and Hooks
jest.mock("@/app/services/appointmentService");
jest.mock("@/app/hooks/useTeam");
jest.mock("@/app/hooks/useSpecialities");
jest.mock("@/app/stores/serviceStore");

// 2. Mock UI Components
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      {title}
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="editable-accordion">
      {title}
      {children}
    </div>
  ),
}));

// Mock Inputs
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange, value, options }: any) => (
    <select
      data-testid={`dropdown-${placeholder}`}
      value={value}
      onChange={(e) => {
        const selected = options.find((o: any) => o.value === e.target.value);
        onChange(selected || { value: e.target.value, label: e.target.value });
      }}
    >
      <option value="">Select</option>
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange, value, options }: any) => (
    <select
      multiple
      data-testid={`multi-${placeholder}`}
      value={value}
      onChange={(e: any) => {
        if (
          e.target.value &&
          (!e.target.selectedOptions || e.target.selectedOptions.length === 0)
        ) {
          onChange([e.target.value]);
          return;
        }
        const values = Array.from(
          e.target.selectedOptions,
          (option: any) => option.value
        );
        onChange(values);
      }}
    >
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <input data-testid={`input-${inlabel}`} value={value} onChange={onChange} />
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <textarea
      data-testid={`desc-${inlabel}`}
      value={value}
      onChange={onChange}
    />
  ),
}));

jest.mock("@/app/components/Inputs/Slotpicker", () => ({
  __esModule: true,
  default: ({ selectedSlot, setSelectedSlot, timeSlots }: any) => (
    <div data-testid="slot-picker">
      {timeSlots.map((slot: any) => (
        <button
          key={slot.startTime}
          data-testid={`slot-${slot.startTime}`}
          onClick={() => setSelectedSlot(slot)}
        >
          {slot.startTime}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="submit-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// --- Test Data ---

const mockActiveCompanion: CompanionParent = {
  companion: {
    id: "comp-1",
    name: "Buddy",
    type: "dog", // FIXED: Changed "Dog" to "dog" to match CompanionType
    breed: "Golden",
    weight: 20,
    sex: "Male",
    active: true,
    neutered: true,
  } as any,
  parent: {
    id: "parent-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    address: {},
    createdFrom: "manual",
    // FIXED: Removed 'mobile' property which does not exist in StoredParent
  } as any,
};

const mockTeams = [
  { _id: "vet-1", name: "Dr. Smith" },
  { _id: "vet-2", name: "Dr. Jones" },
];

const mockSpecialities = [
  { _id: "spec-1", name: "General Checkup" },
  { _id: "spec-2", name: "Surgery" },
];

const mockServices = [
  {
    id: "srv-1",
    name: "Basic Exam",
    description: "Standard checkup",
    cost: "50",
    maxDiscount: "10",
    durationMinutes: "30",
  },
];

const mockSlots = [
  {
    startTime: "10:00",
    endTime: "10:30",
    vetIds: ["vet-1"],
  },
];

describe("BookAppointment", () => {
  const mockSetShowModal = jest.fn();
  const mockGetServices = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    (useServiceStore.getState as jest.Mock).mockReturnValue({
      getServicesBySpecialityId: mockGetServices,
    });
    mockGetServices.mockReturnValue(mockServices);
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue(
      mockSlots
    );
  });

  // --- Section 1: Rendering & Initialization ---

  it("does not render if showModal is false", () => {
    render(
      <BookAppointment
        showModal={false}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders correctly with default data when opened", () => {
    // FIXED: Removed async/act wrapper to reduce nesting depth
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Add appointment")).toBeInTheDocument();

    const companionSection = screen.getByTestId("editable-accordion");
    expect(companionSection).toHaveTextContent("Buddy");
  });

  it("handles modal close", () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    const closeIcon = document.querySelectorAll("svg")[1];
    fireEvent.click(closeIcon);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- Section 2: Form Interaction & Logic ---

  it("populates dropdowns and updates state on selection", async () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    const specDropdown = screen.getByTestId("dropdown-Speciality");
    fireEvent.change(specDropdown, { target: { value: "spec-1" } });

    expect(mockGetServices).toHaveBeenCalledWith("spec-1");

    const serviceDropdown = screen.getByTestId("dropdown-Service");
    fireEvent.change(serviceDropdown, { target: { value: "srv-1" } });

    const billableContainer = screen.getByTestId("accordion-Billable services");
    expect(
      within(billableContainer).getByTestId("editable-accordion")
    ).toHaveTextContent("Basic Exam");

    await waitFor(() => {
      expect(screen.getByTestId("slot-10:00")).toBeInTheDocument();
    });
  });

  it("fetches slots when service and date are valid", async () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("slot-10:00")).toBeInTheDocument();
    });
  });

  it("filters leads based on available slots", async () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("slot-10:00")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("slot-10:00"));

    const leadDropdown = screen.getByTestId("dropdown-Lead");
    expect(leadDropdown).toHaveTextContent("Dr. Smith");
    expect(leadDropdown).not.toHaveTextContent("Dr. Jones");
  });

  it("updates form inputs: concern, support staff, emergency", () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    const concernInput = screen.getByTestId("desc-Describe concern");
    fireEvent.change(concernInput, { target: { value: "My dog is sick" } });
    expect(concernInput).toHaveValue("My dog is sick");

    const supportDropdown = screen.getByTestId("multi-Support");
    fireEvent.change(supportDropdown, {
      target: { value: "vet-2" },
    });

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  // --- Section 3: Validation & Submission ---

  it("shows validation errors on empty submit", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    // FIXED: Removed act wrapper to reduce nesting depth
    fireEvent.click(screen.getByTestId("submit-btn"));

    expect(createAppointment).not.toHaveBeenCalled();
    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });

  it("successfully creates an appointment", async () => {
    (createAppointment as jest.Mock).mockResolvedValue({});

    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });

    await waitFor(() => screen.getByTestId("slot-10:00"));
    fireEvent.click(screen.getByTestId("slot-10:00"));

    fireEvent.change(screen.getByTestId("dropdown-Lead"), {
      target: { value: "vet-1" },
    });

    fireEvent.change(screen.getByTestId("desc-Describe concern"), {
      target: { value: "Test" },
    });

    // FIXED: Removed act wrapper
    fireEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalled();
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("handles create appointment error", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (createAppointment as jest.Mock).mockRejectedValue(new Error("API Fail"));

    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });
    await waitFor(() => screen.getByTestId("slot-10:00"));
    fireEvent.click(screen.getByTestId("slot-10:00"));
    fireEvent.change(screen.getByTestId("dropdown-Lead"), {
      target: { value: "vet-1" },
    });

    // FIXED: Removed act wrapper
    fireEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });

  // --- Section 4: Edge Cases & Branches ---

  it("handles slot fetch errors gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockRejectedValue(
      new Error("Slot Error")
    );

    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    expect(screen.queryByTestId("slot-10:00")).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("handles empty service/team/speciality data gracefully", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    mockGetServices.mockReturnValue([]);

    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    const specDropdown = screen.getByTestId("dropdown-Speciality");
    expect(specDropdown.children.length).toBe(1);
  });

  it("handles missing service details in useMemo", () => {
    mockGetServices.mockReturnValue([]);

    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "unknown-id" },
    });

    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("covers manual date/time input changes (no-ops)", () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    const dateInput = screen.getByTestId("input-Date");
    fireEvent.change(dateInput, { target: { value: "New Date" } });

    const timeInput = screen.getByTestId("input-Time");
    fireEvent.change(timeInput, { target: { value: "New Time" } });
  });

  it("handles unmount during slot fetch", async () => {
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSlots), 100))
    );

    const { unmount } = render(
      <BookAppointment
        showModal={true}
        setShowModal={mockSetShowModal}
        activeCompanion={mockActiveCompanion}
      />
    );

    fireEvent.change(screen.getByTestId("dropdown-Speciality"), {
      target: { value: "spec-1" },
    });
    fireEvent.change(screen.getByTestId("dropdown-Service"), {
      target: { value: "srv-1" },
    });

    unmount();
  });
});
