import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddSpeciality from "@/app/pages/Organization/Sections/Specialities/AddSpeciality";
import { createBulkSpecialityServices } from "@/app/services/specialityService";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

jest.mock("@/app/services/specialityService", () => ({
  createBulkSpecialityServices: jest.fn(),
}));

// Mock child components to simplify testing logic
jest.mock(
  "@/app/components/Inputs/SpecialitySearch/SpecialitySearchWeb",
  () => ({
    __esModule: true,
    default: ({ setSpecialities }: any) => (
      <button
        data-testid="mock-add-btn"
        onClick={() =>
          setSpecialities([
            {
              name: "New Speciality",
              services: [],
              organisationId: "org-123",
            },
          ])
        }
      >
        Add Mock Speciality
      </button>
    ),
  })
);

// FIX: Use absolute alias path to correctly find the module
jest.mock(
  "@/app/pages/Organization/Sections/Specialities/SpecialityCard",
  () => ({
    __esModule: true,
    default: ({ speciality }: { speciality: SpecialityWeb }) => (
      <div data-testid="speciality-card">{speciality.name} Content</div>
    ),
  })
);

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title, onDeleteClick }: any) => (
    <div data-testid="mock-accordion">
      <span>{title}</span>
      <button data-testid="delete-btn" onClick={onDeleteClick}>
        Delete
      </button>
      {children}
    </div>
  ),
}));

describe("AddSpeciality Component", () => {
  const mockSetShowModal = jest.fn();
  const mockCurrentSpecialities: SpecialityWeb[] = [
    { name: "Existing One", services: [], organisationId: "org-123" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly when showModal is true", () => {
    render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    expect(screen.getByText("Add specialities")).toBeInTheDocument();
    expect(screen.getByTestId("mock-add-btn")).toBeInTheDocument();
  });

  it("closes modal when close icon is clicked", () => {
    const { container } = render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 2. Interaction & Logic Section ---

  it("adds a speciality via search and renders an accordion", () => {
    render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("mock-add-btn"));

    expect(screen.getByText("New Speciality")).toBeInTheDocument();
    expect(screen.getByTestId("speciality-card")).toBeInTheDocument();
  });

  it("removes a speciality from the list when delete is clicked", () => {
    render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("mock-add-btn"));
    expect(screen.getByText("New Speciality")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("delete-btn"));
    expect(screen.queryByText("New Speciality")).not.toBeInTheDocument();
  });

  // --- 3. Submission Section ---

  it("successfully submits form data and closes modal", async () => {
    (createBulkSpecialityServices as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("mock-add-btn"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createBulkSpecialityServices).toHaveBeenCalledWith([
        {
          name: "New Speciality",
          services: [],
          organisationId: "org-123",
        },
      ]);
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  // --- 4. Error Handling Section ---

  it("logs error to console when API submission fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const mockError = new Error("API Failure");
    (createBulkSpecialityServices as jest.Mock).mockRejectedValueOnce(
      mockError
    );

    render(
      <AddSpeciality
        showModal={true}
        setShowModal={mockSetShowModal}
        specialities={mockCurrentSpecialities}
      />
    );

    fireEvent.click(screen.getByTestId("mock-add-btn"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save specialities:",
        mockError
      );
    });

    consoleSpy.mockRestore();
  });
});
