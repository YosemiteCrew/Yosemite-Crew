import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import { useAuthStore } from '@/app/stores/authStore';
import Chat from './Chat';

const APPOINTMENT_ID = 'appt-poppy';
const LEAD_ID = 'vet-weber';
const SESSION_ID = 'session-poppy-1';

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  lead: { id: LEAD_ID, name: 'Dr. Weber' },
  organisationId: 'org-storybook-chat',
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

/** The same visit with nobody assigned to it. `lead` is optional on `Appointment`. */
const UNASSIGNED: Appointment = { ...APPOINTMENT, lead: undefined };

/** POST, for both the mount probe and the create - they share one endpoint. */
const SESSION_ROUTE = `/v1/chat/pms/appointments/${APPOINTMENT_ID}`;
const CLOSE_ROUTE = `/v1/chat/pms/sessions/${SESSION_ID}/close`;

type Reply = { status: number; body: unknown };
/** Never settles - the only way to hold a mid-request frame still. */
const STALL = 'stall';
type Answer = Reply | typeof STALL;

const OPEN_SESSION: Reply = { status: 200, body: { _id: SESSION_ID, status: 'ACTIVE' } };
const CLOSED_SESSION: Reply = { status: 200, body: { _id: SESSION_ID, status: 'CLOSED' } };

type RecordedRequest = { method: string; url: string };

const requests: RecordedRequest[] = [];
const alerts: string[] = [];
const consoleErrors: string[] = [];

const sessionRequests = () => requests.filter((item) => item.url.includes(SESSION_ROUTE));
const closeRequest = () => requests.find((item) => item.url.includes('/close'));

const REAL_OPEN = XMLHttpRequest.prototype.open;
const REAL_SEND = XMLHttpRequest.prototype.send;
const openCalls = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

/** Settle an XHR from canned data without ever touching the network. */
const answer = (request: XMLHttpRequest, url: string, reply: Reply) => {
  const text = JSON.stringify(reply.body);
  setTimeout(() => {
    // `status` / `responseText` / `readyState` are prototype accessors, so an own data
    // property on the instance shadows them and the REAL axios xhr adapter reads a
    // reply nobody sent.
    const settled: Record<string, unknown> = {
      readyState: 4,
      status: reply.status,
      statusText: reply.status === 200 ? 'OK' : 'Error',
      responseText: text,
      response: text,
      responseURL: url,
      getAllResponseHeaders: () => 'content-type: application/json\r\n',
    };
    for (const [key, value] of Object.entries(settled)) {
      Object.defineProperty(request, key, { configurable: true, value });
    }
    request.onloadend?.(new ProgressEvent('loadend'));
  }, 0);
};

/**
 * Every branch of this panel is decided by a chat API call, so nothing here is
 * reviewable without holding those answers still. Axios uses the XHR adapter in a
 * browser, so swapping `open`/`send` on the prototype intercepts all of it while
 * `chatService`, the component and the auth store stay real. `open` still runs, because
 * axios needs the request in the OPENED state for `setRequestHeader` and
 * `withCredentials`; `send` never does, so nothing leaves the page.
 *
 * `sessionAnswers` is a queue because the mount probe and "Open Chat" POST the SAME
 * endpoint - `getChatSession` and `createChatSession` differ only in which of them
 * logs on failure - so the two are told apart by order, not by URL.
 */
const installTransport = (sessionAnswers: Answer[], closeAnswer: Answer) => {
  requests.length = 0;
  const queue = [...sessionAnswers];

  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL
  ) {
    openCalls.set(this, { method: method.toUpperCase(), url: String(url) });
    REAL_OPEN.call(this, method, url, true);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function stubbedSend(this: XMLHttpRequest) {
    const call = openCalls.get(this) ?? { method: 'GET', url: '' };
    requests.push(call);

    let reply: Answer;
    if (call.url.includes('/close')) {
      reply = closeAnswer;
    } else {
      reply = queue.shift() ?? OPEN_SESSION;
    }
    if (reply === STALL) return;
    answer(this, call.url, reply);
  } as typeof XMLHttpRequest.prototype.send;

  return () => {
    XMLHttpRequest.prototype.open = REAL_OPEN;
    XMLHttpRequest.prototype.send = REAL_SEND;
  };
};

