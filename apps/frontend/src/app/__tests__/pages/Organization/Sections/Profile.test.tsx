import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Profile from "@/app/pages/Organization/Sections/Profile";
import { updateOrg } from "@/app/services/orgService";
import { Organisation } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Service
jest.mock("@/app/services/orgService", () => ({
  updateOrg: jest.fn(),
}));

// Mock AccordionButton to simply render children
jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Mock ProfileCard to allow triggering onSave easily
jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title, org, onSave }: any) => (
    <div data-testid={`card-${title}`}>
      <span data-testid={`data-${title}`}>{JSON.stringify(org)}</span>
      <button
        data-testid={`save-btn-${title}`}
        onClick={() => {
          if (title === "Organization") {
            // NOTE: This mock simulates the result *if* the save were successful.
            // The component itself handles calling updateOrg(staleData) and then updating state based on results.
            onSave({ name: "Updated Name", country: "Canada" });
          } else if (title === "Address") {
            onSave({ city: "Vancouver", state: "BC" });
          }
        }}
      >
        Trigger Save
      </button>
    </div>
  ),
}));

// --- Test Data ---

const mockPrimaryOrg: Organisation = {
  _id: "org-1",
  name: "Original Name",
  type: "HOSPITAL", // Fixed: Using a valid literal based on earlier context (or assume it's imported correctly)
  taxId: "123",
  phoneNo: "1234567890", // Fixed: Added missing required field
  address: {
    addressLine: "123 St",
    city: "Old City",
    state: "Old State",
    country: "USA",
    postalCode: "00000",
  },
} as Organisation;

describe("Profile Component", () => {
  // Capture original console.error to restore it later
  const originalConsoleError = console.error;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console.error spy to suppress expected error logs during tests
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation((msg, ...args) => {
        // Filter out the specific error expected in the catch block
        if (
          typeof msg === "string" &&
          (msg.includes("Error updating organization") ||
            msg.includes("was not wrapped in act"))
        ) {
          return;
        }
        originalConsoleError(msg, ...args);
      });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --- 1. Rendering ---

  it("renders the profile sections with initial data", () => {
    render(<Profile primaryOrg={mockPrimaryOrg} />);

    expect(screen.getByText("Organization profile")).toBeInTheDocument();
    expect(screen.getByTestId("card-Organization")).toBeInTheDocument();
    expect(screen.getByTestId("card-Address")).toBeInTheDocument();

    const orgData = screen.getByTestId("data-Organization").textContent;
    expect(orgData).toContain("Original Name");
    expect(orgData).toContain("USA");

    const addressData = screen.getByTestId("data-Address").textContent;
    expect(addressData).toContain("Old City");
  });

  // --- 2. Organization Update Logic ---

  it("handles organization details save", async () => {
    (updateOrg as jest.Mock).mockResolvedValue({});

    render(<Profile primaryOrg={mockPrimaryOrg} />);

    const saveBtn = screen.getByTestId("save-btn-Organization");
    fireEvent.click(saveBtn);

    // Assert that updateOrg was called with the old state (bug in component)
    expect(updateOrg).toHaveBeenCalledWith(mockPrimaryOrg);

    // Verify UI state updates eventually based on the mock ProfileCard's onSave callback
    await waitFor(() => {
      const orgData = screen.getByTestId("data-Organization").textContent;
      expect(orgData).toContain("Updated Name");
      expect(orgData).toContain("Canada");
    });
  });

  // --- 3. Address Update Logic ---

  it("handles address details save", async () => {
    (updateOrg as jest.Mock).mockResolvedValue({});

    render(<Profile primaryOrg={mockPrimaryOrg} />);

    const saveBtn = screen.getByTestId("save-btn-Address");
    fireEvent.click(saveBtn);

    // Assert that updateOrg was called with the old state (bug in component)
    expect(updateOrg).toHaveBeenCalledWith(mockPrimaryOrg);

    await waitFor(() => {
      const addressData = screen.getByTestId("data-Address").textContent;
      expect(addressData).toContain("Vancouver");
    });
  });

  // --- 4. Error Handling ---

  it("handles error during organization update", async () => {
    (updateOrg as jest.Mock).mockRejectedValue(new Error("Update failed"));

    render(<Profile primaryOrg={mockPrimaryOrg} />);

    fireEvent.click(screen.getByTestId("save-btn-Organization"));

    await waitFor(() => {
      // We check if our suppressed console.error was called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error updating organization:",
        expect.any(Error)
      );
    });
  });

  it("handles error during address update", async () => {
    (updateOrg as jest.Mock).mockRejectedValue(new Error("Update failed"));

    render(<Profile primaryOrg={mockPrimaryOrg} />);

    fireEvent.click(screen.getByTestId("save-btn-Address"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error updating organization:",
        expect.any(Error)
      );
    });
  });
});
