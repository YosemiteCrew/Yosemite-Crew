import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Specialities from "@/app/pages/Organization/Sections/Specialities/Specialities";
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from "@/app/hooks/useSpecialities";

// --- Mocks ---

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesWithServiceNamesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, buttonTitle, buttonClick, children }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      <button onClick={() => buttonClick(true)}>{buttonTitle}</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/SpecialitiesTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView }: any) => (
    <div data-testid="specialities-table">
      {filteredList.map((spec: any) => (
        <button
          key={spec._id}
          data-testid={`view-spec-${spec._id}`}
          onClick={() => {
            setActive(spec);
            setView(true);
          }}
        >
          View {spec.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock(
  "../../../../../pages/Organization/Sections/Specialities/AddSpeciality",
  () => ({
    __esModule: true,
    default: ({ showModal }: any) =>
      showModal ? <div data-testid="add-modal" /> : null,
  })
);

jest.mock(
  "../../../../../pages/Organization/Sections/Specialities/SpecialityInfo",
  () => ({
    __esModule: true,
    default: ({ showModal, activeSpeciality }: any) =>
      showModal ? (
        <div data-testid="info-modal">{activeSpeciality.name}</div>
      ) : null,
  })
);

describe("Specialities Section Component", () => {
  const mockSpecialities = [
    { _id: "spec-1", name: "Surgery", services: [] },
    { _id: "spec-2", name: "Dermatology", services: [] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly with a list of specialities", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    render(<Specialities />);

    expect(screen.getByText("Specialties & Services")).toBeInTheDocument();
    expect(screen.getByTestId("specialities-table")).toBeInTheDocument();
    expect(screen.getByText("View Surgery")).toBeInTheDocument();
  });

  it("handles empty list state", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      []
    );
    render(<Specialities />);

    expect(screen.queryByTestId("info-modal")).not.toBeInTheDocument();
  });

  // --- 2. Interaction Section ---

  it("opens the AddSpeciality modal when 'Add' button is clicked", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    render(<Specialities />);

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  it("opens the SpecialityInfo modal and sets the correct active speciality", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    render(<Specialities />);

    fireEvent.click(screen.getByTestId("view-spec-spec-2"));
    expect(screen.getByTestId("info-modal")).toHaveTextContent("Dermatology");
  });

  // --- 3. Logic & useEffect Section ---

  it("updates activeSpeciality if it exists in the new list after an update", () => {
    const { rerender } = render(<Specialities />);

    // Initial render
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    rerender(<Specialities />);

    // Update list (e.g., Surgery name changes)
    const updatedSpecs = [
      { _id: "spec-1", name: "Surgery Updated", services: [] },
      { _id: "spec-2", name: "Dermatology", services: [] },
    ];
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      updatedSpecs
    );

    rerender(<Specialities />);

    // Trigger view to verify updated name in the active state
    fireEvent.click(screen.getByTestId("view-spec-spec-1"));
    expect(screen.getByTestId("info-modal")).toHaveTextContent(
      "Surgery Updated"
    );
  });

  it("resets activeSpeciality to the first item if the current active one is deleted", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    const { rerender } = render(<Specialities />);

    // Set Dermatology (spec-2) as active
    fireEvent.click(screen.getByTestId("view-spec-spec-2"));
    expect(screen.getByTestId("info-modal")).toHaveTextContent("Dermatology");

    // New list where spec-2 is removed
    const listAfterDeletion = [
      { _id: "spec-1", name: "Surgery", services: [] },
    ];
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      listAfterDeletion
    );

    rerender(<Specialities />);

    // Should have defaulted back to Surgery (index 0)
    expect(screen.getByTestId("info-modal")).toHaveTextContent("Surgery");
  });

  it("sets activeSpeciality to null if the list becomes empty", () => {
    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
    const { rerender } = render(<Specialities />);

    (useSpecialitiesWithServiceNamesForPrimaryOrg as jest.Mock).mockReturnValue(
      []
    );
    rerender(<Specialities />);

    expect(screen.queryByTestId("info-modal")).not.toBeInTheDocument();
  });
});
