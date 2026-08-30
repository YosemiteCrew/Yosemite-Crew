import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import ParentTask from './ParentTask';

const ORG_ID = 'org-storybook-parent-task';

/** A vet membership. `tasks:edit:any` is what gets past the `PermissionGate`. */
const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const visit = (over: Partial<Appointment>): Appointment => ({
  id: 'appt-poppy',
  patient: {
    id: 'companion-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  ...over,
});

/** The everyday record: `companion` is populated, so `patient` is never consulted. */
const POPPY = visit({
  companion: {
    id: 'companion-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
});

/**
 * The same shape with `companion` absent. `getAppointmentCompanion` is
 * `appointment.companion ?? appointment.patient`, and older records only carry
 * `patient` - so this is the fallback leg, and the ids it seeds differ from
 * Poppy's, which is what makes the re-seed below provable.
 */
const MILO = visit({
  id: 'appt-milo',
  patient: {
    id: 'companion-milo',
    name: 'Milo',
    species: 'cat',
    breed: 'Ragdoll',
    parent: { id: 'parent-tomas', name: 'Tomas Neary' },
  },
});

type RecordedRequest = { method: string; url: string; body: Record<string, unknown> };

/** Every request the stories let through, in order. Cleared by `seed`. */
const requests: RecordedRequest[] = [];

const CREATE_TASK_ROUTE = '/v1/task/pms/custom';

const createdTask = () =>
  requests.find((item) => item.method === 'POST' && item.url.includes(CREATE_TASK_ROUTE));

const REAL_OPEN = XMLHttpRequest.prototype.open;
const REAL_SEND = XMLHttpRequest.prototype.send;
const openCalls = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

/** Settle an XHR from canned data without ever touching the network. */
const answer = (request: XMLHttpRequest, url: string, payload: unknown) => {
  const text = JSON.stringify(payload);
  setTimeout(() => {
    // `status` / `responseText` / `readyState` are prototype accessors, so an own
    // data property on the instance shadows them - which is the whole trick that
    // lets the REAL axios xhr adapter read a reply nobody sent.
    const settled: Record<string, unknown> = {
      readyState: 4,
      status: 200,
      statusText: 'OK',
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
 * `useTaskForm` loads the org templates AND the YC library on mount, and `handleCreate`
 * POSTs the task. Left alone every story here would fire real requests out of the
 * preview iframe, and each rejection is logged with `console.error` by both
 * `taskService` and the axios wrapper - so an unstubbed story is noisy as well as
 * online.
 *
 * Axios uses the XHR adapter in a browser, so replacing `open`/`send` on the prototype
 * intercepts all of it while leaving the service modules, the hook and the stores
 * completely real. `open` still runs so the instance is in the OPENED state axios
 * needs for `setRequestHeader` and `withCredentials`; `send` never does, so nothing
 * leaves the page.
 *
 * The recorded POST body is the point: `companionId` and `assignedTo` are seeded by
 * this component and rendered NOWHERE, so the payload is the only place the seeding is
 * observable.
 */
const installTransport = () => {
  requests.length = 0;

  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL
  ) {
    openCalls.set(this, { method: method.toUpperCase(), url: String(url) });
    REAL_OPEN.call(this, method, url, true);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function stubbedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const call = openCalls.get(this) ?? { method: 'GET', url: '' };
    const parsed: Record<string, unknown> =
      typeof body === 'string' && body ? JSON.parse(body) : {};
    requests.push({ method: call.method, url: call.url, body: parsed });

    // The template lists answer empty, which is the state the panel opens in for an
    // org that has never saved one. The create answers with a task carrying an id and
    // an org, because `upsertTask` console.warns on either being missing.
    const reply = call.url.includes(CREATE_TASK_ROUTE)
      ? { ...parsed, _id: 'task-created', organisationId: ORG_ID }
      : [];
    answer(this, call.url, reply);
  } as typeof XMLHttpRequest.prototype.send;

  return () => {
    XMLHttpRequest.prototype.open = REAL_OPEN;
    XMLHttpRequest.prototype.send = REAL_SEND;
  };
};

const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const taskSnapshot = useTaskStore.getState();
  const restoreTransport = installTransport();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });

  return () => {
    restoreTransport();
    useTaskStore.setState(taskSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

type ParentTaskProps = ComponentProps<typeof ParentTask>;

/** 446px is the appointment side panel less its padding, which is where this lives. */
const Panel = (args: ParentTaskProps) => (
  <div className="flex min-h-[640px] w-[446px] max-w-full flex-col bg-[var(--screen)] p-3">
    <ParentTask {...args} />
  </div>
);

/**
 * The panel keeps one mounted `ParentTask` and swaps the appointment under it, which
 * is exactly what the appointment modal does when the reader picks a different visit.
 * Hoisted out of `render` because a hook inside a story's render function trips
 * `react-hooks/rules-of-hooks`.
 */
const SwitchablePanel = (args: ParentTaskProps) => {
  const [appointment, setAppointment] = useState<Appointment>(args.activeAppointment);
  return (
    <div className="flex min-h-[640px] w-[446px] max-w-full flex-col gap-3 bg-[var(--screen)] p-3">
      <button
        type="button"
        className="self-start rounded-full border border-[var(--divider)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-body)]"
        onClick={() => setAppointment(MILO)}
      >
        Open Milo instead
      </button>
      <ParentTask {...args} activeAppointment={appointment} />
    </div>
  );
};

const meta = {
  title: 'Appointments/Tasks/ParentTask',
  component: ParentTask,
  parameters: {
    layout: 'fullscreen',
    // `PermissionGate`'s denial fallback renders a "Request access" route with
    // next/navigation's useRouter.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The "task for the companion parent" tab of the appointment panel. It is fifteen lines ' +
          "of wiring around the shared `TaskFormBody`: it resolves the appointment's companion " +
          '(`companion ?? patient`), seeds `useTaskForm` with `companionId` and an `assignedTo` ' +
          "of the companion's PARENT, and re-runs `resetForm` whenever the appointment " +
          'changes.\n\n' +
          'Every one of those decisions is invisible on screen. `ParentTask` does not pass ' +
          '`showAssigneeSelect`, so there is no assignee field; `companionId` has no field ' +
          'either. The rendered form is identical to an employee task with the dropdown removed ' +
          '- the only place the seeding surfaces is the payload of the POST it eventually makes, ' +
          'which is why the stories below read the recorded request body rather than the DOM.\n\n' +
          'Two consequences worth knowing before touching this file. **Switching appointment ' +
          'discards whatever was typed**: the effect calls `resetForm` on every change of ' +
          '`activeAppointment`, with no dirty check and no prompt. And **the validator has an ' +
          'error with nowhere to render**: `validateTaskForm` sets `assignedTo` ("Please select ' +
          'a valid companion") when a PARENT_TASK has no `companionId`, but the field that shows ' +
          'that error is the assignee dropdown this component never renders - so a companion ' +
          'with no id would give a Save button that silently does nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: { activeAppointment: POPPY },
  render: (args) => <Panel {...args} />,
  beforeEach: seed,
} satisfies Meta<typeof ParentTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeededForCompanion: Story = {
  name: 'Freshly seeded for a companion',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The form mounts empty and open. Nothing here is prefilled from the appointment
    // except the two invisible ids.
    await expect(canvas.getByRole('button', { name: 'Task' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue('');

    /* No assignee control, by design: a parent task is addressed to the companion's
       parent and the reader is given no way to redirect it. Checked as an absence
       because it is one prop (`showAssigneeSelect`) away from appearing, and if it did
       appear it would open on an empty selection while `formData.assignedTo` already
       held the parent - a control disagreeing with the value it is meant to show. */
    await expect(canvas.queryByText('Assigned to')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Assigned to/ })).not.toBeInTheDocument();

    /* Mounting must not write. The `resetForm` effect fires on first render as well as
       on every appointment change, so a version of it that reached for the create
       service instead of the reset would still LOOK correct - this is the assertion
       that would catch it. */
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await expect(requests.every((item) => item.method === 'GET')).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the reader gets when the Task tab opens on a companion: the shared form with no ' +
          'assignee row, everything blank, due date defaulted to today.',
      },
    },
  },
};

export const SavesTheCompanionAndParent: Story = {
  name: 'Save carries the companion and its parent',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Task' }),
      'Give 2ml Metacam with food'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* The only proof that the seeding happened. `companionId` is the companion,
       `assignedTo` is the companion's PARENT - not the companion, and not the vet on
       the appointment - and `audience` is PARENT_TASK because the hook was asked for
       `isCompanionTask`. Swapping companion for parent here is a one-character change
       that nothing on screen would reveal. */
    await waitFor(() => expect(createdTask()).toBeDefined());
    const payload = createdTask()?.body ?? {};
    await expect(payload.audience).toBe('PARENT_TASK');
    await expect(payload.companionId).toBe('companion-poppy');
    await expect(payload.assignedTo).toBe('parent-lena');
    await expect(payload.name).toBe('Give 2ml Metacam with food');
    // `createTask` stamps the active org on the payload, so a task created from this
    // panel is scoped even though the form never asks for an organisation.
    await expect(payload.organisationId).toBe(ORG_ID);

    // A successful create resets the form rather than leaving the text sitting there,
    // so a second Save cannot repeat the task by accident.
    await waitFor(() => expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(''));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The write, read off the wire. The panel gives the reader no control over who the task ' +
          "is assigned to, so if this payload is wrong the task lands in a stranger's app with " +
          'no visible symptom on the clinic side.',
      },
    },
  },
};

export const ReseedsOnAppointmentChange: Story = {
  name: 'Re-seeds when the appointment changes',
  render: (args) => <SwitchablePanel {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Task' }),
      'Draft that will not survive'
    );
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Draft that will not survive'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Open Milo instead' }));

    /* Unsaved input is gone. `resetForm` runs on every change of `activeAppointment`
       with no dirty check, so half a typed task is discarded silently by a click that
       happens elsewhere in the modal. */
    await waitFor(() => expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(''));

    await userEvent.type(canvas.getByRole('textbox', { name: 'Task' }), 'Weigh before next dose');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* The clearing is the visible half; this is the half that matters. Milo's record
       has NO `companion`, so these ids can only have come from `patient` through
       `getAppointmentCompanion`'s fallback - and they are Milo's, not the stale
       Poppy ids the first mount seeded. A re-seed that cleared the text but kept the
       old ids would pass the assertion above and fail here. */
    await waitFor(() => expect(createdTask()).toBeDefined());
    const payload = createdTask()?.body ?? {};
    await expect(payload.companionId).toBe('companion-milo');
    await expect(payload.assignedTo).toBe('parent-tomas');
    await expect(payload.name).toBe('Weigh before next dose');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The behaviour the `useEffect` exists for. Worth keeping in mind that the reset is ' +
          'unconditional: it fires on the appointment OBJECT changing, so a parent that rebuilds ' +
          'the appointment on each render would wipe the form on every keystroke.',
      },
    },
  },
};

export const NameMissing: Story = {
  name: 'Save with nothing typed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* Exactly one complaint, and it is the name. Everything else the validator checks -
       assignee, category, due date - is already satisfied on a form the reader has not
       touched, because the component seeded the first and the hook defaults the other
       two. The COUNT is the assertion: a second alert would mean the seeding stopped
       working. */
    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent('Name is required');
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );

    // Validation runs before the service call, so a bounced Save costs no request.
    await expect(createdTask()).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only validation error this panel can actually show. The other four the shared ' +
          'validator can raise all belong to fields that are either prefilled or, in the ' +
          "assignee's case, not rendered here at all.",
      },
    },
  },
};
