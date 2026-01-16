/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppointmentInfoModal from "@/app/pages/Appointments/Sections/AppointmentInfo";
import { fetchSubmissions } from "@/app/services/soapService";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Labels/Labels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel, setActiveSubLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button
          key={label.key}
          type="button"
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
      <button type="button" onClick={() => setActiveSubLabel("plan")}
      >
        Plan
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo", () => ({
  __esModule: true,
  default: () => <div>appointment-info-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Info/Companion", () => ({
  __esModule: true,
  default: () => <div>companion-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Info/History", () => ({
  __esModule: true,
  default: () => <div>history-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective", () => ({
  __esModule: true,
  default: () => <div>subjective-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective", () => ({
  __esModule: true,
  default: () => <div>objective-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Assessment", () => ({
  __esModule: true,
  default: () => <div>assessment-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan", () => ({
  __esModule: true,
  default: () => <div>plan-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit", () => ({
  __esModule: true,
  default: () => <div>audit-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Discharge", () => ({
  __esModule: true,
  default: () => <div>discharge-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Documents", () => ({
  __esModule: true,
  default: () => <div>documents-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat", () => ({
  __esModule: true,
  default: () => <div>chat-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Tasks/Task", () => ({
  __esModule: true,
  default: () => <div>task-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Summary", () => ({
  __esModule: true,
  default: () => <div>summary-section</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Finance/Details", () => ({
  __esModule: true,
  default: () => <div>details-section</div>,
}));

jest.mock("@/app/services/soapService", () => ({
  fetchSubmissions: jest.fn(),
}));

// eslint-disable-next-line @next/next/no-img-element
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("AppointmentInfo modal", () => {
  beforeAll(() => {
    (console.error as jest.Mock).mockImplementation(() => {});
  });

  const appointment: any = {
    id: "appt-1",
    companion: {
      name: "Buddy",
      breed: "Labrador",
    },
  };

  beforeEach(() => {
    (fetchSubmissions as jest.Mock).mockResolvedValue({
      soapNotes: {
        Subjective: [],
        Objective: [],
        Assessment: [],
        Plan: [],
        Discharge: [],
      },
    });
  });

  it("fetches submissions and renders header", async () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={jest.fn()}
        activeAppointment={appointment}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Labrador")).toBeInTheDocument();
    expect(screen.getByText("appointment-info-section")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSubmissions).toHaveBeenCalledWith("appt-1");
    });
  });

  it("switches to prescription plan section", () => {
    render(
      <AppointmentInfoModal
        showModal
        setShowModal={jest.fn()}
        activeAppointment={appointment}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Prescription" }));
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));

    expect(screen.getByText("plan-section")).toBeInTheDocument();
  });
});
