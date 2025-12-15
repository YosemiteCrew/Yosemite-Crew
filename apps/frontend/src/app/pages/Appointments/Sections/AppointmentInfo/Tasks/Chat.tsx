import React, { useState, useEffect } from "react";
import { Appointment } from "@yosemite-crew/types";
import { useRouter } from "next/navigation";
import { createChatSession, closeChatSession, getChatSession } from "@/app/services/chatService";
import { Primary, Secondary } from "@/app/components/Buttons";
import { useAuthStore } from "@/app/stores/authStore";

type ChatProps = {
  activeAppointment: Appointment | null;
};

const Chat = ({ activeAppointment }: ChatProps) => {
  const router = useRouter();
  const { attributes } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingSession, setClosingSession] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check if this appointment belongs to the current user
  const currentUserId = attributes?.sub || attributes?.email;
  const isMyAppointment = activeAppointment?.lead?.id === currentUserId;

  const handleOpenChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment?.id) {
      setError("No appointment selected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create or get chat session
      await createChatSession(activeAppointment.id);

      // Redirect to chat page with appointment ID in the query
      router.push(`/chat?appointmentId=${activeAppointment.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to open chat");
    } finally {
      setLoading(false);
    }
  };

  // Check session status on mount and when appointment changes
  useEffect(() => {
    // Only check status if it's the user's appointment
    if (!isMyAppointment) return;

    let cancelled = false;

    const checkSessionStatus = async () => {
      if (!activeAppointment?.id) return;

      setCheckingStatus(true);
      try {
        // Try to get the session status - this will fail if no session exists yet
        const session = await getChatSession(activeAppointment.id);

        if (!cancelled) {
          // Check if the session is closed (check for CLOSED status or frozen state)
          const isClosed = (session as any).status === 'CLOSED' ||
                          (session as any).status === 'ended' ||
                          (session as any).frozen === true;
          setSessionClosed(isClosed);
        }
      } catch (err) {
        // Session doesn't exist yet or error occurred - that's fine
        if (!cancelled) {
          setSessionClosed(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingStatus(false);
        }
      }
    };

    checkSessionStatus();

    return () => {
      cancelled = true;
    };
  }, [activeAppointment?.id, isMyAppointment]);

  const handleCloseChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment?.id) {
      setError("No appointment selected");
      return;
    }

    // Prevent duplicate calls if already closing or already closed
    if (closingSession || sessionClosed) return;

    if (!confirm("Are you sure you want to close this chat session? The client will no longer be able to send messages.")) {
      return;
    }

    setClosingSession(true);
    setError(null);

    try {
      // Close the chat session
      await closeChatSession(activeAppointment.id);
      setSessionClosed(true);
      alert("Chat session closed successfully");
    } catch (err: any) {
      setError(err.message || "Failed to close chat session");
    } finally {
      setClosingSession(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="font-grotesk font-medium text-black-text text-[23px]">
            Companion Parent Chat
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {!isMyAppointment ? (
            <div className="flex flex-col gap-3">
              <div className="px-4 py-3 rounded-2xl border border-grey-light bg-grey-light">
                <p className="font-satoshi text-[14px] font-medium text-grey-text m-0">
                  This is not your appointment
                </p>
              </div>
              <p className="font-satoshi text-[13px] text-grey-noti">
                You can only access chat sessions for appointments assigned to you. This appointment is assigned to {activeAppointment?.lead?.name || 'another practitioner'}.
              </p>
            </div>
          ) : checkingStatus ? (
            <p className="font-satoshi font-normal text-[14px] text-grey-noti italic">
              Loading chat status...
            </p>
          ) : sessionClosed ? (
            <div className="flex flex-col gap-3">
              <div className="px-4 py-3 rounded-2xl border border-grey-light bg-grey-light">
                <p className="font-satoshi text-[14px] font-medium text-grey-text m-0">
                  This chat session has been closed
                </p>
              </div>
              <p className="font-satoshi text-[13px] text-grey-noti">
                The companion parent can no longer send new messages for this appointment. You can still view the conversation history by opening the chat.
              </p>
              <Primary
                href="#"
                text="View Chat History"
                onClick={handleOpenChat}
                isDisabled={!activeAppointment?.id}
                classname="h-13!"
              />
            </div>
          ) : (
            <>
              <p className="font-satoshi font-normal text-[16px] text-grey-noti">
                Chat with the companion parent about this appointment. Messages are linked to this specific appointment.
              </p>

              {error && (
                <div className="px-4 py-3 rounded-2xl border border-error bg-white">
                  <p className="font-satoshi text-[14px] text-error m-0">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Primary
                  href="#"
                  text={loading ? "Opening..." : "Open Chat"}
                  onClick={handleOpenChat}
                  isDisabled={loading || !activeAppointment?.id}
                  classname="h-13!"
                />

                <Secondary
                  href="#"
                  text={closingSession ? "Closing..." : "Close Chat Session"}
                  onClick={handleCloseChat}
                  isDisabled={closingSession || !activeAppointment?.id}
                  className="h-13!"
                />
              </div>

              <div className="px-3 py-2 rounded-xl bg-blue-light border border-grey-light">
                <p className="font-satoshi text-[13px] text-grey-noti m-0">
                  <span className="font-medium text-blue-text">Note: </span>
                  Closing a chat session will prevent the client from sending new messages. This action should be used when the appointment is complete.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
