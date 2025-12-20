import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import Chat from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Tasks/Chat";
import { useAuthStore } from "@/app/stores/authStore";
import {
  createChatSession,
  closeChatSession,
  getChatSession,
} from "@/app/services/chatService";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Next.js Router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Auth Store
jest.mock("@/app/stores/authStore");

// Mock Chat Service
jest.mock("@/app/services/chatService");

// Mock UI Buttons (Pass-through to standard buttons for easier testing)
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button data-testid="primary-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button data-testid="secondary-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

describe("Chat Component", () => {
  // --- Test Data ---
  const currentUserId = "user-123";

  const mockActiveAppointment = {
    id: "appt-1",
    lead: { id: currentUserId, name: "Dr. Smith" },
  } as unknown as Appointment;

  const mockOtherAppointment = {
    id: "appt-2",
    lead: { id: "other-user", name: "Dr. Jones" },
  } as unknown as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Auth State
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      attributes: { sub: currentUserId, email: "test@example.com" },
    });

    // Default Window Mocks
    jest.spyOn(globalThis, "confirm").mockReturnValue(true);
    jest.spyOn(globalThis, "alert").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  // --- Section 1: Ownership Logic & Rendering ---

  it("renders 'not your appointment' message if lead ID mismatches", async () => {
    // getChatSession shouldn't be called for others' appointments
    render(<Chat activeAppointment={mockOtherAppointment} />);

    expect(
      screen.getByText("This is not your appointment")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This appointment is assigned to Dr. Jones/)
    ).toBeInTheDocument();
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it("renders the loading state initially for own appointment", async () => {
    // Use a promise that doesn't resolve immediately to catch the loading state
    (getChatSession as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);

    expect(screen.getByText("Loading chat status...")).toBeInTheDocument();
  });

  // --- Section 2: Initialization (useEffect) ---

  it("renders active chat interface when session exists and is OPEN", async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ status: "OPEN" });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText("Companion Parent Chat")).toBeInTheDocument();
    });

    expect(screen.getByText("Open Chat")).toBeInTheDocument();
    expect(screen.getByText("Close Chat Session")).toBeInTheDocument();
    // Verify Note
    expect(
      screen.getByText(/Closing a chat session will prevent/)
    ).toBeInTheDocument();
  });

  it("renders closed session interface when session is CLOSED", async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ status: "CLOSED" });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(
        screen.getByText("This chat session has been closed")
      ).toBeInTheDocument();
    });

    // Should see View History button
    expect(screen.getByText("View Chat History")).toBeInTheDocument();
    // Should NOT see Close button
    expect(screen.queryByText("Close Chat Session")).not.toBeInTheDocument();
  });

  it("renders closed session interface when session is frozen", async () => {
    (getChatSession as jest.Mock).mockResolvedValue({
      status: "OPEN",
      frozen: true,
    });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(
        screen.getByText("This chat session has been closed")
      ).toBeInTheDocument();
    });
  });

  it("handles 404 (No session yet) by showing active interface", async () => {
    // Simulate axios/fetch 404 error structure
    const error404 = { response: { status: 404 } };
    (getChatSession as jest.Mock).mockRejectedValue(error404);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText("Open Chat")).toBeInTheDocument();
    });
    // Session closed should be false
    expect(
      screen.queryByText("This chat session has been closed")
    ).not.toBeInTheDocument();
  });

  it("handles 'not found' message in error object", async () => {
    // Simulate error message check
    const errorMsg = { message: "Session not found" };
    (getChatSession as jest.Mock).mockRejectedValue(errorMsg);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText("Open Chat")).toBeInTheDocument();
    });
  });

  it("handles unexpected errors during status check gracefully", async () => {
    const errorUnexpected = { message: "Server exploded" };
    (getChatSession as jest.Mock).mockRejectedValue(errorUnexpected);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    // It defaults to open state (sessionClosed = false) on unexpected error
    await waitFor(() => {
      expect(screen.getByText("Open Chat")).toBeInTheDocument();
    });
    expect(console.error).toHaveBeenCalledWith(
      "Unexpected error checking chat session status:",
      errorUnexpected
    );
  });

  // --- Section 3: Open Chat Interaction ---

  it("handles opening chat successfully", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 }); // Initial state
    (createChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() =>
      expect(screen.getByText("Open Chat")).toBeInTheDocument()
    );

    const openBtn = screen.getByText("Open Chat");
    fireEvent.click(openBtn);

    // Verify loading text changes
    expect(screen.getByText("Opening...")).toBeInTheDocument();

    await waitFor(() => {
      expect(createChatSession).toHaveBeenCalledWith("appt-1");
    });
    expect(mockPush).toHaveBeenCalledWith("/chat?appointmentId=appt-1");
  });

  it("handles opening chat history (closed session)", async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ status: "CLOSED" });
    (createChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() =>
      expect(screen.getByText("View Chat History")).toBeInTheDocument()
    );

    const viewBtn = screen.getByText("View Chat History");
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(createChatSession).toHaveBeenCalledWith("appt-1");
    });
    expect(mockPush).toHaveBeenCalledWith("/chat?appointmentId=appt-1");
  });

  it("handles error when opening chat fails", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (createChatSession as jest.Mock).mockRejectedValue(
      new Error("Network Error")
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() =>
      expect(screen.getByText("Open Chat")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Open Chat"));

    await waitFor(() => {
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles missing appointment ID when opening chat", async () => {
    // Edge case: Appointment object exists but ID is null
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    // We force the 'My Appointment' check to pass by mocking Auth store to match
    // However, the button is disabled if !id.
    // We can try to force click or check disabled state.
    const openBtn = screen.getByText("Open Chat");
    expect(openBtn).toBeDisabled();

    // If we somehow clicked it (e.g. race condition), it should handle it
    fireEvent.click(openBtn);
  });

  // --- Section 4: Close Chat Interaction ---

  it("cancels closing chat if user denies confirmation", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (globalThis.confirm as jest.Mock).mockReturnValue(false); // User clicks Cancel

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() =>
      expect(screen.getByText("Close Chat Session")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Close Chat Session"));

    expect(closeChatSession).not.toHaveBeenCalled();
  });

  it("closes chat successfully when confirmed", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (globalThis.confirm as jest.Mock).mockReturnValue(true); // User clicks OK
    (closeChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() =>
      expect(screen.getByText("Close Chat Session")).toBeInTheDocument()
    );

    const closeBtn = screen.getByText("Close Chat Session");
    fireEvent.click(closeBtn);

    // Check loading state
    expect(screen.getByText("Closing...")).toBeInTheDocument();

    await waitFor(() => {
      expect(closeChatSession).toHaveBeenCalledWith("appt-1");
    });

    expect(globalThis.alert).toHaveBeenCalledWith(
      "Chat session closed successfully"
    );

    // UI should update to closed state
    await waitFor(() => {
      expect(
        screen.getByText("This chat session has been closed")
      ).toBeInTheDocument();
    });
  });

  it("handles error when closing chat fails", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (closeChatSession as jest.Mock).mockRejectedValue(
      new Error("Close Failed")
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() =>
      expect(screen.getByText("Close Chat Session")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Close Chat Session"));

    await waitFor(() => {
      expect(screen.getByText("Close Failed")).toBeInTheDocument();
    });
  });

  it("prevents duplicate close calls if already closing", async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });

    // Create a promise that we control to hold the "closing" state
    let resolveClose: any;
    (closeChatSession as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClose = resolve;
        })
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() =>
      expect(screen.getByText("Close Chat Session")).toBeInTheDocument()
    );

    const closeBtn = screen.getByText("Close Chat Session");

    // First Click
    fireEvent.click(closeBtn);
    expect(closeChatSession).toHaveBeenCalledTimes(1);

    // Second Click (while loading)
    fireEvent.click(closeBtn);
    expect(closeChatSession).toHaveBeenCalledTimes(1); // Should still be 1

    // Clean up promise
    await waitFor(() => {
      resolveClose({});
    });
  });

  it("handles missing appointment ID when closing chat", async () => {
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    const closeBtn = screen.getByText("Close Chat Session");
    expect(closeBtn).toBeDisabled();

    fireEvent.click(closeBtn);
  });

  // --- Section 5: Effect Cleanup ---

  it("unmounts safely while checking status", async () => {
    // Make request hang
    (getChatSession as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    const { unmount } = render(
      <Chat activeAppointment={mockActiveAppointment} />
    );

    // Unmount before promise resolves
    unmount();

    // This mostly ensures no "Can't perform a React state update on an unmounted component" console errors,
    // which jest would catch if strict modes were active or console.error wasn't mocked.
  });
});
