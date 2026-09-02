import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Appointment } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import ChatPanel from './ChatPanel';

const ORG_ID = 'org-storybook-chat-panel';
const APPOINTMENT_ID = 'appt-poppy-chat';
const LEAD_ID = 'vet-weber';
const SESSION_ID = 'session-poppy-1';

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-poppy',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  lead: { id: LEAD_ID, name: 'Dr. Amara Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

type Reply = { status: number; body: unknown };
/** Never settles - the only way to hold the mount probe still. */
const STALL = 'stall';
type Answer = Reply | typeof STALL;

const OPEN_SESSION: Reply = { status: 200, body: { _id: SESSION_ID, status: 'ACTIVE' } };
const CLOSED_SESSION: Reply = { status: 200, body: { _id: SESSION_ID, status: 'CLOSED' } };

/**
 * The panel is `Chat` with the appointment passed through, and `Chat` decides
 * its body from a POST to `/v1/chat/pms/appointments/:id` on mount. The stub is
 * the shared axios instance's adapter - `chatService`, the component and the
 * auth store stay real, and nothing leaves the preview. The answers are a queue
 * because the mount probe and "Open Chat" POST the same endpoint.
 */
const REAL_ADAPTER = api.defaults.adapter;

const withChatApi = (session: Answer[]) => {
  const queue = [...session];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    if (!url.includes('/v1/chat/')) {
      return Promise.reject(new Error(`Unstubbed request in ChatPanel.stories: ${url}`));
    }
    const reply = queue.shift() ?? OPEN_SESSION;
    if (reply === STALL) return new Promise<never>(() => {});
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: 'OK',
      headers: {},
      config,
    };
    return Promise.resolve(response);
  };
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
  };
};

type ChatSeed = {
  /** What `attributes.sub` holds. Matching `lead.id` is what unlocks the panel. */
  currentUserId?: string;
  session?: Answer[];
};

const seed =
  ({ currentUserId = LEAD_ID, session = [OPEN_SESSION] }: ChatSeed = {}) =>
  () => {
    const authSnapshot = useAuthStore.getState();
    const restoreApi = withChatApi(session);
    // Not a credential: an opaque app user id, the value `attributes.sub` holds.
    useAuthStore.setState({ attributes: { sub: currentUserId } });
    return () => {
      restoreApi();
      useAuthStore.setState(authSnapshot);
    };
  };

const meta = {
  title: 'Workspace/ChatPanel',
  component: ChatPanel,
  parameters: {
    layout: 'padded',
    // `handleOpenChat` ends in `router.push('/chat?appointmentId=...')`.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The Chat tab of the workspace quick-actions drawer. It is the appointment ' +
          '`Chat` component handed the workspace appointment, so the drawer and the older ' +
          'appointment side panel show the same surface.\n\n' +
          'Four bodies, decided by a session probe on mount: a lock-out when the appointment ' +
          'belongs to another practitioner, a "Loading chat status…" line while the probe is ' +
          'out, a closed-session body offering history only, and the active body with Open ' +
          'Chat and Close Chat Session. Ownership is a strict equality between ' +
          '`attributes.sub` and `lead.id`, so the lock-out is a client-side guard rather than ' +
          'an authorisation boundary.\n\n' +
          'The interaction detail - opening, closing behind a confirm, the raw error line - is ' +
          'storied under Appointments/Tasks/Chat. These stories draw the panel at the 498px ' +
          'drawer width for each resting body.',
      },
    },
  },
  tags: ['autodocs'],
  args: { appointment: APPOINTMENT },
  decorators: [
    (Story) => (
      <div className="flex h-[560px] w-[498px] max-w-full flex-col bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof ChatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SessionOpen: Story = {
  name: 'My appointment, session open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Companion Parent Chat')).toBeInTheDocument();
    // The probe has to settle before the active body appears at all.
    await expect(await canvas.findByRole('button', { name: 'Open Chat' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Close Chat Session' })).toBeEnabled();
    await expect(canvas.queryByText('Loading chat status…')).not.toBeInTheDocument();
    await expect(canvas.getByText(/Chat with the companion parent/)).toBeInTheDocument();
  },
};

export const Probing: Story = {
  name: 'Probing the session (mount)',
  beforeEach: seed({ session: [STALL] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Loading chat status…')).toBeInTheDocument();
    // The loading line REPLACES the body: no controls at all for one round trip.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};

export const SessionClosed: Story = {
  name: 'Session already closed',
  beforeEach: seed({ session: [CLOSED_SESSION] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('This chat session has been closed')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'View Chat History' })).toBeEnabled();
    // Close is gone, not disabled - a second close is impossible rather than discouraged.
    await expect(
      canvas.queryByRole('button', { name: 'Close Chat Session' })
    ).not.toBeInTheDocument();
  },
};

export const NotMyAppointment: Story = {
  name: 'Assigned to another practitioner',
  beforeEach: seed({ currentUserId: 'vet-okafor' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This is not your appointment')).toBeInTheDocument();
    await expect(
      canvas.getByText(/This appointment is assigned to Dr\. Amara Weber\./)
    ).toBeInTheDocument();
    // Nothing to press: the branch returns a body with no controls at all.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};