type ChatSeed = {
  /** What `attributes.sub` holds. Matching `lead.id` is what unlocks the panel. */
  currentUserId?: string;
  session?: Answer[];
  close?: Answer;
  /**
   * Collect `console.error` instead of letting it through, for the one story whose
   * whole subject is a failed request. Three separate layers log on that path
   * (`logger.error` in the axios wrapper, `logError` in chatService, and the
   * component's own catch), and the story asserts the component's line is among them
   * rather than quietly swallowing the lot.
   */
  captureConsoleErrors?: boolean;
};

const seed =
  ({
    currentUserId = LEAD_ID,
    session = [OPEN_SESSION],
    close = { status: 200, body: {} },
    captureConsoleErrors,
  }: ChatSeed = {}) =>
  () => {
    const authSnapshot = useAuthStore.getState();
    const restoreTransport = installTransport(session, close);

    alerts.length = 0;
    consoleErrors.length = 0;

    // Not a credential: an opaque app user id, the value `attributes.sub` holds.
    useAuthStore.setState({ attributes: { sub: currentUserId } });

    /* `handleCloseChat` finishes on a native `alert()`, which blocks the thread until
       something dismisses it. Recorded rather than shown, so the copy can be asserted
       and the run never depends on the harness's dialog handling. */
    const realAlert = globalThis.alert;
    globalThis.alert = (message?: unknown) => {
      alerts.push(String(message));
    };

    const realConsoleError = console.error;
    if (captureConsoleErrors) {
      console.error = (...args: unknown[]) => {
        consoleErrors.push(args.map((item) => String(item)).join(' '));
      };
    }

    return () => {
      console.error = realConsoleError;
      globalThis.alert = realAlert;
      restoreTransport();
      useAuthStore.setState(authSnapshot);
    };
  };

/** `ModalBase` portals to `document.body`, so the confirm is never inside the canvas. */
const confirmDialog = () =>
  within(document.body).findByRole('dialog', { name: 'Close this chat session?' });

const meta = {
  title: 'Appointments/Tasks/Chat',
  component: Chat,
  parameters: {
    layout: 'fullscreen',
    // `handleOpenChat` finishes with `router.push('/chat?appointmentId=...')`.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The Chat tab of the appointment panel: a short explainer, an Open Chat action and a ' +
          'Close Chat Session action behind a confirm.\n\n' +
          'It has four mutually exclusive bodies and only one of them is the one people picture. ' +
          '`getStatusContent` returns, in order: a **lock-out** when the appointment belongs to ' +
          'someone else, a **"Loading chat status…"** line while the mount probe is in flight, a ' +
          '**closed-session** body offering history only, and finally the active body with both ' +
          'actions. Three of the four render no Open Chat button at all.\n\n' +
          'Ownership is `attributes.sub || attributes.email === lead.id`. That is a **strict ' +
          'equality against one id**, so an appointment with no lead locks everybody out, ' +
          'including the person who booked it, and a practice manager covering for a colleague ' +
          'sees the lock-out rather than the conversation. The lock-out is also the only branch ' +
          'that skips the mount probe entirely - it makes no request, which is the right call and ' +
          'worth keeping.\n\n' +
          'Two rough edges the stories below pin rather than paper over. **The close action stays ' +
          'live while a chat is opening** - only `Open Chat` watches `loading` - so both requests ' +
          'can be in flight at once. And **the error line is the raw exception message**: a 500 ' +
          'from the API reaches the reader as "Failed to create chat session: Request failed with ' +
          'status code 500".',
      },
    },
  },
  tags: ['autodocs'],
  args: { activeAppointment: APPOINTMENT },
  decorators: [
    (Story) => (
      // 446px is the appointment side panel less its padding; the fixed height is what
      // the panel's `flex-1 justify-between` distributes against.
      <div className="flex h-[560px] w-[446px] max-w-full flex-col bg-[var(--screen)] p-3">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof Chat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyAppointment: Story = {
  name: 'My appointment, session open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The probe has to have settled before the active body appears at all.
    const open = await canvas.findByRole('button', { name: 'Open Chat' });
    await expect(open).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Close Chat Session' })).toBeEnabled();
    await expect(canvas.queryByText('Loading chat status…')).not.toBeInTheDocument();

    /* Exactly one probe, scoped to THIS appointment. The effect keys on
       `activeAppointment?.id` and `isMyAppointment`, so a dependency slip would show up
       here as a second identical POST rather than as anything on screen. */
    await expect(sessionRequests()).toHaveLength(1);
    await expect(sessionRequests()[0].method).toBe('POST');

    /* Two actions and no more. The count is the assertion: the closed body and this one
       share the Primary button, and a leak between them would add a third. */
    await expect(canvas.getAllByRole('button')).toHaveLength(2);
    await expect(
      canvas.queryByRole('button', { name: 'View Chat History' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday state for the practitioner the appointment is assigned to. The blue note ' +
          'at the bottom is permanent - it is not a warning that appears when something is about ' +
          'to happen, it is always there.',
      },
    },
  },
};

export const CheckingStatus: Story = {
  name: 'Probing the session (mount)',
  beforeEach: seed({ session: [STALL] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Loading chat status…')).toBeInTheDocument();

    /* Nothing is actionable while the probe runs - the loading line REPLACES the body
       rather than sitting above a disabled copy of it. That is the part worth pinning:
       the panel is empty of controls for the length of one round trip, so a slow API
       reads as a broken tab rather than as a busy one. */
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryByText(/Chat with the companion parent/)).not.toBeInTheDocument();

    // The title stays put, so the panel is identifiable while it resolves.
    await expect(canvas.getByText('Companion Parent Chat')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held open with a request that never answers. In the product it lasts exactly one POST, ' +
          'and it only exists for the practitioner who owns the appointment - the lock-out branch ' +
          'never probes.',
      },
    },
  },
};

export const SessionClosed: Story = {
  name: 'Session already closed',
  beforeEach: seed({ session: [CLOSED_SESSION, OPEN_SESSION] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('This chat session has been closed')).toBeInTheDocument();

    /* One action, and it is a different one. Close is not disabled here, it is GONE -
       which is what makes a second close impossible rather than merely discouraged. */
    const history = canvas.getByRole('button', { name: 'View Chat History' });
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: 'Open Chat' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Close Chat Session' })
    ).not.toBeInTheDocument();

    /* History reuses `handleOpenChat` verbatim, so reading a closed conversation still
       POSTs a create before routing. Asserted because the route is the same one the
       live chat uses - there is no read-only variant - and because the second POST is
       easy to lose in a refactor that "only" changes the closed branch. */
    await userEvent.click(history);
    await waitFor(() => expect(sessionRequests()).toHaveLength(2));
    await expect(getRouter().push).toHaveBeenCalledWith(`/chat?appointmentId=${APPOINTMENT_ID}`);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached by `status: "CLOSED"`, by `status: "ended"`, or by `frozen: true` - three ' +
          'shapes for one condition, because the backend answer has changed shape at least twice. ' +
          'Any of them lands here.',
      },
    },
  },
};

