import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Reschedule from "@/app/pages/Appointments/Sections/Reschedule";
import { Appointment } from "@yosemite-crew/types";

const getSlotsMock = jest.fn();
const updateAppointmentMock = jest.fn();

jest.mock("@/app/services/appointmentService", () => ({
  getSlotsForServiceAndDateForPrimaryOrg: (...args: any[]) =>
    getSlotsMock(...args),
  updateAppointment: (...args: any[]) => updateAppointmentMock(...args),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [
    { _id: "vet-1", name: "Dr. Lee" },
    { _id: "vet-2", name: "Dr. Ray" },
  ],
}));

jest.mock("@/app/components/Modal/CenterModal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Inputs/Slotpicker", () => ({
  __esModule: true,
  default: () => <div data-testid="slotpicker" />,
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, inlabel }: any) => (
    <div data-testid={`input-${inlabel}`}>{value}</div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => (
    <div data-testid={`dropdown-${placeholder}`} />
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

describe("Reschedule", () => {
  const setShowModal = jest.fn();

  const activeAppointment = {
    id: "appt-1",
    appointmentDate: new Date(2025, 0, 2, 9),
    appointmentType: { id: "service-1" },
    lead: { id: "vet-1", name: "Dr. Lee" },
    durationMinutes: 30,
    startTime: new Date(2025, 0, 2, 9),
    endTime: new Date(2025, 0, 2, 9, 30),
  } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
    (console.warn as jest.Mock).mockRestore?.();
  });

  it("loads slots and sends reschedule request", async () => {
    getSlotsMock.mockResolvedValue([
      { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
    ]);
    updateAppointmentMock.mockResolvedValue(undefined);

    render(
      <Reschedule
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={activeAppointment}
      />
    );

    await waitFor(() => {
      expect(getSlotsMock).toHaveBeenCalledWith(
        "service-1",
        activeAppointment.appointmentDate
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("input-Time").textContent).not.toBe("");
    });

    fireEvent.click(screen.getByText("Send request"));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "REQUESTED" })
      );
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("closes when close button clicked", () => {
    render(
      <Reschedule
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={activeAppointment}
      />
    );

    const closeButtons = screen.getAllByText("Close");
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
