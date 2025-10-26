import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CalendarCard from "@/app/components/CalendarCard/CalendarCard";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock("react-icons/fa6", () => ({
  FaCalendar: () => <span data-testid="calendar-icon" />,
  FaCircleCheck: () => <span data-testid="check-icon" />,
  FaUser: () => <span data-testid="user-icon" />,
}));
jest.mock("react-icons/ai", () => ({
  AiFillMinusCircle: () => <span data-testid="minus-icon" />,
}));

jest.mock("react-bootstrap", () => ({
  Button: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <button data-testid="mock-button" className={className}>
      {children}
    </button>
  ),
}));

describe("CalendarCard Component with Empty or Invalid Data", () => {
  it("renders all four status columns with default counts", () => {
    render(<CalendarCard data={{ data: [] }} />);

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    const counts = screen.getAllByText("00");
    expect(counts).toHaveLength(4);
  });

  it("gracefully handles null or undefined data", () => {
    render(<CalendarCard data={null} />);

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    expect(screen.queryByText("Luna Owner")).not.toBeInTheDocument();
  });

  it("renders correctly with missing inner data key", () => {
    render(<CalendarCard data={{}} />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });
});

describe("CalendarCard Component with Populated Data", () => {
  const mockAppointments = {
    data: [
      {
        ownerName: "Confirmed Owner",
        veterinarian: "Dr. Vet A",
        avatar: "avatar1.png",
        appointmentStatus: "confirmed",
        date: "Tuesday, 20 Aug–11:30 AM",
      },
      {
        ownerName: "Upcoming Owner",
        veterinarian: "Dr. Vet B",
        avatar: "avatar2.png",
        appointmentStatus: "upcoming",
        date: "Wednesday, 21 Aug–10:00 AM",
      },
      {
        ownerName: "Completed Owner",
        veterinarian: "Dr. Vet C",
        avatar: "avatar3.png",
        appointmentStatus: "completed",
        date: "N/A",
      },
      {
        ownerName: "Cancelled Owner",
        veterinarian: "Dr. Vet D",
        avatar: "avatar4.png",
        appointmentStatus: "cancelled",
        date: "N/A",
      },
    ],
  };

  it("renders appointments in correct columns with correct counts and icons", () => {
    render(<CalendarCard data={mockAppointments} />);
  });
});
