import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import BookAppointment from "@/app/pages/Companions/BookAppointment";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect, error }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={`${placeholder}-${option.key}`}
          type="button"
          onClick={() => onSelect(option)}
        >
          {placeholder}: {option.label}
        </button>
      ))}
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange, options = [] }: any) => (
    <button type="button" onClick={() => onChange([options[0]?.value])}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} readOnly />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea aria-label={inlabel} value={value ?? ""} onChange={onChange} />
    </label>
  ),
}));

const slotpickerSpy = jest.fn();
jest.mock("@/app/components/Inputs/Slotpicker", () => ({
  __esModule: true,
  default: (props: any) => {
    slotpickerSpy(props);
    return (
      <button
        type="button"
        onClick={() => props.timeSlots?.[0] && props.setSelectedSlot(props.timeSlots[0])}
      >
        Pick slot
      </button>
    );
  },
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: jest.fn(() => "Jan 1, 2025"),
}));

jest.mock("@/app/components/Availability/utils", () => ({
  formatUtcTimeToLocalLabel: jest.fn(() => "09:00 AM"),
}));

jest.mock("@/app/utils/date", () => ({
  buildUtcDateFromDateAndTime: jest.fn(() => new Date("2025-01-01T09:00:00Z")),
  getDurationMinutes: jest.fn(() => 30),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

const mockGetServicesBySpecialityId = jest.fn();
jest.mock("@/app/stores/serviceStore", () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: mockGetServicesBySpecialityId,
    }),
  },
}));

jest.mock("@/app/services/appointmentService", () => ({
  createAppointment: jest.fn(),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from "@/app/services/appointmentService";

describe("BookAppointment", () => {
  const setShowModal = jest.fn();
  const activeCompanion = {
    companion: {
      id: "comp-1",
      name: "Buddy",
      type: "dog",
      breed: "Husky",
    },
    parent: {
      id: "parent-1",
      firstName: "Sam",
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "vet-1", name: "Dr. Avery" },
    ]);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "spec-1", name: "Surgery" },
    ]);
    mockGetServicesBySpecialityId.mockReturnValue([
      { id: "service-1", name: "Checkup", durationMinutes: 30 },
    ]);
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
    ]);
  });

  it("renders modal and companion info", () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={setShowModal}
        activeCompanion={activeCompanion}
      />
    );

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByText("Add appointment")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();
  });

  it("validates required fields", () => {
    render(
      <BookAppointment
        showModal={true}
        setShowModal={setShowModal}
        activeCompanion={activeCompanion}
      />
    );

    fireEvent.click(screen.getByText("Book appointment"));

    expect(screen.getByText("Please select a speciality")).toBeInTheDocument();
    expect(screen.getByText("Please select a service")).toBeInTheDocument();
    expect(screen.getByText("Please select a lead")).toBeInTheDocument();
    expect(screen.getByText("Please select a slot")).toBeInTheDocument();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("creates appointment when form is valid", async () => {
    (createAppointment as jest.Mock).mockResolvedValue({});

    render(
      <BookAppointment
        showModal={true}
        setShowModal={setShowModal}
        activeCompanion={activeCompanion}
      />
    );

    fireEvent.click(screen.getByText("Speciality: Surgery"));
    fireEvent.click(screen.getByText("Service: Checkup"));

    await waitFor(() => {
      expect(getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalled();
      expect(slotpickerSpy).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("Lead: Dr. Avery"));
    fireEvent.click(screen.getByText("Pick slot"));

    fireEvent.click(screen.getByText("Book appointment"));

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
