import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ServiceSearchEdit from "@/app/components/Inputs/ServiceSearch/ServiceSearchEdit";
import { createService } from "@/app/services/specialityService";
import { useOrgStore } from "@/app/stores/orgStore";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

// Mock Store
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

// Mock Service
jest.mock("@/app/services/specialityService", () => ({
  createService: jest.fn(),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoSearch: () => <div data-testid="search-icon" />,
}));

// Mock Data Source (specialtiesByKey)
jest.mock("@/app/utils/specialities", () => ({
  specialtiesByKey: {
    "General Medicine": {
      services: ["Checkup", "Consultation", "Vaccination"],
    },
  },
}));

// --- Test Data ---

const mockOrgId = "org-123";

const mockSpeciality: SpecialityWeb = {
  _id: "spec-1",
  name: "General Medicine",
  services: [
    { id: "s1", name: "Vaccination", organisationId: mockOrgId } as any, // Already existing service
  ],
} as SpecialityWeb;

describe("ServiceSearchEdit Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockReturnValue(mockOrgId);
  });

  // --- 1. Rendering & Interaction ---

  it("renders input field correctly", () => {
    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    expect(
      screen.getByPlaceholderText("Search or create service")
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("opens dropdown on focus", () => {
    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    // Initially closed
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    // Focus opens dropdown
    fireEvent.focus(input);
    // Should show "Checkup" and "Consultation" but NOT "Vaccination" (filtered out)
    expect(screen.getByText("Checkup")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.queryByText("Vaccination")).not.toBeInTheDocument();
  });

  it("updates query and filters list on change", () => {
    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    fireEvent.change(input, { target: { value: "Check" } });

    expect(input).toHaveValue("Check");
    expect(screen.getByText("Checkup")).toBeInTheDocument();
    expect(screen.queryByText("Consultation")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ServiceSearchEdit speciality={mockSpeciality} />
      </div>
    );

    // Open
    fireEvent.focus(screen.getByPlaceholderText("Search or create service"));
    expect(screen.getByText("Checkup")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Checkup")).not.toBeInTheDocument();
  });

  it("does not close when clicking inside", () => {
    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    // Open
    fireEvent.focus(input);

    // Click inside (e.g., on the input itself or the icon wrapper)
    fireEvent.mouseDown(input);
    expect(screen.getByText("Checkup")).toBeInTheDocument();
  });

  // --- 2. Selection Logic (Existing Suggestion) ---

  it("calls createService when selecting an existing suggestion", async () => {
    (createService as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    fireEvent.focus(input);
    const option = screen.getByText("Checkup");

    // Click option (it's inside a button)
    fireEvent.click(option.closest("button")!);

    expect(createService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Checkup",
        organisationId: mockOrgId,
        specialityId: "spec-1",
        cost: 10,
        durationMinutes: 15,
      })
    );

    // Verify cleanup
    await waitFor(() => {
      expect(input).toHaveValue("");
      expect(screen.queryByText("Checkup")).not.toBeInTheDocument();
    });
  });

  // --- 3. Creation Logic (New Service) ---

  it("shows 'Add service' button when no suggestions match", () => {
    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    fireEvent.change(input, { target: { value: "Custom Service" } });

    expect(screen.queryByText("Checkup")).not.toBeInTheDocument();
    expect(
      screen.getByText("Add service “Custom Service”")
    ).toBeInTheDocument();
  });

  it("calls createService with formatted name when adding new service", async () => {
    (createService as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    // Type lowercase
    fireEvent.change(input, { target: { value: "custom" } });

    const addButton = screen.getByText("Add service “custom”");
    fireEvent.click(addButton);

    // Expect capitalization logic: charAt(0).toUpperCase() + slice(1)
    expect(createService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Custom",
        organisationId: mockOrgId,
        specialityId: "spec-1",
      })
    );

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("does nothing if trying to add an empty service (defensive check)", async () => {
    // This tests the `if (!name) return;` line inside handleAddService.
    // It's hard to reach via UI because the "Add service" button usually renders only if query exists.
    // However, we can simulate an edge case or verify logic if the button somehow existed.
    // Given the logic: {filtered?.length > 0 ? ... : <button>Add service "{query}"</button>}
    // If filtered is empty and query is empty string (only spaces), the button renders "Add service """.

    render(<ServiceSearchEdit speciality={mockSpeciality} />);

    // Filter list is based on query. If query is empty, it shows full list (filtered returns all).
    // So to trigger "filtered length 0" with "empty name", we need a scenario where everything is filtered out.
    // Let's assume all services are already selected.

    const fullSpec = {
      ...mockSpeciality,
      services: [
        { name: "Checkup" },
        { name: "Consultation" },
        { name: "Vaccination" },
      ] as any,
    };

    render(<ServiceSearchEdit speciality={fullSpec} />);
    // Note: React Testing Library might complain about duplicate key/renders if we don't clean up previous render.
    // But since we are in `it` block, previous render is isolated per test ideally, but let's just create a new test
    // or rely on clean DOM.
    // Actually, RTL appends to body. `cleanup` happens automatically after each test.
    // But here we are rendering twice in one test if we kept the code above.
    // Let's isolate this logic to `handleAddService` via interaction.
  });

  it("handles empty query edge case for Add Service", async () => {
    // Setup: All default services are already selected, so filtered list is empty even with empty query.
    const fullSpec = {
      ...mockSpeciality,
      services: [
        { name: "Checkup" },
        { name: "Consultation" },
        { name: "Vaccination" },
      ] as any,
    };

    // Clean render for this specific scenario
    const { unmount } = render(<ServiceSearchEdit speciality={fullSpec} />);
    const input = screen.getByPlaceholderText("Search or create service");

    fireEvent.focus(input);
    // Filtered list is empty because all are excluded.
    // "Add service" button appears with empty string.

    const addButton = screen.getByText("Add service “”");
    fireEvent.click(addButton);

    // Should NOT call API
    expect(createService).not.toHaveBeenCalled();
    unmount();
  });

  // --- 4. Error Handling ---

  it("handles API error gracefully (console log)", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (createService as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    const input = screen.getByPlaceholderText("Search or create service");

    fireEvent.change(input, { target: { value: "Fail" } });
    fireEvent.click(screen.getByText("Add service “Fail”"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    // Cleanup should still happen in finally block
    expect(input).toHaveValue("");

    consoleSpy.mockRestore();
  });

  it("handles API error during select existing", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (createService as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

    render(<ServiceSearchEdit speciality={mockSpeciality} />);
    fireEvent.focus(screen.getByPlaceholderText("Search or create service"));

    fireEvent.click(screen.getByText("Checkup").closest("button")!);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });
    consoleSpy.mockRestore();
  });
});
