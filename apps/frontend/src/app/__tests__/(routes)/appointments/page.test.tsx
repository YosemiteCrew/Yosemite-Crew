import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/(routes)/(app)/appointments/page";

jest.mock("@/app/pages/Appointments", () => {
  return function MockProtectedAppointments() {
    return (
      <div data-testid="protected-appointments-mock">Protected Component</div>
    );
  };
});

describe("Appointments Page", () => {
  it("renders the ProtectedAppointments component correctly", () => {
    render(<Page />);

    const childComponent = screen.getByTestId("protected-appointments-mock");
    expect(childComponent).toBeInTheDocument();
  });
});
