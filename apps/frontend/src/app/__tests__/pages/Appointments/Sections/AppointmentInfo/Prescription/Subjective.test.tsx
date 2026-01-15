import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Subjective from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

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

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SubjectiveSubmissions", () => ({
  __esModule: true,
  default: () => <div>Submissions</div>,
}));

jest.mock("@/app/hooks/useForms", () => ({
  useFormsForPrimaryOrgByCategory: () => [
    { _id: "form-1", name: "Subjective", schema: [] },
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

describe("Subjective", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders and saves a submission", async () => {
    const setFormData = jest.fn();
    soapService.createSubmission.mockResolvedValue({ _id: "sub-1" });

    render(
      <Subjective
        activeAppointment={{ id: "appt-1", companion: { id: "c1", parent: { id: "p1" } } } as any}
        formData={{ subjective: [] } as any}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Search"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(soapService.createSubmission).toHaveBeenCalled();
    });
    expect(setFormData).toHaveBeenCalled();
  });
});