export const OpeningChat: Story = {
  name: 'Opening (request in flight)',
  beforeEach: seed({ session: [OPEN_SESSION, STALL] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'Open Chat' }));

    // The label and the disabled state are one `loading` flag, so they cannot disagree.
    const opening = await canvas.findByRole('button', { name: 'Opening...' });
    await expect(opening).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Open Chat' })).not.toBeInTheDocument();

    /* And the destructive action is still live. `Close Chat Session` is disabled by
       `closingSession`, never by `loading`, so a slow open leaves a window in which the
       session can be closed out from under the navigation that is about to happen.
       Asserted as ENABLED because that is the current contract - if it is ever fixed,
       this line is the one that says so. */
    await expect(canvas.getByRole('button', { name: 'Close Chat Session' })).toBeEnabled();

    // Nothing has navigated: the push happens after the create resolves.
    await expect(getRouter().push).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The frame between pressing Open Chat and the router moving. It is held here by a ' +
          'request that never answers; in the product it is a few hundred milliseconds, which is ' +
          'long enough to press the button beside it.',
      },
    },
  },
};

export const ClosingTheSession: Story = {
  name: 'Close session - declined, then confirmed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'Close Chat Session' }));

    /* The confirm names the consequence for the CLIENT, which is the half a
       practitioner cannot see: closing does not archive a thread, it stops the pet
       parent writing. Read in full because that sentence is the entire safeguard. */
    const dialog = within(await confirmDialog());
    await expect(
      dialog.getByText('The client will no longer be able to send messages in this conversation.')
    ).toBeInTheDocument();

    /* Declining must be a real decline, not a deferral: no request, and the action is
       still available. A confirm that ran the close anyway would look identical up to
       this point. */
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.body.querySelector('dialog[open]')).toBeNull());
    await expect(closeRequest()).toBeUndefined();
    await expect(canvas.getByRole('button', { name: 'Close Chat Session' })).toBeEnabled();

    await userEvent.click(canvas.getByRole('button', { name: 'Close Chat Session' }));
    const reopened = within(await confirmDialog());
    await userEvent.click(reopened.getByRole('button', { name: 'Close session' }));

    /* The close is addressed by SESSION id, not by appointment id, and the id comes
       from the ref the mount probe filled. So a successful close makes exactly one more
       request - no second lookup - and that is only true while the probe keeps
       populating the ref. */
    await waitFor(() => expect(closeRequest()).toBeDefined());
    await expect(closeRequest()?.url).toContain(CLOSE_ROUTE);
    await expect(sessionRequests()).toHaveLength(1);

    // Success is reported by a native alert, over a panel that has already changed.
    await expect(alerts).toEqual(['Chat session closed successfully']);
    await expect(await canvas.findByText('This chat session has been closed')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole destructive path, refused once and then accepted. Worth noting what the ' +
          'success looks like: the body swaps underneath and then a browser `alert()` lands on ' +
          'top of it, which is the one piece of chrome in this panel the design system does not ' +
          'own.',
      },
    },
  },
};

