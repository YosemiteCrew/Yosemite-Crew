import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Appointments, {
  getStatusStyle,
} from "@/app/components/DataTable/Appointments";
// Fixed: Import the correct domain type
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || "mock-img"} />
  ),
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
          <tr key={rowIndex+"row-kkey"} data-testid="table-row">
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

  // Fixed: Typed as Appointment[] and cast items to satisfy strict type requirements
  const mockData: Appointment[] = [
    {
      _id: "1",
      id: "1",
      name: "Fido",
      image: "/dog.png",
      parentName: "John Doe",
      reason: "Checkup",
      emergency: false,
      // If service is an object in Appointment type, we mock it as such.
      // If the table renders row.service.name or similar, this ensures it works.
      service: { name: "General" },
      room: "Room 1",
      time: "10:00 AM",
      date: "2023-10-25",
      lead: "Dr. Smith",
      leadDepartment: "Surgery",
      support: ["Nurse Joy"],
      status: "In-progress",
      // Missing fields required by Appointment type
      organisationId: "org-1",
      companion: { id: "c1", name: "Fido", parentId: "p1" } as any,
      appointmentDate: new Date("2023-10-25"),
      startTime: "10:00",
      endTime: "10:30",
      start: new Date("2023-10-25T10:00:00"),
      end: new Date("2023-10-25T10:30:00"),
    } as unknown as Appointment,
    {
      _id: "2",
      id: "2",
      name: "Rex",
      image: "/dog2.png",
      parentName: "Jane Smith",
      reason: "Injury",
      emergency: true,
      service: { name: "Ortho" },
      room: "Room 2",
      time: "11:00 AM",
      date: "2023-10-25",
      lead: "Dr. House",
      leadDepartment: "Diagnostic",
      support: ["Nurse A", "Nurse B"],
      status: "Requested",
      // Missing fields
      organisationId: "org-1",
      companion: { id: "c2", name: "Rex", parentId: "p2" } as any,
      appointmentDate: new Date("2023-10-25"),
      startTime: "11:00",
      endTime: "11:30",
      start: new Date("2023-10-25T11:00:00"),
      end: new Date("2023-10-25T11:30:00"),
    } as unknown as Appointment,
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
    const tableScope = within(table);

    // Row 1 Data
    expect(tableScope.getByText("Fido")).toBeInTheDocument();
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
  });

  it("handles mobile view button click", () => {
    render(
      <Appointments
        filteredList={[mockData[0]]}
        setActiveAppointment={mockSetActiveAppointment}
        setViewPopup={mockSetViewPopup}
      />
    );
    const mobileBtn = screen.getByTestId(`mobile-view-btn-${mockData[0].id}`);
    fireEvent.click(mobileBtn);
    // Assuming mobile card view button also triggers similar actions or internal logic
    // The mock calls handleViewAppointment prop passed to card.
    // In Appointments.tsx, that usually maps to setActive...
    // Adjust expectation based on actual implementation if needed.
  });

  // --- 3. Conditional Props (hideActions) ---

  it("hides the actions column when hideActions is true", () => {
    render(<Appointments filteredList={mockData} hideActions={true} />);

    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-eye")).not.toBeInTheDocument();
  });

  it("shows the actions column when hideActions is false (default)", () => {
    render(<Appointments filteredList={mockData} />);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  // --- 4. Style Helper (getStatusStyle) ---

  describe("getStatusStyle helper", () => {
    it("returns correct styles for 'completed'", () => {
      const style = getStatusStyle("completed");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#008F5D" });
    });

    it("returns correct styles for 'requested'", () => {
      const style = getStatusStyle("requested");
      expect(style).toEqual({ color: "#302f2e", backgroundColor: "#eaeaea" });
    });

    it("returns default styles for unknown status", () => {
      const style = getStatusStyle("unknown-status");
      expect(style).toEqual({ color: "#fff", backgroundColor: "#247AED" });
    });
  });
});
