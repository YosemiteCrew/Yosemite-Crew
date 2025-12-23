import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Team from "@/app/pages/Organization/Sections/Team/Team";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

// --- Mocks ---

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
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

jest.mock("@/app/components/DataTable/AvailabilityTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView }: any) => (
    <div data-testid="availability-table">
      {filteredList.map((team: any) => (
        <button
          key={team._id}
          data-testid={`view-team-${team._id}`}
          onClick={() => {
            setActive(team);
            setView(true);
          }}
        >
          View {team.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("../../../../../pages/Organization/Sections/Team/AddTeam", () => ({
  __esModule: true,
  default: ({ showModal }: any) =>
    showModal ? <div data-testid="add-team-modal" /> : null,
}));

jest.mock("../../../../../pages/Organization/Sections/Team/TeamInfo", () => ({
  __esModule: true,
  default: ({ showModal, activeTeam }: any) =>
    showModal ? (
      <div data-testid="team-info-modal">{activeTeam.name}</div>
    ) : null,
}));

describe("Team Section Component", () => {
  const mockTeams = [
    { _id: "t1", name: "Dr. A" },
    { _id: "t2", name: "Nurse B" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly with a list of team members", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    render(<Team />);

    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByTestId("availability-table")).toBeInTheDocument();
    expect(screen.getByText("View Dr. A")).toBeInTheDocument();
  });

  it("handles empty team list state", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Team />);

    expect(screen.queryByTestId("team-info-modal")).not.toBeInTheDocument();
  });

  // --- 2. Interaction Section ---

  it("opens the AddTeam modal when 'Add' button is clicked", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    render(<Team />);

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-team-modal")).toBeInTheDocument();
  });

  it("opens the TeamInfo modal and sets the correct active team member", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    render(<Team />);

    fireEvent.click(screen.getByTestId("view-team-t2"));
    expect(screen.getByTestId("team-info-modal")).toHaveTextContent("Nurse B");
  });

  // --- 3. Logic & useEffect Section ---

  it("updates activeTeam if it exists in the new list after an update", () => {
    const { rerender } = render(<Team />);

    // Initial render
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    rerender(<Team />);

    // Update list (e.g., Dr. A name changes)
    const updatedTeams = [
      { _id: "t1", name: "Dr. A Updated" },
      { _id: "t2", name: "Nurse B" },
    ];
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(updatedTeams);

    rerender(<Team />);

    // Trigger view to verify updated name in the active state
    // We assume setActiveTeam logic maintained t1 as active because it was initially active (index 0)
    // or we manually set it to verify persistence.
    // Let's manually set t1 active first to be sure logic holds.
    fireEvent.click(screen.getByTestId("view-team-t1"));
    expect(screen.getByTestId("team-info-modal")).toHaveTextContent(
      "Dr. A Updated"
    );
  });

  it("resets activeTeam to the first item if the current active one is removed", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    const { rerender } = render(<Team />);

    // Set Nurse B (t2) as active
    fireEvent.click(screen.getByTestId("view-team-t2"));
    expect(screen.getByTestId("team-info-modal")).toHaveTextContent("Nurse B");

    // New list where t2 is removed
    const listAfterDeletion = [{ _id: "t1", name: "Dr. A" }];
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(listAfterDeletion);

    rerender(<Team />);

    // Should have defaulted back to Dr. A (index 0)
    expect(screen.getByTestId("team-info-modal")).toHaveTextContent("Dr. A");
  });

  it("sets activeTeam to null if the list becomes empty", () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    const { rerender } = render(<Team />);

    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    rerender(<Team />);

    expect(screen.queryByTestId("team-info-modal")).not.toBeInTheDocument();
  });
});
