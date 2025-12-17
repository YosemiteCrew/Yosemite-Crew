import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CompanionCard from "@/app/components/Cards/CompanionCard/CompanionCard";
import { CompanionParent } from "@/app/pages/Companions/types";
import { isHttpsImageUrl } from "@/app/utils/urls";

// --- Mocks ---

// Mock Next/Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// Mock Utils & Helpers
jest.mock("@/app/components/DataTable/CompanionsTable", () => ({
  getStatusStyle: jest.fn(() => ({ color: "green" })),
}));

jest.mock("@/app/utils/date", () => ({
  getAgeInYears: jest.fn(() => "3 years"),
}));

// We mock the entire module so isHttpsImageUrl becomes a jest.fn()
jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn(),
}));

// --- Test Data ---

const mockCompanion: CompanionParent = {
  companion: {
    _id: "c1",
    name: "Rex",
    breed: "Shepherd",
    type: "Dog",
    photoUrl: "https://valid-url.com/dog.jpg",
    gender: "Male",
    dateOfBirth: "2020-01-01",
    allergy: "Chicken",
    status: "active",
  },
  parent: {
    _id: "p1",
    firstName: "Alice",
  },
} as any;

describe("CompanionCard Component", () => {
  const mockHandleView = jest.fn();
  const mockHandleBook = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Double cast to satisfy TS
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(true);
  });

  // --- 1. Rendering Details ---

  it("renders companion details correctly", () => {
    render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    expect(screen.getByText("Rex")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Shepherd / Dog")).toBeInTheDocument();
    expect(screen.getByText("Male - 3 years")).toBeInTheDocument();
    expect(screen.getByText("Chicken")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  // --- 2. Image Logic ---

  it("renders companion photo if URL is valid HTTPS", () => {
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(true);

    const { container } = render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    // Images with alt="" are not accessible via getByRole('img').
    // Use querySelector to find the img tag directly.
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://valid-url.com/dog.jpg");
  });

  it("renders fallback placeholder image if URL is invalid", () => {
    (isHttpsImageUrl as unknown as jest.Mock).mockReturnValue(false);

    const { container } = render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
    );
  });

  // --- 3. Fallback Logic ---

  it("handles missing optional fields (allergies, status)", () => {
    const incompleteCompanion = {
      ...mockCompanion,
      companion: {
        ...mockCompanion.companion,
        allergy: null,
        status: null, // Should default to 'inactive'
      },
    } as any;

    render(
      <CompanionCard
        companion={incompleteCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    // Check Allergy Fallback
    const allergyLabel = screen.getByText("Allergies:");
    expect(allergyLabel.parentElement?.children[1]).toHaveTextContent("-");

    // Check Status Fallback
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  // --- 4. Interactions ---

  it("calls handleViewCompanion when View button is clicked", () => {
    render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledWith(mockCompanion);
  });

  it("calls handleBookAppointment when Schedule button is clicked", () => {
    render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    const scheduleBtn = screen.getByText("Schedule");
    fireEvent.click(scheduleBtn);

    expect(mockHandleBook).toHaveBeenCalledWith(mockCompanion);
  });

  it("has a Task button (visual check only)", () => {
    render(
      <CompanionCard
        companion={mockCompanion}
        handleViewCompanion={mockHandleView}
        handleBookAppointment={mockHandleBook}
      />
    );

    expect(screen.getByText("Task")).toBeInTheDocument();
  });
});
