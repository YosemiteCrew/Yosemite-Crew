import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Plan from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan";

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ options, onSelect, placeholder }: any) => (
    <button type="button" onClick={() => onSelect(options[0]?.value)}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => ({
  __esModule: true,
  default: () => <div>Form Renderer</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/PlanSubmissions", () => ({
  __esModule: true,
  default: () => <div>Submissions</div>,
}));

jest.mock("@/app/hooks/useForms", () => ({
  useFormsForPrimaryOrgByCategory: () => [
    { _id: "form-1", name: "Plan", schema: [] },
  ],
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/Review", () => ({
  buildInitialValues: () => ({})
}));

jest.mock("@/app/services/soapService", () => ({
  createSubmission: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({ attributes: { sub: "user-1" } }),
  },
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const soapService = jest.requireMock("@/app/services/soapService");

describe("Plan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders and saves a submission", async () => {
    const setFormData = jest.fn();
    soapService.createSubmission.mockResolvedValue({ _id: "sub-1" });

    render(
      <Plan
        activeAppointment={{ id: "appt-1", companion: { id: "c1", parent: { id: "p1" } } } as any}
        formData={{ plan: [] } as any}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Search plan"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(soapService.createSubmission).toHaveBeenCalled();
    });
    expect(setFormData).toHaveBeenCalled();
  });
});
