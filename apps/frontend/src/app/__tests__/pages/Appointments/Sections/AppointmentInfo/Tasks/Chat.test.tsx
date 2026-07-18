import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
// Import Path: Go up 7 levels to 'src/app', then down to 'pages'
import Chat from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat';
import { useAuthStore } from '@/app/stores/authStore';
import {
  createChatSession,
  closeChatSession,
  getChatSession,
} from '@/app/features/chat/services/chatService';
import { Appointment } from '@yosemite-crew/types';

// --- Mocks ---

// Mock Next.js Router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Auth Store
jest.mock('@/app/stores/authStore');

// Mock Chat Service
jest.mock('@/app/features/chat/services/chatService');

type CapturedButton = {
  text: string;
  isDisabled: boolean;
  onClick: (event: unknown) => void;
};

// The rendered buttons are `disabled` when the component disables them, so
// fireEvent can't reach their handler. Capturing the props lets the tests invoke
// the handler directly to exercise its internal guards.
const mockPrimaryProps: CapturedButton[] = [];
const mockSecondaryProps: CapturedButton[] = [];

// Mock UI Buttons (Pass-through to standard buttons for easier testing)
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => {
    mockPrimaryProps.push({ text, onClick, isDisabled });
    return (
      <button data-testid="primary-btn" onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    );
  },
  Secondary: ({ text, onClick, isDisabled }: any) => {
    mockSecondaryProps.push({ text, onClick, isDisabled });
    return (
      <button data-testid="secondary-btn" onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    );
  },
}));

const lastButton = (captured: CapturedButton[]) => captured[captured.length - 1];
const clickEvent = () => ({ preventDefault: jest.fn() });

