import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import Subjective from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective";
import { createEmptyFormData } from "@/app/pages/Appointments/Sections/AppointmentInfo";

const formsMock = jest.fn();
const createSubmissionMock = jest.fn();

jest.mock("@yosemite-crew/types", () => ({}));

jest.mock("@/app/hooks/useForms", () => ({
  useFormsForPrimaryOrgByCategory: () => formsMock(),
}));

jest.mock("@/app/types/forms", () => ({}));

jest.mock("@/app/pages/Forms/Sections/AddForm/Review", () => ({
  buildInitialValues: jest.fn(() => ({})),
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => () => (
  <div data-testid="form-renderer" />
));

jest.mock("@/app/components/Inputs/SearchDropdown", () => (props: any) => (
  <button type="button" onClick={() => props.onSelect(props.options[0].value)}>
    {props.placeholder}
  </button>
));

jest.mock("@/app/services/soapService", () => ({
  createSubmission: (...args: any[]) => createSubmissionMock(...args),
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

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SubjectiveSubmissions", () => () => (
  <div data-testid="subjective-submissions" />
));

describe("Subjective prescription", () => {
  const activeAppointment: any = {
    id: "appt-1",
    companion: { id: "c1", parent: { id: "p1" } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    formsMock.mockReturnValue([
      { _id: "form-1", name: "Subjective Form", schema: [] },
    ]);
    createSubmissionMock.mockResolvedValue({ _id: "sub-1" });
  });

  it("renders submissions and saves when form is selected", async () => {
    const setFormData = jest.fn();

    render(
      <Subjective
        activeAppointment={activeAppointment}
        formData={createEmptyFormData()}
        setFormData={setFormData}
        canEdit
      />
    );

    fireEvent.click(screen.getByText("Search"));
    expect(screen.getByTestId("form-renderer")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(createSubmissionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: "form-1",
          appointmentId: "appt-1",
          submittedBy: "user-1",
        })
      );
    });
    expect(setFormData).toHaveBeenCalled();
  });
});
