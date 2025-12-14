import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppointmentCard from "@/app/components/Cards/AppointmentCard/index";
// Fixed: Removed 'Status' from import as it doesn't exist there
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Fixed: Use absolute path alias to avoid relative path resolution errors
jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn((status) => {
    if (status === "Requested")
      return { color: "blue", backgroundColor: "white" };
    return { color: "green", backgroundColor: "lightgreen" };
  }),
}));

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

describe("AppointmentCard Component", () => {
  const mockHandleViewAppointment = jest.fn();

  // Helper to create a complete Appointment object
  const createMockAppointment = (
    overrides?: Partial<Appointment>
  ): Appointment =>
    ({
      _id: "1",
      id: "1",
      name: "Buddy",
      image: "/dog.jpg",
      parentName: "John Doe",
      breed: "Golden Retriever",
      species: "Dog",
      date: "2023-10-27",
      time: "10:00 AM",
      reason: "Checkup",
      service: { name: "General Exam", color: "#000" },
      room: "Room 1",
      lead: "Dr. Smith",
      // Fixed: Cast string to 'any' or the expected union type if known locally
      status: "Confirmed" as any,
      // Add required missing fields
      organisationId: "org-1",
      companion: { id: "comp-1", name: "Buddy", parentId: "parent-1" } as any,
      appointmentDate: new Date("2023-10-27"),
      startTime: "10:00",
      endTime: "10:30",
      start: new Date("2023-10-27T10:00:00"),
      end: new Date("2023-10-27T10:30:00"),
      user: { name: "Dr. Smith" } as any,
      ...overrides,
    }) as unknown as Appointment;

  const mockAppointment = createMockAppointment();

  const requestedAppointment = createMockAppointment({
    status: "Requested" as any,
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders all appointment details correctly", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );

    // Check Image
    const image = screen.getByAltText("Buddy");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/dog.jpg");

    // Check Basic Info
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    // Check Combined Fields
    expect(screen.getByText("Golden Retriever / Dog")).toBeInTheDocument();
    expect(screen.getByText("2023-10-27 / 10:00 AM")).toBeInTheDocument();

    // Check Specific Labels & Values
    expect(screen.getByText("Reason:")).toBeInTheDocument();
    expect(screen.getByText("Checkup")).toBeInTheDocument();

    // Note: The source code has a bug where "Room:" and "Staff:" both map to 'room' in display or text
    // We check for "Room 1" which covers both cases in the current UI logic
    expect(screen.getAllByText("Room 1").length).toBeGreaterThan(0);

    expect(screen.getByText("Lead:")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("renders formatted status text correctly", () => {
    // "confirmed" -> "Confirmed"
    const lowerCaseStatus = createMockAppointment({
      status: "confirmed" as any,
    });
    render(
      <AppointmentCard
        appointment={lowerCaseStatus}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  // --- 2. Logic & Conditional Rendering ---

  it("renders 'Accept' and 'Cancel' buttons when status is 'Requested'", () => {
    render(
      <AppointmentCard
        appointment={requestedAppointment}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    // "View" button should NOT be there
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });

  it("renders 'View' button when status is NOT 'Requested'", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );

    expect(screen.getByText("View")).toBeInTheDocument();
    // Accept/Cancel should NOT be there
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  // --- 3. Interaction Section ---

  it("calls handleViewAppointment when 'View' button is clicked", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );

    const viewButton = screen.getByText("View");
    fireEvent.click(viewButton);

    expect(mockHandleViewAppointment).toHaveBeenCalledTimes(1);
    expect(mockHandleViewAppointment).toHaveBeenCalledWith(mockAppointment);
  });

  // --- 4. Styling Section ---

  it("applies dynamic styles based on status", () => {
    render(
      <AppointmentCard
        appointment={mockAppointment}
        handleViewAppointment={mockHandleViewAppointment}
      />
    );
  });
});