export const OpenChatFailed: Story = {
  name: 'Open failed',
  beforeEach: seed({
    session: [OPEN_SESSION, { status: 500, body: { message: 'chat service unavailable' } }],
    captureConsoleErrors: true,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'Open Chat' }));

    /* The exact string a vet reads when the chat service is down. It is the raw
       exception, assembled by `chatService` from the axios message - no mapping, no
       retry hint, and the API's own `message` field ("chat service unavailable") is
       thrown away in favour of the HTTP status. Asserted verbatim so that any attempt
       to write real copy fails here and gets reviewed. */
    await expect(
      await canvas.findByText('Failed to create chat session: Request failed with status code 500')
    ).toBeInTheDocument();

    // Nothing navigated, and the panel is usable again rather than stuck on "Opening...".
    await expect(getRouter().push).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Open Chat' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Close Chat Session' })).toBeEnabled();

    /* One failure, logged by three layers. The component's own line is asserted rather
       than the count, because the axios wrapper and `chatService` log objects whose
       serialisation is not this component's contract. */
    await expect(consoleErrors.some((line) => line.startsWith('Error opening chat:'))).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only error surface this panel has. It appears above the actions inside the active ' +
          'body, so it is cleared by the next attempt and never seen in the closed or locked-out ' +
          'bodies - a close that fails while the session is already closed has nowhere to report ' +
          'it.',
      },
    },
  },
};

export const NotMyAppointment: Story = {
  name: 'Not my appointment',
  beforeEach: seed({ currentUserId: 'vet-okafor' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('This is not your appointment')).toBeInTheDocument();
    // The lead is named, so the reader knows who to ask rather than only that they are
    // refused.
    await expect(
      canvas.getByText(/This appointment is assigned to Dr\. Weber\./)
    ).toBeInTheDocument();

    /* Nothing to press. Not disabled, not hidden behind a tooltip - the branch returns
       a body with no controls at all, which is the only shape that cannot be defeated
       by a programmatic click. */
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);

    /* And nothing is asked of the API. The status probe returns before its first line
       when the appointment is not the reader's, so another practitioner's session state
       never reaches this browser. That is the assertion to keep if this file is ever
       trimmed. */
    await expect(requests).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The lock-out. It is a client-side check on a single id, so it is a UX guard rather ' +
          'than an authorisation boundary - the endpoints behind Open Chat are reachable without ' +
          'it, and it is the backend that has to refuse them.',
      },
    },
  },
};

export const NobodyAssigned: Story = {
  name: 'Appointment with no lead',
  args: { activeAppointment: UNASSIGNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `lead?.id` is undefined and `currentUserId` is a string, so the equality is false
       for EVERY reader - the practitioner who booked the visit included. An unassigned
       appointment therefore has no reachable chat at all, and says so in the vaguest
       terms the copy allows. */
    await expect(canvas.getByText('This is not your appointment')).toBeInTheDocument();
    await expect(
      canvas.getByText(/This appointment is assigned to another practitioner\./)
    ).toBeInTheDocument();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(requests).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fall-through in the assignment sentence, and the state it describes. Reached by ' +
          'any appointment booked without a practitioner - the panel offers no way forward and no ' +
          'hint that assigning someone is what unlocks it.',
      },
    },
  },
};
