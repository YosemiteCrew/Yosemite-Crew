import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddAppointment from "@/app/pages/Appointments/Sections/AddAppointment";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, error }: any) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect(options[0]?.value)}
      >
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, error }: any) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect(options[0])}
      >
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, error }: any) => (
    <label>
      {inlabel}
      <input value={value} readOnly />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Slotpicker", () => ({
  __esModule: true,
  default: ({ setSelectedSlot, timeSlots }: any) => (
    <button
      type="button"
      onClick={() => setSelectedSlot(timeSlots[0])}
    >
      Pick Slot
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: () => <div>Support</div>,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: () => [
    {
      companion: { id: "comp-1", name: "Buddy", type: "dog", breed: "Husky" },
      parent: { id: "parent-1", firstName: "Jamie" },
    },
  ],
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [
    { _id: "team-1", name: "Dr. Who" },
  ],
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [
    { _id: "spec-1", name: "Surgery" },
  ],
}));

jest.mock("@/app/stores/serviceStore", () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: () => [
        { id: "serv-1", name: "Checkup", description: "", cost: 10, maxDiscount: 5, durationMinutes: 30 },
      ],
    }),
  },
}));

jest.mock("@/app/services/appointmentService", () => ({
  createAppointment: jest.fn(),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: () => "2024-01-01",
}));

jest.mock("@/app/components/Availability/utils", () => ({
  formatUtcTimeToLocalLabel: () => "10:00 AM",
}));

jest.mock("@/app/utils/date", () => ({
  buildUtcDateFromDateAndTime: () => new Date("2024-01-01T10:00:00Z"),
  getDurationMinutes: () => 30,
}));

const appointmentService = jest.requireMock("@/app/services/appointmentService");

describe("AddAppointment", () => {
  const showErrorTost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    appointmentService.getSlotsForServiceAndDateForPrimaryOrg.mockResolvedValue([
      { startTime: "10:00", endTime: "10:30", vetIds: ["team-1"] },
    ]);
  });

  it("shows validation errors when required fields are missing", () => {
    render(
      <AddAppointment
        showModal
        setShowModal={jest.fn()}
        showErrorTost={showErrorTost}
      />
    );

    fireEvent.click(screen.getByText("Book appointment"));

    expect(screen.getByText("Please select a companion")).toBeInTheDocument();
    expect(screen.getByText("Please select a speciality")).toBeInTheDocument();
    expect(screen.getByText("Please select a service")).toBeInTheDocument();
    expect(screen.getByText("Please select a lead")).toBeInTheDocument();
    expect(screen.getByText("Please select a slot")).toBeInTheDocument();
  });

  it("creates an appointment with required fields", async () => {
    const setShowModal = jest.fn();
    appointmentService.createAppointment.mockResolvedValue({});

    render(
      <AddAppointment
        showModal
        setShowModal={setShowModal}
        showErrorTost={showErrorTost}
      />
    );

    fireEvent.click(screen.getByText("Search companion"));
    fireEvent.click(screen.getByText("Speciality"));
    fireEvent.click(screen.getByText("Service"));

    await waitFor(() => {
      expect(
        appointmentService.getSlotsForServiceAndDateForPrimaryOrg
      ).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("Pick Slot"));
    fireEvent.click(screen.getByText("Lead"));
    fireEvent.click(screen.getByText("Book appointment"));

    await waitFor(() => {
      expect(appointmentService.createAppointment).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(showErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Appointment created" })
    );
  });
});
