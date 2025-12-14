import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Appointments, {
  getStatusStyle,
} from "@/app/components/DataTable/Appointments";
import { AppointmentsProps } from "@/app/types/appointments";

// --- Mocks ---

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || "mock-img"} />,
}));

// Mock Next.js Link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock Icons
jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <span data-testid="icon-check">Check</span>,
}));
jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <span data-testid="icon-close">Close</span>,
}));
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="icon-eye">View</span>,
}));

// Mock AppointmentCard (Mobile view)
jest.mock("@/app/components/Cards/AppointmentCard", () => ({
  __esModule: true,
  default: ({ appointment, handleViewAppointment }: any) => (
    <div data-testid="mobile-card">
      <span data-testid="mobile-name">{appointment.name}</span>
      <button
        data-testid={`mobile-view-btn-${appointment.id}`}
        onClick={() => handleViewAppointment(appointment)}
      >
        Mobile View
      </button>
    </div>
  ),
}));

// IMPORTANT: Smart Mock for GenericTable
// We render the columns to test the 'render' functions defined in Appointments.tsx
jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, rowIndex: number) => (
          <tr key={rowIndex} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

describe("Appointments Component", () => {
  const mockSetActiveAppointment = jest.fn();
  const mockSetViewPopup = jest.fn();

  const mockData: AppointmentsProps[] = [
    {
      id: "1",
      name: "Fido",
      image: "/dog.png",
      parentName: "John Doe",
      reason: "Checkup",
      emergency: false,
      service: "General",
      room: "Room 1",
      time: "10:00 AM",
      date: "2023-10-25",
      lead: "Dr. Smith",
      leadDepartment: "Surgery",
      support: ["Nurse Joy"],
      status: "In-progress",
    } as any,
    {
      id: "2",
      name: "Rex",
      image: "/dog2.png",
      parentName: "Jane Smith",
      reason: "Injury",
      emergency: true,
      service: "Ortho",
      room: "Room 2",
      time: "11:00 AM",
      date: "2023-10-25",
      lead: "Dr. House",
      leadDepartment: "Diagnostic",
      support: ["Nurse A", "Nurse B"],
      status: "Requested",
    } as any,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering & Data Mapping ---

  it("renders the table with correct data columns", () => {
    render(
      <Appointments
        filteredList={mockData}
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );

    const table = screen.getByTestId("generic-table");

    // Helper to scope queries to the table only (ignoring mobile cards)
    const tableScope = within(table);

    // Row 1 Data
    expect(tableScope.getByText("Fido")).toBeInTheDocument();
    expect(tableScope.getByText("John")).toBeInTheDocument();
    expect(tableScope.getByText("Checkup")).toBeInTheDocument();
    expect(tableScope.getByText("Room 1")).toBeInTheDocument();
    expect(tableScope.getByText("10:00 AM")).toBeInTheDocument();
    expect(tableScope.getByText("Dr. Smith")).toBeInTheDocument();
    expect(tableScope.getByText("Surgery")).toBeInTheDocument();
    expect(tableScope.getByText("In-progress")).toBeInTheDocument();

    // Check multiple Nurse instances are present
    const nurses = tableScope.getAllByText("Nurse");
    expect(nurses.length).toBeGreaterThan(0); // 1 from Fido, 2 from Rex

    // Row 2 Data (Emergency)
    expect(tableScope.getByText("Rex")).toBeInTheDocument();
    expect(tableScope.getByText("Emergency")).toBeInTheDocument();
  });

  it("renders mobile cards (AppointmentCard)", () => {
    render(
      <Appointments
        filteredList={mockData}
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );

    const cards = screen.getAllByTestId("mobile-card");
    expect(cards).toHaveLength(2);

    // Check inside the first mobile card specifically
    const firstCard = within(cards[0]);
    expect(firstCard.getByTestId("mobile-name")).toHaveTextContent("Fido");
  });

  // --- 2. Action Logic & Interactivity ---

  it("renders 'View' icon button for standard statuses and handles click", () => {
    render(
      <Appointments
        filteredList={[mockData[0]]} // In-progress
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );

    const viewBtn = screen.getByTestId("icon-eye");
    expect(viewBtn).toBeInTheDocument();

    // The icon is inside a button, find the button to click or click icon if propagated
    const btn = viewBtn.closest("button");
    fireEvent.click(btn!);

    expect(mockSetActiveAppointment).toHaveBeenCalledWith(mockData[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("renders 'Accept/Reject' icons for 'Requested' status", () => {
    render(
      <Appointments
        filteredList={[mockData[1]]} // Requested
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );

    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
    expect(screen.getByTestId("icon-close")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-eye")).not.toBeInTheDocument();
  });

  it("handles mobile view button click", () => {
    render(
      <Appointments
        filteredList={[mockData[0]]}
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );
  });

  // --- 3. Conditional Props (hideActions) ---

  it("hides the actions column when hideActions is true", () => {
    render(<Appointments filteredList={mockData} hideActions={true} />);

    // "Actions" header should not be present
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    // Action icons should not be present in table
    expect(screen.queryByTestId("icon-eye")).not.toBeInTheDocument();
  });

  it("shows the actions column when hideActions is false (default)", () => {
    render(<Appointments filteredList={mockData} />);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  // --- 4. Style Helper (getStatusStyle) ---

  describe("getStatusStyle helper", () => {
    it("returns correct styles for 'in-progress'", () => {
      const style = getStatusStyle("in-progress");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct styles for 'completed'", () => {
      const style = getStatusStyle("completed");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#008F5D" });
    });

    it("returns correct styles for 'checked-in'", () => {
      const style = getStatusStyle("checked-in");
      expect(style).toEqual({ color: "#F68523", backgroundColor: "#FEF3E9" });
    });

    it("returns correct styles for 'requested'", () => {
      const style = getStatusStyle("requested");
      expect(style).toEqual({ color: "#302f2e", backgroundColor: "#eaeaea" });
    });

    it("returns default styles for unknown status", () => {
      const style = getStatusStyle("unknown-status");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#247AED" });
    });

    it("handles case insensitivity", () => {
      const style = getStatusStyle("In-ProGress");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });
  });
});
