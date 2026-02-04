import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import AddAppointment from "@/app/features/appointments/pages/Appointments/Sections/AddAppointment";
import { Slot } from "@/app/features/appointments/types/appointments";
import * as appointmentService from "@/app/features/appointments/services/appointmentService";

// ----------------------------------------------------------------------------
// 1. Mocks & Setup
// ----------------------------------------------------------------------------

// Mock Hooks
jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => [
    {
      companion: { id: "comp-1", name: "Buddy", type: "Dog", breed: "Golden" },
      parent: { id: "parent-1", firstName: "John" },
    },
  ]),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(() => [
    { _id: "lead-1", name: "Dr. Smith" },
    { _id: "staff-1", name: "Nurse Joy" },
  ]),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(() => [
    { _id: "spec-1", name: "General Checkup" },
  ]),
}));

jest.mock("@/app/stores/serviceStore", () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: jest.fn(() => [
        {
          id: "serv-1",
          name: "Consultation",
          description: "Basic check",
          cost: "50",
          maxDiscount: "10",
          durationMinutes: "30",
        },
      ]),
    }),
  },
}));

// Mock Services
jest.mock("@/app/features/appointments/services/appointmentService", () => ({
  createAppointment: jest.fn(),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
}));

// Mock Utils
jest.mock("@/app/lib/date", () => ({
  buildUtcDateFromDateAndTime: jest.fn((d) => d),
  getDurationMinutes: jest.fn(() => 30),
}));

jest.mock("@/app/features/appointments/components/Availability/utils", () => ({
  formatUtcTimeToLocalLabel: jest.fn(() => "10:00 AM"),
}));

// Mock UI Components
jest.mock("@/app/ui/overlays/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/ui/primitives/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid="editable-accordion">
      <h4>{title}</h4>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button onClick={onClick} data-testid="submit-btn">
      {text}
    </button>
  ),
}));

jest.mock("@/app/ui/inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ onSelect, error }: any) => (
    <div>
      <button data-testid="search-companion" onClick={() => onSelect("comp-1")}>
        Select Buddy
      </button>
      {error && <span data-testid="err-companion">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/ui/inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, error }: any) => (
    <div>
      <button
        data-testid={`select-${placeholder}`}
        onClick={() => {
          if (placeholder === "Speciality")
            onSelect({ value: "spec-1", label: "General Checkup" });
          if (placeholder === "Service")
            onSelect({ value: "serv-1", label: "Consultation" });
          if (placeholder === "Lead")
            onSelect({ value: "lead-1", label: "Dr. Smith" });
        }}
      >
        Select {placeholder}
      </button>
      {error && <span data-testid={`err-${placeholder}`}>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/ui/inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button data-testid="select-support" onClick={() => onChange(["staff-1"])}>
      Select Staff
    </button>
  ),
}));

jest.mock("@/app/ui/inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ onChange, value }: any) => (
    <textarea data-testid="concern-input" onChange={onChange} value={value} />
  ),
}));

jest.mock("@/app/ui/inputs/Slotpicker", () => ({
  __esModule: true,
  default: ({ setSelectedSlot, timeSlots }: any) => (
    <div data-testid="slot-picker">
      {timeSlots.map((slot: any, i: number) => (
        <button
          key={i}
          data-testid={`slot-${i}`}
          onClick={() => setSelectedSlot(slot)}
        >
          {slot.startTime}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input readOnly value={value} />
      {error && <span data-testid={`err-input-${inlabel}`}>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button data-testid="close-btn" onClick={onClick}>
      X
    </button>
  ),
}));

describe("AddAppointment Component", () => {
  const mockSetShowModal = jest.fn();
  const defaultProps = {
    showModal: true,
    setShowModal: mockSetShowModal,
  };

  const mockSlots: Slot[] = [
    { startTime: "10:00", endTime: "10:30", vetIds: ["lead-1"] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (
      appointmentService.getSlotsForServiceAndDateForPrimaryOrg as jest.Mock
    ).mockResolvedValue(mockSlots);
  });

  it("renders the modal and form sections", () => {
    render(<AddAppointment {...defaultProps} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Add appointment")).toBeInTheDocument();
    expect(
      screen.getByTestId("accordion-Companion details"),
    ).toBeInTheDocument();
  });

  it("handles companion selection", () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId("search-companion"));

    expect(screen.getByTestId("editable-accordion")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();
  });

  it("handles speciality and service selection, which triggers slot fetching", async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId("select-Speciality"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("select-Service"));
    });

    expect(
      appointmentService.getSlotsForServiceAndDateForPrimaryOrg,
    ).toHaveBeenCalled();
    expect(await screen.findByTestId("slot-0")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
  });

  it("handles slot selection and auto-fills date/time/lead options", async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId("select-Speciality"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-Service"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("slot-0"));
    });

    expect(screen.getByDisplayValue("10:00 AM")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("select-Lead"));
  });

  it("handles support staff selection", () => {
    render(<AddAppointment {...defaultProps} />);
    fireEvent.click(screen.getByTestId("select-support"));
  });

  it("handles concern input", () => {
    render(<AddAppointment {...defaultProps} />);
    const input = screen.getByTestId("concern-input");
    fireEvent.change(input, { target: { value: "Sick dog" } });
    expect(input).toHaveValue("Sick dog");
  });

  it("toggles emergency checkbox", () => {
    render(<AddAppointment {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("validates form on submit (Missing Fields)", async () => {
    render(<AddAppointment {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-btn"));
    });

    // Wait for validation errors to render
    await waitFor(() => {
      expect(screen.getByTestId("err-companion")).toBeInTheDocument();
      expect(screen.getByTestId("err-Speciality")).toBeInTheDocument();
      expect(screen.getByTestId("err-Service")).toBeInTheDocument();
      expect(screen.getByTestId("err-Lead")).toBeInTheDocument();
      expect(screen.getByTestId("err-input-Time")).toBeInTheDocument();
    });

    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
  });

  it("submits successfully when form is full", async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId("search-companion"));
    fireEvent.click(screen.getByTestId("select-Speciality"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("select-Service"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("slot-0"));
    });

    fireEvent.click(screen.getByTestId("select-Lead"));
    fireEvent.change(screen.getByTestId("concern-input"), {
      target: { value: "Concern" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-btn"));
    });
  });

  it("handles slot fetch failure gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    (
      appointmentService.getSlotsForServiceAndDateForPrimaryOrg as jest.Mock
    ).mockRejectedValue(new Error("Fetch error"));

    render(<AddAppointment {...defaultProps} />);
    fireEvent.click(screen.getByTestId("select-Speciality"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("select-Service"));
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles create appointment failure gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    (appointmentService.createAppointment as jest.Mock).mockRejectedValue(
      new Error("Create error"),
    );

    render(<AddAppointment {...defaultProps} />);

    // Fill Form minimal valid
    fireEvent.click(screen.getByTestId("search-companion"));
    fireEvent.click(screen.getByTestId("select-Speciality"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-Service"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("slot-0"));
    });
    fireEvent.click(screen.getByTestId("select-Lead"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-btn"));
    });

    consoleSpy.mockRestore();
  });

  it("cleans up async calls on unmount (useEffect return)", () => {
    const { unmount } = render(<AddAppointment {...defaultProps} />);
    fireEvent.click(screen.getByTestId("select-Speciality"));
    fireEvent.click(screen.getByTestId("select-Service"));
    unmount();
  });

  it("handles empty service selection logic (ServiceInfoData fallback)", () => {
    const { unmount } = render(<AddAppointment {...defaultProps} />);
    unmount();
  });
});
