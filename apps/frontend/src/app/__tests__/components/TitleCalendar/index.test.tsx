import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TitleCalendar from "../../../components/TitleCalendar";

// --- Mocks ---

// Mock Buttons component
jest.mock("../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: { onClick: () => void; text: string }) => (
    <button data-testid="add-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock Datepicker component
jest.mock(
  "../../../components/Inputs/Datepicker",
  () =>
    ({ currentDate, setCurrentDate }: any) => (
      <div data-testid="datepicker">
        <input
          aria-label="Select Date"
          value={currentDate.toISOString().split("T")[0]}
          onChange={(e) => setCurrentDate(new Date(e.target.value))}
        />
      </div>
    )
);

// Mock Icons to prevent rendering issues and for easy identification if needed
jest.mock("react-icons/bs", () => ({
  BsCalendar2DateFill: () => <span data-testid="icon-vet" />,
  BsCalendar2DayFill: () => <span data-testid="icon-week" />,
}));

jest.mock("react-icons/fa6", () => ({
  FaUser: () => <span data-testid="icon-day" />,
}));

describe("TitleCalendar Component", () => {
  const mockSetActiveCalendar = jest.fn();
  const mockSetAddPopup = jest.fn();
  const mockSetCurrentDate = jest.fn();

  // Use a fixed date for consistent testing
  const initialDate = new Date("2023-10-01T00:00:00.000Z");

  const defaultProps = {
    activeCalendar: "vet",
    title: "My Calendar",
    setActiveCalendar: mockSetActiveCalendar,
    setAddPopup: mockSetAddPopup,
    currentDate: initialDate,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders the title and all main components", () => {
    render(<TitleCalendar {...defaultProps} count={0} />);

    // Check Title
    expect(screen.getByText("My Calendar")).toBeInTheDocument();

    // Check Add Button (via mock)
    expect(screen.getByTestId("add-btn")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();

    // Check Datepicker (via mock)
    expect(screen.getByTestId("datepicker")).toBeInTheDocument();

    // Check Icons (buttons)
    expect(screen.getByTestId("icon-vet")).toBeInTheDocument();
    expect(screen.getByTestId("icon-week")).toBeInTheDocument();
    expect(screen.getByTestId("icon-day")).toBeInTheDocument();
  });

  // --- Section 2: Interaction - Add Button ---
  it("opens the add popup when Add button is clicked", () => {
    render(<TitleCalendar {...defaultProps} count={0} />);

    const addBtn = screen.getByTestId("add-btn");
    fireEvent.click(addBtn);

    expect(mockSetAddPopup).toHaveBeenCalledWith(true);
  });

  // --- Section 3: Interaction - View Toggles ---
  it("sets active calendar to 'vet' when vet button is clicked", () => {
    // Render with a different active state to ensure click changes logic or at least triggers function
    render(<TitleCalendar {...defaultProps} activeCalendar="week" count={0} />);

    const vetBtn = screen.getByTestId("icon-vet").closest("button");
    fireEvent.click(vetBtn!);

    expect(mockSetActiveCalendar).toHaveBeenCalledWith("vet");
  });

  it("sets active calendar to 'week' when week button is clicked", () => {
    render(<TitleCalendar {...defaultProps} activeCalendar="vet" count={0} />);

    const weekBtn = screen.getByTestId("icon-week").closest("button");
    fireEvent.click(weekBtn!);

    expect(mockSetActiveCalendar).toHaveBeenCalledWith("week");
  });

  it("sets active calendar to 'day' when day button is clicked", () => {
    render(<TitleCalendar {...defaultProps} activeCalendar="vet" count={0} />);

    const dayBtn = screen.getByTestId("icon-day").closest("button");
    fireEvent.click(dayBtn!);

    expect(mockSetActiveCalendar).toHaveBeenCalledWith("day");
  });

  // --- Section 4: Styling (Active State) ---
  it("applies active styling to the correct button based on activeCalendar prop", () => {
    const { rerender } = render(
      <TitleCalendar {...defaultProps} activeCalendar="vet" count={0} />
    );

    const vetBtn = screen.getByTestId("icon-vet").closest("button");
    const weekBtn = screen.getByTestId("icon-week").closest("button");
    const dayBtn = screen.getByTestId("icon-day").closest("button");

    // Vet should be active (blue border/bg), others grey
    expect(vetBtn).toHaveClass("border-blue-text!");
    expect(weekBtn).toHaveClass("border-grey-light!");
    expect(dayBtn).toHaveClass("border-grey-light!");

    // Switch to Week
    rerender(<TitleCalendar {...defaultProps} activeCalendar="week" count={0} />);
    expect(vetBtn).toHaveClass("border-grey-light!");
    expect(weekBtn).toHaveClass("border-blue-text!");
    expect(dayBtn).toHaveClass("border-grey-light!");

    // Switch to Day
    rerender(<TitleCalendar {...defaultProps} activeCalendar="day" count={0} />);
    expect(vetBtn).toHaveClass("border-grey-light!");
    expect(weekBtn).toHaveClass("border-grey-light!");
    expect(dayBtn).toHaveClass("border-blue-text!");
  });
});
