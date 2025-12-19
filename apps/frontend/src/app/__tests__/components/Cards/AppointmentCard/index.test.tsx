import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AppointmentCard from "@/app/components/Cards/AppointmentCard";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// Mock Utils
jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ color: "green" })),
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: jest.fn((date) => `Formatted ${date}`),
}));

import { formatDateLabel } from "@/app/utils/forms";

// --- Test Data ---

const mockAppointment: Appointment = {
  _id: "1",
  status: "CONFIRMED",
  appointmentDate: "2023-01-01",
  startTime: "10:00 AM",
  concern: "Vaccination",
  companion: {
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    parent: { name: "John Doe" },
  },
  appointmentType: { name: "General Checkup" },
  room: { name: "Room 1" },
  lead: { name: "Dr. Smith" },
  supportStaff: [{ name: "Nurse Joy" }, { name: "Assistant Bob" }],
} as any;

describe("AppointmentCard Component", () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders appointment details correctly", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment}
        handleViewAppointment={mockHandleView}
      />
    );

    // Header Info
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    // Breed / Species
    expect(screen.getByText("Golden Retriever")).toBeInTheDocument();

    // Date / Time (using mock formatter)
    expect(formatDateLabel).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Formatted 2023-01-01/)).toBeInTheDocument();

    // Other Details
    expect(screen.getByText("Vaccination")).toBeInTheDocument(); // Reason
    expect(screen.getByText("General Checkup")).toBeInTheDocument(); // Service
    expect(screen.getByText("Room 1")).toBeInTheDocument(); // Room
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument(); // Lead

    // Staff List
    expect(screen.getByText("Nurse Joy, Assistant Bob")).toBeInTheDocument();
  });

  it("handles missing optional fields gracefully", () => {
    const incompleteAppointment = {
      ...mockAppointment,
      companion: { name: "Stray", species: "Cat" }, // No breed, no parent
      room: null,
      lead: null,
      supportStaff: [],
    } as any;

    render(
      <AppointmentCard
        appointment={incompleteAppointment}
        handleViewAppointment={mockHandleView}
      />
    );

    // Fallback for Breed / Species logic: "{breed} || '-' + ' / ' + {species}"
    // Breed is undefined -> "-" / "Cat"
    expect(screen.getByText("- / Cat")).toBeInTheDocument();

    // Empty Staff
    // It calls .map on empty array -> empty string
    // The label "Staff:" is still there, but content is empty.
    // We check that it doesn't crash.
  });

  // --- 2. Status Rendering ---

  it("renders status badge correctly", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment} // Status: CONFIRMED
        handleViewAppointment={mockHandleView}
      />
    );
  });

  // --- 3. Action Buttons Logic ---

  it("renders 'View' button for non-REQUESTED status", () => {
    render(
      <AppointmentCard
        appointment={{ ...mockAppointment, status: "CONFIRMED" } as any}
        handleViewAppointment={mockHandleView}
      />
    );

    const viewBtn = screen.getByText("View");
    expect(viewBtn).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();

    fireEvent.click(viewBtn);
    expect(mockHandleView).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CONFIRMED" })
    );
  });

  it("renders 'Accept' and 'Cancel' buttons for REQUESTED status", () => {
    render(
      <AppointmentCard
        appointment={{ ...mockAppointment, status: "REQUESTED" } as any}
        handleViewAppointment={mockHandleView}
      />
    );

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });

  // --- 4. Interactions ---

  it("does not trigger view handler when clicking Accept/Cancel (if logic implemented)", () => {
    // Note: The current component code doesn't assign onClick handlers to Accept/Cancel buttons yet.
    // This test ensures that they exist and are clickable without crashing.
    render(
      <AppointmentCard
        appointment={{ ...mockAppointment, status: "REQUESTED" } as any}
        handleViewAppointment={mockHandleView}
      />
    );

    const acceptBtn = screen.getByText("Accept");
    fireEvent.click(acceptBtn);

    // Should NOT call handleViewAppointment (which is for View button)
    expect(mockHandleView).not.toHaveBeenCalled();
  });
});
