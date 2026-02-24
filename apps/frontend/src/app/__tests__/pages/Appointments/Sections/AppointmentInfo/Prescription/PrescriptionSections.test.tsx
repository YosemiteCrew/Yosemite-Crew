import React from "react";
import { render } from "@testing-library/react";
import Assessment from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Assessment";
import Objective from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective";
import Subjective from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Subjective";
import Discharge from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Discharge";
import Plan from "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan";

const sectionSpy = jest.fn();

jest.mock(
  "@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection",
  () => ({
    __esModule: true,
    default: (props: any) => {
      sectionSpy(props);
      return <div data-testid="prescription-form-section" />;
    },
  }),
);

const activeAppointment: any = { id: "appt-1", companion: { id: "c1", parent: { id: "p1" } } };

const baseProps = {
  activeAppointment,
  formData: { assessment: [], objective: [], subjective: [], discharge: [], plan: [] } as any,
  setFormData: jest.fn(),
  canEdit: true,
};

const cases = [
  {
    name: "Assessment",
    Component: Assessment,
    expected: {
      title: "Assessment (diagnosis)",
      submissionsTitle: "Previous assessment submissions",
      searchPlaceholder: "Search",
      category: "Prescription",
      formDataKey: "assessment",
    },
  },
  {
    name: "Objective",
    Component: Objective,
    expected: {
      title: "Objective (clinical examination)",
      submissionsTitle: "Previous objective submissions",
      searchPlaceholder: "Search",
      category: "Prescription",
      formDataKey: "objective",
    },
  },
  {
    name: "Subjective",
    Component: Subjective,
    expected: {
      title: "Subjective (history)",
      submissionsTitle: "Previous subjective submissions",
      searchPlaceholder: "Search",
      category: "Prescription",
      formDataKey: "subjective",
    },
  },
  {
    name: "Discharge",
    Component: Discharge,
    expected: {
      title: "Discharge summary",
      submissionsTitle: "Previous discharge submissions",
      searchPlaceholder: "Search",
      category: "Prescription",
      formDataKey: "discharge",
    },
  },
  {
    name: "Plan",
    Component: Plan,
    expected: {
      title: "Treatment/Plan",
      submissionsTitle: "Previous plan submissions",
      searchPlaceholder: "Search plan",
      category: "Prescription",
      formDataKey: "plan",
    },
  },
] as const;

describe.each(cases)("%s section", ({ Component, expected }) => {
  beforeEach(() => {
    sectionSpy.mockClear();
  });

  it("passes expected props to PrescriptionFormSection", () => {
    render(<Component {...baseProps} />);

    expect(sectionSpy).toHaveBeenCalledTimes(1);
    const calledProps = sectionSpy.mock.calls[0][0];
    expect(calledProps).toMatchObject(expected);
  });
});
