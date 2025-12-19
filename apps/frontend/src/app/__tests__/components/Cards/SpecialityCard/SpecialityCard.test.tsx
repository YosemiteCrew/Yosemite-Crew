import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SpecialityCard from "@/app/components/Cards/SpecialityCard/SpecialityCard";
import { Speciality } from "@yosemite-crew/types";

// --- Test Data ---

const mockSpeciality: Speciality = {
  _id: "1",
  name: "Cardiology",
  description: "Heart stuff",
} as any;

describe("SpecialityCard Component", () => {
  const mockSetSpecialities = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the speciality name", () => {
    render(
      <SpecialityCard
        speciality={mockSpeciality}
        setSpecialities={mockSetSpecialities}
      />
    );

    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("renders the delete icon", () => {
    const { container } = render(
      <SpecialityCard
        speciality={mockSpeciality}
        setSpecialities={mockSetSpecialities}
      />
    );

    // react-icons render as SVGs. We can check for the SVG element.
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("speciality-delete");
  });

  // --- 2. Interaction & Logic ---

  it("triggers setSpecialities with filtering logic when delete is clicked", () => {
    render(
      <SpecialityCard
        speciality={mockSpeciality}
        setSpecialities={mockSetSpecialities}
      />
    );

    const deleteBtn = document.querySelector(".speciality-delete");
    fireEvent.click(deleteBtn!);

    // 1. Verify setSpecialities was called
    expect(mockSetSpecialities).toHaveBeenCalledTimes(1);

    // 2. Capture the state updater function passed to setSpecialities
    // The component calls: setSpecialities((prev) => ...)
    const updateFn = mockSetSpecialities.mock.calls[0][0];

    // 3. Test the logic inside the updater function
    const existingList = [
      { name: "Dermatology" },
      { name: "Cardiology" }, // The one to be deleted
      { name: "Neurology" },
    ] as Speciality[];

    const result = updateFn(existingList);

    // Should remove "Cardiology"
    expect(result).toHaveLength(2);
    expect(result.find((s: any) => s.name === "Cardiology")).toBeUndefined();
    expect(result.find((s: any) => s.name === "Dermatology")).toBeDefined();
    expect(result.find((s: any) => s.name === "Neurology")).toBeDefined();
  });
});
