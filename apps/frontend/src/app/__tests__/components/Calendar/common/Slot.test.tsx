import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Slot from "@/app/components/Calendar/common/Slot";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Styles
jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "green" })),
}));

// Mock Next/Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    <img {...props} alt={props.alt} data-testid="pet-image" />
  ),
}));

// --- Test Data ---

const mockDate = new Date("2023-01-01T12:00:00Z");
const mockEvents: Appointment[] = [
  {
    _id: "1",
    companion: { name: "Buddy" },
    startTime: mockDate,
    status: "Confirmed",
  } as any,
  {
    _id: "2",
    companion: { name: "Luna" },
    startTime: mockDate,
    status: "Pending",
  } as any,
];

describe("Slot Component", () => {
  const mockHandleViewAppointment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Empty State Rendering ---

  it("renders an empty slot with correct height and borders", () => {
    const { container } = render(
      <Slot
        slotEvents={[]}
        height={100}
        handleViewAppointment={mockHandleViewAppointment}
        dayIndex={0}
        length={7}
      />
    );

    const slotDiv = container.firstChild as HTMLElement;
    expect(slotDiv).toHaveStyle("height: 100px");
    expect(slotDiv).toHaveClass("border-l");
    expect(slotDiv).not.toHaveClass("border-r");
    // Should be empty inside
    expect(slotDiv.children).toHaveLength(0);
  });

  // --- 2. Populated State Rendering ---

  it("renders appointments when events are provided", () => {
    render(
      <Slot
        slotEvents={mockEvents}
        height={150}
        handleViewAppointment={mockHandleViewAppointment}
        dayIndex={1}
        length={7}
      />
    );

    // Check Pet Names
    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();

    // Check Images
    const images = screen.getAllByTestId("pet-image");
    expect(images).toHaveLength(2);

    // Check Styling
  });

  // --- 3. Interaction ---

  it("calls handleViewAppointment when an event is clicked", () => {
    render(
      <Slot
        slotEvents={mockEvents}
        height={150}
        handleViewAppointment={mockHandleViewAppointment}
        dayIndex={1}
        length={7}
      />
    );

    const buddyBtn = screen.getByText("Buddy").closest("button");
    fireEvent.click(buddyBtn!);

    expect(mockHandleViewAppointment).toHaveBeenCalledTimes(1);
    expect(mockHandleViewAppointment).toHaveBeenCalledWith(mockEvents[0]);
  });
});
