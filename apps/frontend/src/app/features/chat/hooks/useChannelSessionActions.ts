'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Appointment } from '@yosemite-crew/types';
import type { Channel as StreamChannel } from 'stream-chat';
import { useRouter } from 'next/navigation';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { getChatSession } from '@/app/features/chat/services/chatService';
import { endChatChannel } from '@/app/features/chat/services/streamChatService';
import { buildWorkspaceHref } from '@/app/lib/appointmentWorkspace';
import { useNotify } from '@/app/hooks/useNotify';
import type { ConfirmOptions } from '@/app/ui/overlays/Modal/ConfirmModal';

type UseChannelSessionActionsArgs = {
  channel: StreamChannel | null | undefined;
  appointment: Appointment | undefined;
  appointmentId?: string;
  backendStatus?: 'active' | 'ended';
  refreshStatuses: () => void;
  /**
   * Confirmation for closing a client's session. Supplied by the consumer so a
   * single dialog instance serves the whole chat surface.
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export type ChannelSessionActions = {
  sessionClosed: boolean;
  closingSession: boolean;
  completingAppointment: boolean;
  rescheduleOpen: boolean;
  setRescheduleOpen: Dispatch<SetStateAction<boolean>>;
  followUpOpen: boolean;
  setFollowUpOpen: Dispatch<SetStateAction<boolean>>;
  handleCloseSession: () => Promise<void>;
  handleApptAction: (action: string) => void;
};

/**
 * Session lifecycle behind the chat thread header: ending the client chat
 * session, and the appointment actions (reschedule / send form / mark complete /
 * book follow-up) offered alongside it.
 */
export const useChannelSessionActions = ({
  channel,
  appointment,
  appointmentId,
  backendStatus,
  refreshStatuses,
  confirm,
}: UseChannelSessionActionsArgs): ChannelSessionActions => {
  const { notify } = useNotify();
  const router = useRouter();
  const [closingSession, setClosingSession] = useState(false);
  const [locallyClosed, setLocallyClosed] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [completingAppointment, setCompletingAppointment] = useState(false);

  // The session is closed when the channel or backend reports it ended/frozen,
  // or when we just closed it locally (optimistic UI). Derived during render so
  // it always tracks its source instead of being mirrored into state via an
  // effect (react-doctor/no-derived-state).
  const sessionClosed =
    (channel?.data as any)?.status === 'ended' ||
    (channel?.data as any)?.frozen === true ||
    backendStatus === 'ended' ||
    locallyClosed;

  const handleCloseSession = async () => {
    if (!channel) {
      /* v8 ignore next -- unreachable: the Close session button renders only when `isClientChat` is true, and deriveHeaderChannelInfo resolves the scope to 'colleagues' (never 'clients') when `channel` is null */
      return;
    }

    // Prevent duplicate calls if already closing or already closed
    if (closingSession || sessionClosed) {
      /* v8 ignore next -- unreachable: the button carries `isDisabled={closingSession}` (BaseButton renders a real `disabled` attribute) and is swapped for the "Session closed" badge once `sessionClosed`, so it can never be clicked in either state */
      return;
    }

    const confirmed = await confirm({
      title: 'Close this chat session?',
      body: 'The client will no longer be able to send messages in this conversation.',
      confirmLabel: 'Close session',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setClosingSession(true);
    try {
      const appointmentId = (channel.data as any)?.appointmentId;
      if (appointmentId) {
        const session = await getChatSession(appointmentId);
        const sessionId = (session as any)?._id || (session as any)?.id;
        if (!sessionId) {
          throw new Error('Chat session not found for this appointment');
        }
        await endChatChannel(sessionId);
        refreshStatuses();
        setLocallyClosed(true);
        notify('success', {
          title: 'Chat session closed',
          text: 'Chat session closed successfully',
        });
      }
    } catch (error) {
      console.error('Failed to close chat session:', error);
      notify('error', {
        title: 'Couldn’t close chat session',
        text: 'Please try again.',
      });
    } finally {
      setClosingSession(false);
    }
  };

  const handleAppointmentComplete = async () => {
    if (!appointment || completingAppointment) {
      /* v8 ignore next -- unreachable: ChatHeaderContext renders "Mark complete" only inside its `{appointment && …}` block and drops the action entirely while `completing` is true, so neither guard can fire */
      return;
    }
    setCompletingAppointment(true);
    try {
      await changeAppointmentStatus(appointment, 'COMPLETED');
      notify('success', {
        title: 'Appointment completed',
        text: 'The visit has been marked complete.',
      });
    } catch (error) {
      notify('error', {
        title: 'Unable to complete',
        text: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setCompletingAppointment(false);
    }
  };

  const handleApptAction = (action: string) => {
    /* v8 ignore start -- unreachable: ChatHeaderContext renders the action buttons only when `appointment` (and therefore `appointmentId`) is defined, so this guard never fires */
    if (!appointmentId) {
      router.push('/appointments');
      return;
    }
    /* v8 ignore stop */
    if (action === 'Reschedule') {
      /* v8 ignore start -- unreachable: the Reschedule button only renders inside ChatHeaderContext's `{appointment && …}` block, so `appointment` is always truthy here and this fallback is dead */
      if (!appointment) {
        router.push(buildWorkspaceHref(appointmentId));
        return;
      }
      /* v8 ignore stop */
      setRescheduleOpen(true);
      return;
    }
    if (action === 'Send form') {
      router.push(buildWorkspaceHref(appointmentId, 'INVOICE'));
      return;
    }
    if (action === 'Mark complete') {
      void handleAppointmentComplete();
      return;
    }
    /* v8 ignore start -- unreachable: onAction only ever receives one of the four APPT_ACTIONS ('Reschedule', 'Send form', 'Mark complete', 'Book follow-up') and the first three already returned above, so this exhaustiveness fallback is dead */
    if (action !== 'Book follow-up') {
      router.push(buildWorkspaceHref(appointmentId));
      return;
    }
    /* v8 ignore stop */
    if (appointment?.companion?.id || appointment?.patient?.id) {
      setFollowUpOpen(true);
      return;
    }
    router.push('/appointments');
  };

  return {
    sessionClosed,
    closingSession,
    completingAppointment,
    rescheduleOpen,
    setRescheduleOpen,
    followUpOpen,
    setFollowUpOpen,
    handleCloseSession,
    handleApptAction,
  };
};

export default useChannelSessionActions;