describe('Chat Component', () => {
  // --- Test Data ---
  const currentUserId = 'user-123';

  const mockActiveAppointment = {
    id: 'appt-1',
    lead: { id: currentUserId, name: 'Dr. Smith' },
  } as unknown as Appointment;

  const mockOtherAppointment = {
    id: 'appt-2',
    lead: { id: 'other-user', name: 'Dr. Jones' },
  } as unknown as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimaryProps.length = 0;
    mockSecondaryProps.length = 0;

    // Default Auth State
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      attributes: { sub: currentUserId, email: 'test@example.com' },
    });

    // Default Window Mocks
    jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
    jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // --- Section 1: Ownership Logic & Rendering ---

  it("renders 'not your appointment' message if lead ID mismatches", async () => {
    // getChatSession shouldn't be called for others' appointments
    render(<Chat activeAppointment={mockOtherAppointment} />);

    expect(screen.getByText('This is not your appointment')).toBeInTheDocument();
    expect(screen.getByText(/This appointment is assigned to Dr. Jones/)).toBeInTheDocument();
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it('falls back to the email claim when the auth attributes have no sub', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      attributes: { email: 'vet@example.com' },
    });
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });

    const emailLeadAppointment = {
      id: 'appt-1',
      lead: { id: 'vet@example.com', name: 'Dr. Smith' },
    } as unknown as Appointment;

    render(<Chat activeAppointment={emailLeadAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('Open Chat')).toBeInTheDocument();
    });
    expect(getChatSession).toHaveBeenCalledWith('appt-1', { silent: true });
  });

  it("treats the appointment as another user's when no auth attributes are loaded", () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ attributes: undefined });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    expect(screen.getByText('This is not your appointment')).toBeInTheDocument();
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it('names an unnamed lead as "another practitioner"', () => {
    const unnamedLeadAppointment = {
      id: 'appt-3',
      lead: { id: 'other-user' },
    } as unknown as Appointment;

    render(<Chat activeAppointment={unnamedLeadAppointment} />);

    expect(
      screen.getByText(/This appointment is assigned to another practitioner/)
    ).toBeInTheDocument();
  });

  it('names a missing lead as "another practitioner" when there is no appointment', () => {
    render(<Chat activeAppointment={null} />);

    expect(screen.getByText('This is not your appointment')).toBeInTheDocument();
    expect(
      screen.getByText(/This appointment is assigned to another practitioner/)
    ).toBeInTheDocument();
  });

  it('renders the loading state initially for own appointment', async () => {
    // Use a promise that doesn't resolve immediately to catch the loading state
    (getChatSession as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<Chat activeAppointment={mockActiveAppointment} />);

    expect(screen.getByText('Loading chat status…')).toBeInTheDocument();
  });

  // --- Section 2: Initialization (useEffect) ---

  it('renders active chat interface when session exists and is OPEN', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('Companion Parent Chat')).toBeInTheDocument();
    });

    expect(screen.getByText('Open Chat')).toBeInTheDocument();
    expect(screen.getByText('Close Chat Session')).toBeInTheDocument();
    // Verify Note
    expect(screen.getByText(/Closing a chat session will prevent/)).toBeInTheDocument();
  });

  it('renders closed session interface when session is CLOSED', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'CLOSED' });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('This chat session has been closed')).toBeInTheDocument();
    });

    // Should see View History button
    expect(screen.getByText('View Chat History')).toBeInTheDocument();
    // Should NOT see Close button
    expect(screen.queryByText('Close Chat Session')).not.toBeInTheDocument();
  });

  it('renders closed session interface when session is frozen', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({
      status: 'OPEN',
      frozen: true,
    });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('This chat session has been closed')).toBeInTheDocument();
    });
  });

  it("renders closed session interface when the session status is 'ended'", async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ id: 'session-ended', status: 'ended' });

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('This chat session has been closed')).toBeInTheDocument();
    });
  });

  it('handles 404 (No session yet) by showing active interface', async () => {
    // Simulate axios/fetch 404 error structure
    const error404 = { response: { status: 404 } };
    (getChatSession as jest.Mock).mockRejectedValue(error404);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('Open Chat')).toBeInTheDocument();
    });
    // Session closed should be false
    expect(screen.queryByText('This chat session has been closed')).not.toBeInTheDocument();
  });

  it("handles 'not found' message in error object", async () => {
    // Simulate error message check
    const errorMsg = { message: 'Session not found' };
    (getChatSession as jest.Mock).mockRejectedValue(errorMsg);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('Open Chat')).toBeInTheDocument();
    });
  });

  it('treats any status-check failure as "no session yet" without logging', async () => {
    // The backend errors (e.g. 500) when no session exists yet. The mount probe
    // is silent and treats every failure as the benign "not started" state.
    const errorUnexpected = { message: 'Server exploded' };
    (getChatSession as jest.Mock).mockRejectedValue(errorUnexpected);

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => {
      expect(screen.getByText('Open Chat')).toBeInTheDocument();
    });
    expect(screen.queryByText('This chat session has been closed')).not.toBeInTheDocument();
    // No error is logged for the expected first-visit/no-session case.
    expect(console.error).not.toHaveBeenCalledWith(
      'Unexpected error checking chat session status:',
      errorUnexpected
    );
    // The probe is called silently.
    expect(getChatSession).toHaveBeenCalledWith('appt-1', { silent: true });
  });

  // --- Section 3: Open Chat Interaction ---

  it('handles opening chat successfully', async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 }); // Initial state
    (createChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => expect(screen.getByText('Open Chat')).toBeInTheDocument());

    const openBtn = screen.getByText('Open Chat');
    fireEvent.click(openBtn);

    // Verify loading text changes
    expect(screen.getByText('Opening...')).toBeInTheDocument();

    await waitFor(() => {
      expect(createChatSession).toHaveBeenCalledWith('appt-1');
    });
    expect(mockPush).toHaveBeenCalledWith('/chat?appointmentId=appt-1');
  });

  it('handles opening chat history (closed session)', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ status: 'CLOSED' });
    (createChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);

    await waitFor(() => expect(screen.getByText('View Chat History')).toBeInTheDocument());

    const viewBtn = screen.getByText('View Chat History');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(createChatSession).toHaveBeenCalledWith('appt-1');
    });
    expect(mockPush).toHaveBeenCalledWith('/chat?appointmentId=appt-1');
  });

  it('handles error when opening chat fails', async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (createChatSession as jest.Mock).mockRejectedValue(new Error('Network Error'));

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Open Chat')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Open Chat'));

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('caches the created session id when opening chat', async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (createChatSession as jest.Mock).mockResolvedValue({ _id: 'created-session' });
    (closeChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Open Chat')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Open Chat'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/chat?appointmentId=appt-1'));

    // The cached id is reused on close — no second lookup is needed.
    (getChatSession as jest.Mock).mockClear();
    fireEvent.click(screen.getByText('Close Chat Session'));

    await waitFor(() => expect(closeChatSession).toHaveBeenCalledWith('created-session'));
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when opening chat fails without a message', async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (createChatSession as jest.Mock).mockRejectedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Open Chat')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Open Chat'));

    await waitFor(() => {
      expect(screen.getByText('Failed to open chat')).toBeInTheDocument();
    });
  });

  it('handles missing appointment ID when opening chat', async () => {
    // Edge case: Appointment object exists but ID is null
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    // We force the 'My Appointment' check to pass by mocking Auth store to match
    // However, the button is disabled if !id.
    // We can try to force click or check disabled state.
    const openBtn = screen.getByText('Open Chat');
    expect(openBtn).toBeDisabled();

    // If we somehow clicked it (e.g. race condition), it should handle it
    fireEvent.click(openBtn);
    expect(createChatSession).not.toHaveBeenCalled();
  });

  it('surfaces "No appointment selected" when the open handler runs without an id', async () => {
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    // The button is disabled, so invoke the handler directly to reach its guard.
    await act(async () => {
      lastButton(mockPrimaryProps).onClick(clickEvent());
    });

    expect(screen.getByText('No appointment selected')).toBeInTheDocument();
    expect(createChatSession).not.toHaveBeenCalled();
  });

  // --- Section 4: Close Chat Interaction ---

  it('cancels closing chat if user denies confirmation', async () => {
    (getChatSession as jest.Mock).mockRejectedValue({ status: 404 });
    (globalThis.confirm as jest.Mock).mockReturnValue(false); // User clicks Cancel

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));

    expect(closeChatSession).not.toHaveBeenCalled();
  });

  it('closes chat successfully when confirmed', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });
    (globalThis.confirm as jest.Mock).mockReturnValue(true); // User clicks OK
    (closeChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    const closeBtn = screen.getByText('Close Chat Session');
    fireEvent.click(closeBtn);

    // Check loading state
    expect(screen.getByText('Closing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(closeChatSession).toHaveBeenCalledWith('session-1');
    });

    expect(globalThis.alert).toHaveBeenCalledWith('Chat session closed successfully');

    // UI should update to closed state
    await waitFor(() => {
      expect(screen.getByText('This chat session has been closed')).toBeInTheDocument();
    });
  });

  it('looks the session id up when closing a chat with no cached session', async () => {
    (getChatSession as jest.Mock)
      // Mount probe: no session cached yet.
      .mockRejectedValueOnce({ status: 404 })
      // Close lookup: the backend answers with an `id` rather than an `_id`.
      .mockResolvedValueOnce({ id: 'session-lazy' });
    (closeChatSession as jest.Mock).mockResolvedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));

    await waitFor(() => expect(closeChatSession).toHaveBeenCalledWith('session-lazy'));
    // The close lookup is not silent — the user acted, so failures must surface.
    expect(getChatSession).toHaveBeenLastCalledWith('appt-1');
  });

  it('errors when no chat session can be resolved for the appointment', async () => {
    (getChatSession as jest.Mock)
      .mockRejectedValueOnce({ status: 404 })
      // Close lookup resolves, but carries neither `_id` nor `id`.
      .mockResolvedValueOnce({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));

    await waitFor(() => {
      expect(screen.getByText('No chat session found for this appointment')).toBeInTheDocument();
    });
    expect(closeChatSession).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when closing chat fails without a message', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });
    (closeChatSession as jest.Mock).mockRejectedValue({});

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));

    await waitFor(() => {
      expect(screen.getByText('Failed to close chat session')).toBeInTheDocument();
    });
  });

  it('ignores a close request that arrives while a close is already in flight', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });

    let resolveClose: (value?: unknown) => void = () => {};
    (closeChatSession as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClose = resolve;
        })
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));
    expect(closeChatSession).toHaveBeenCalledTimes(1);

    // The button is disabled while the close is in flight, so invoke the handler
    // directly to exercise the in-flight guard.
    await act(async () => {
      lastButton(mockSecondaryProps).onClick(clickEvent());
    });
    expect(closeChatSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClose({});
    });
    expect(screen.getByText('This chat session has been closed')).toBeInTheDocument();
  });

  it('surfaces "No appointment selected" when the close handler runs without an id', async () => {
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    await act(async () => {
      lastButton(mockSecondaryProps).onClick(clickEvent());
    });

    expect(screen.getByText('No appointment selected')).toBeInTheDocument();
    expect(closeChatSession).not.toHaveBeenCalled();
  });

  it('handles error when closing chat fails', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });
    (closeChatSession as jest.Mock).mockRejectedValue(new Error('Close Failed'));

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close Chat Session'));

    await waitFor(() => {
      expect(screen.getByText('Close Failed')).toBeInTheDocument();
    });
  });

  it('prevents duplicate close calls if already closing', async () => {
    (getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-1', status: 'OPEN' });

    // Create a promise that we control to hold the "closing" state
    let resolveClose: any;
    (closeChatSession as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClose = resolve;
        })
    );

    render(<Chat activeAppointment={mockActiveAppointment} />);
    await waitFor(() => expect(screen.getByText('Close Chat Session')).toBeInTheDocument());

    const closeBtn = screen.getByText('Close Chat Session');

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

  it('handles missing appointment ID when closing chat', async () => {
    const noIdAppt = { ...mockActiveAppointment, id: null } as any;
    render(<Chat activeAppointment={noIdAppt} />);

    const closeBtn = screen.getByText('Close Chat Session');
    expect(closeBtn).toBeDisabled();

    fireEvent.click(closeBtn);
  });

  // --- Section 5: Effect Cleanup ---

  it('unmounts safely while checking status', async () => {
    // Make request hang
    (getChatSession as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { unmount } = render(<Chat activeAppointment={mockActiveAppointment} />);

    // Unmount before promise resolves
    unmount();

    // This mostly ensures no "Can't perform a React state update on an unmounted component" console errors,
    // which jest would catch if strict modes were active or console.error wasn't mocked.
  });
});
