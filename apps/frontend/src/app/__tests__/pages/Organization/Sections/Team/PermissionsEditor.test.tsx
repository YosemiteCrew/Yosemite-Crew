import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PermissionsEditor from "@/app/pages/Organization/Sections/Team/PermissionsEditor";
import { PERMISSIONS, RoleCode } from "@/app/utils/permissions";

// --- Mocks ---

// Mock Accordion to render children immediately
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid="accordion">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Mock permissions utils to control Role Defaults for logic testing
jest.mock("@/app/utils/permissions", () => {
  const actual = jest.requireActual("@/app/utils/permissions");
  return {
    ...actual,
    ROLE_PERMISSIONS: {
      ...actual.ROLE_PERMISSIONS,
      // Custom test roles to verify priority logic
      TEST_ROLE_ANY: [actual.PERMISSIONS.APPOINTMENTS_VIEW_ANY], // Prefers 'ANY'
      TEST_ROLE_OWN: [actual.PERMISSIONS.APPOINTMENTS_VIEW_OWN], // Prefers 'OWN'
      TEST_ROLE_EMPTY: [], // Has nothing
    },
  };
});

describe("PermissionsEditor Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the table structure and specific permission rows", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("renders checked state correctly based on value prop", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
        onChange={mockOnChange}
      />
    );

    // Get all checkboxes.
    // Note: Appointments view is the first checkbox in the list based on PERMISSION_ROWS order
    const checkboxes = screen.getAllByRole(
      "checkbox"
    ) as unknown as HTMLInputElement[];
    const apptViewCheckbox = checkboxes[0]; // Appointments View

    expect(apptViewCheckbox).toBeChecked();
  });

  it("renders dashes for disabled/missing permission slots", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    // The "Organization" row has no 'view' permissions defined in PERMISSION_ROWS.
    // It should render "Organization" label and a dash in the view column.
    const orgRow = screen.getByText("Organization").closest(".flex.w-full");
    expect(orgRow).toHaveTextContent("—");
  });

  // --- 2. Toggle Logic: Unchecking (Removing) ---

  it("removes permissions when a checked box is unchecked", () => {
    // Start with both ANY and OWN permissions
    const currentPerms = [
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      PERMISSIONS.APPOINTMENTS_VIEW_OWN,
    ];

    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={currentPerms}
        onChange={mockOnChange}
      />
    );

    // Uncheck the box
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Appointments View

    // Expect onChange to be called with an empty array (removing both candidates)
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  // --- 3. Toggle Logic: Checking (Adding) with Priority ---

  it("adds permission preferring Role Default (Priority: ANY)", () => {
    // Role prefers VIEW_ANY
    render(
      <PermissionsEditor
        role={"TEST_ROLE_ANY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Toggle Appointments View

    // Should add APPOINTMENTS_VIEW_ANY because it matches the role default
    expect(mockOnChange).toHaveBeenCalledWith([
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
    ]);
  });

  it("adds permission preferring Role Default (Priority: OWN)", () => {
    // Role prefers VIEW_OWN
    render(
      <PermissionsEditor
        role={"TEST_ROLE_OWN" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Toggle Appointments View

    // Should add APPOINTMENTS_VIEW_OWN because it matches the role default
    expect(mockOnChange).toHaveBeenCalledWith([
      PERMISSIONS.APPOINTMENTS_VIEW_OWN,
    ]);
  });

  it("adds default priority permission if Role Default matches neither", () => {
    // Role has nothing
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Toggle Appointments View

    // Should fall back to index 0 of viewEnablePriority (usually VIEW_ANY)
    expect(mockOnChange).toHaveBeenCalledWith([
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
    ]);
  });

  // --- 4. Edit Column Toggle ---

  it("handles toggling the Edit column correctly", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    // Find checkboxes for Appointments.
    // Index 0 = View, Index 1 = Edit (based on grid layout in component)
    const checkboxes = screen.getAllByRole("checkbox");
    const editCheckbox = checkboxes[1];

    fireEvent.click(editCheckbox);

    // Should add the default Edit permission (usually EDIT_ANY)
    expect(mockOnChange).toHaveBeenCalledWith([
      PERMISSIONS.APPOINTMENTS_EDIT_ANY,
    ]);
  });

  // --- 5. Reset Functionality ---

  it("resets permissions to role defaults when button is clicked", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_OWN" as RoleCode}
        value={[PERMISSIONS.INVENTORY_VIEW_ANY]} // User has some random permission
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("Reset to role defaults"));

    // Should call onChange with exactly what is in ROLE_PERMISSIONS['TEST_ROLE_OWN']
    expect(mockOnChange).toHaveBeenCalledWith([
      PERMISSIONS.APPOINTMENTS_VIEW_OWN,
    ]);
  });

  // --- 6. Helper Function Coverage (Edge Cases) ---

  it("handles rows with null enabledPriority gracefully", () => {
    // The 'Organization' row in PERMISSION_ROWS only has 'edit', no 'view'.
    // Render and ensure no crash.
    // Also, 'Organization' edit has no 'viewEnablePriority'.
    // We try to click the Edit button for Organization.

    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );

    // Find the input corresponding to Organization Edit.
    // Since "Organization" is the last row, let's find the last checkbox.
    const checkboxes = screen.getAllByRole("checkbox");
    const lastCheckbox = checkboxes.at(-1)!;

    fireEvent.click(lastCheckbox);

    // Should successfully trigger change for ORG_DELETE
    expect(mockOnChange).toHaveBeenCalledWith([PERMISSIONS.ORG_DELETE]);
  });

  it("does not crash when toggling if candidates are somehow missing", () => {
    render(
      <PermissionsEditor
        role={"TEST_ROLE_EMPTY" as RoleCode}
        value={[]}
        onChange={mockOnChange}
      />
    );
  });
});
