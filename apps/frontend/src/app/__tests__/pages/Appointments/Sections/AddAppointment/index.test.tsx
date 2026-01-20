import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddAppointment from "@/app/pages/Appointments/Sections/AddAppointment";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
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

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: () => <div>form-desc</div>,
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel }: any) => <div>{inlabel}</div>,
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: () => <div>multi-select</div>,
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: () => <div>search-dropdown</div>,
}));

jest.mock("@/app/components/Inputs/Slotpicker", () => ({
  __esModule: true,
  default: () => <div>slotpicker</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: () => <div>label-dropdown</div>,
}));

jest.mock("@/app/components/Availability/utils", () => ({
  formatUtcTimeToLocalLabel: () => "09:00",
}));

jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: () => "Jan 1, 2024",
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsParentsForPrimaryOrg: () => [],
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [],
}));

jest.mock("@/app/stores/serviceStore", () => ({
  useServiceStore: {
    getState: () => ({ getServicesBySpecialityId: () => [] }),
  },
}));

jest.mock("@/app/services/appointmentService", () => ({
  createAppointment: jest.fn(),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/utils/date", () => ({
  buildUtcDateFromDateAndTime: () => new Date(),
  getDurationMinutes: () => 30,
}));

describe("AddAppointment modal", () => {
  it("renders modal and closes", () => {
    const setShowModal = jest.fn();
    render(<AddAppointment showModal setShowModal={setShowModal} />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    const closeButtons = screen.getAllByText("close");
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
