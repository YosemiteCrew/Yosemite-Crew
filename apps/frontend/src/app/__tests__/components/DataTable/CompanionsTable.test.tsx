import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import { CompanionParent } from "@/app/pages/Companions/types";

// --- Mocks ---

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// Mock Utils
jest.mock("@/app/utils/date", () => ({
  getAgeInYears: jest.fn(() => "3 years"),
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn(),
}));

import { isHttpsImageUrl } from "@/app/utils/urls";

// NOTE: Not mocking GenericTable. We are integration testing with the real one.

// Mock CompanionCard for Mobile View
jest.mock("@/app/components/Cards/CompanionCard/CompanionCard", () => ({
  __esModule: true,
  default: ({ companion, handleViewCompanion, handleBookAppointment }: any) => (
    <div data-testid="companion-card">
      <span>{companion.companion.name}</span>
      <button
        data-testid={`view-card-${companion.companion._id}`}
        onClick={() => handleViewCompanion(companion)}
      >
        View
      </button>
      <button
        data-testid={`book-card-${companion.companion._id}`}
        onClick={() => handleBookAppointment(companion)}
      >
        Book
      </button>
    </div>
  ),
}));

// --- Test Data ---

const mockCompanionList: CompanionParent[] = [
  {
    companion: {
      _id: "c1",
      name: "Buddy",
      photoUrl: "https://valid.com/img.jpg",
      breed: "Golden",
      type: "Dog",
      gender: "Male",
      dateOfBirth: "2020-01-01",
      allergy: "Peanuts",
      status: "active",
    },
    parent: {
      firstName: "John",
    },
  },
  {
    companion: {
      _id: "c2",
      name: "Mittens",
      photoUrl: "broken-url",
      breed: "Siamese",
      type: "Cat",
      gender: "Female",
      dateOfBirth: "2019-01-01",
      allergy: "",
      status: "archived",
    },
    parent: {
      firstName: "Jane",
    },
  },
  {
    companion: {
      _id: "c3",
      name: "Rocky",
      photoUrl: null,
      breed: "Bulldog",
      type: "Dog",
      gender: "Male",
      dateOfBirth: "2021-01-01",
      status: null,
    },
    parent: {
      firstName: "Bob",
    },
  },
] as any;

describe("CompanionsTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();
  const mockSetBook = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (isHttpsImageUrl as unknown as jest.Mock).mockImplementation(
      (url) => url === "https://valid.com/img.jpg"
    );
  });

  // --- 1. Helper Function Tests (getStatusStyle) ---

  // --- 2. Component Rendering & Logic (Desktop Table) ---

  it("renders the table with correct data (Desktop View)", () => {
    const { container } = render(
      <CompanionsTable
        filteredList={mockCompanionList}
        activeCompanion={null}
        setActiveCompanion={mockSetActive}
        setViewCompanion={mockSetView}
        setBookAppointment={mockSetBook}
      />
    );

    // Get the desktop table container to avoid mobile duplicate text
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows specifically within the desktop table
    // Note: getAllByRole('row') includes the <thead> row (index 0)
    const rows = within(desktopView as HTMLElement).getAllByRole("row");

    // We expect 4 rows: 1 Header + 3 Data rows
    expect(rows).toHaveLength(4);

    // -- Row 1 Data (Index 1) --
    const row1 = rows[1];
    expect(within(row1).getByText("Buddy")).toBeInTheDocument();
    expect(within(row1).getByText("John")).toBeInTheDocument();

    // FIX: Image has alt="" so it has role="presentation".
    // We check for presentation role or query the img tag directly.
    const imgs1 = within(row1).getAllByRole("presentation");
    // Ensure one of the presentation elements is our image with the correct src
    const imageElement = imgs1.find((el) => el.tagName.toLowerCase() === "img");
    expect(imageElement).toHaveAttribute("src", "https://valid.com/img.jpg");

    // -- Row 2 Data (Index 2) --
    const row2 = rows[2];
    const imgs2 = within(row2).getAllByRole("presentation");
    const imageElement2 = imgs2.find(
      (el) => el.tagName.toLowerCase() === "img"
    );
    expect(imageElement2).toHaveAttribute(
      "src",
      "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
    );

    // Allergy Fallback Check
    const allergies = within(row2).getAllByText("-");
    expect(allergies.length).toBeGreaterThan(0);
  });

  it("handles action buttons in the table (View & Book)", () => {
    const { container } = render(
      <CompanionsTable
        filteredList={[mockCompanionList[0]]}
        activeCompanion={null}
        setActiveCompanion={mockSetActive}
        setViewCompanion={mockSetView}
        setBookAppointment={mockSetBook}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    // Get the first data row (index 1)
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1];

    const buttons = within(dataRow).getAllByRole("button");
    // Order: View, Book, Task

    // Click View
    fireEvent.click(buttons[0]);
    expect(mockSetActive).toHaveBeenCalledWith(mockCompanionList[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);

    // Clear and Click Book
    jest.clearAllMocks();
    fireEvent.click(buttons[1]);
    expect(mockSetActive).toHaveBeenCalledWith(mockCompanionList[0]);
    expect(mockSetBook).toHaveBeenCalledWith(true);
  });

  // --- 3. Component Rendering & Logic (Mobile Cards) ---

  it("renders CompanionCards when data exists (Mobile View)", () => {
    render(
      <CompanionsTable
        filteredList={mockCompanionList}
        activeCompanion={null}
        setActiveCompanion={mockSetActive}
        setViewCompanion={mockSetView}
        setBookAppointment={mockSetBook}
      />
    );

    // Cards are mocked with test-id, so finding them is robust
    const cards = screen.getAllByTestId("companion-card");
    expect(cards).toHaveLength(3);

    // Scope check to the first card
    expect(within(cards[0]).getByText("Buddy")).toBeInTheDocument();
  });

  it("renders 'No data available' when list is empty", () => {
    render(
      <CompanionsTable
        filteredList={[]}
        activeCompanion={null}
        setActiveCompanion={mockSetActive}
        setViewCompanion={mockSetView}
        setBookAppointment={mockSetBook}
      />
    );

    // Note: The real GenericTable also renders "No data available" inside the table body (colspan).
    // And the mobile view renders it in a div.
    // So there should be at least 1, likely 2 instances.
    const messages = screen.getAllByText("No data available");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it("handles card actions correctly via props passed to CompanionCard", () => {
    render(
      <CompanionsTable
        filteredList={[mockCompanionList[0]]}
        activeCompanion={null}
        setActiveCompanion={mockSetActive}
        setViewCompanion={mockSetView}
        setBookAppointment={mockSetBook}
      />
    );

    // Use specific test-ids defined in the mock
    const viewBtn = screen.getByTestId("view-card-c1");
    fireEvent.click(viewBtn);
    expect(mockSetActive).toHaveBeenCalledWith(mockCompanionList[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);

    jest.clearAllMocks();

    const bookBtn = screen.getByTestId("book-card-c1");
    fireEvent.click(bookBtn);
    expect(mockSetActive).toHaveBeenCalledWith(mockCompanionList[0]);
    expect(mockSetBook).toHaveBeenCalledWith(true);
  });
});
