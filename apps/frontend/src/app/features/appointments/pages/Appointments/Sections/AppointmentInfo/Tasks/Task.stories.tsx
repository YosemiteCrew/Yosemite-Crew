import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Task from './Task';

const ORG_ID = 'org-storybook-employee-task';

/** A vet membership. `tasks:edit:any` is what gets past the `PermissionGate`. */
const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const member = (over: Partial<Team> & Pick<Team, '_id'>): Team => ({
  practionerId: `practitioner-${over._id}`,
  organisationId: ORG_ID,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
  ...over,
});

/**
 * Two named members and two records the label mapping has to survive.
 *
 * `label: team.name || team.practionerId || team._id` is a two-step fall-through, and
 * both steps are reachable from live data: a colleague invited by email has no profile
 * name until they finish signing up, and a membership row written before the
 * practitioner record exists has neither. The list below carries one of each, so the
 * dropdown draws an opaque id where a name should be rather than a blank row - which is
 * the point of the fall-through and also its cost.
 */
const TEAM: Team[] = [
  member({ _id: 'team-elena', name: 'Dr. Elena Marsh', practionerId: 'practitioner-elena' }),
  member({ _id: 'team-ravi', name: 'Dr. Ravi Patel', practionerId: 'practitioner-ravi' }),
  member({ _id: 'team-invited', practionerId: 'practitioner-unnamed' }),
  member({ _id: 'team-bare', practionerId: '' }),
];

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
    // `status` / `responseText` / `readyState` are prototype accessors, so an own data
    // property on the instance shadows them, and the REAL axios xhr adapter reads a
    // reply nobody sent.
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
 * `useTaskForm` fetches the org templates and the YC library on mount and POSTs on
 * Save. Unstubbed, every story would go to the network from the preview iframe, and
 * each rejection is logged with `console.error` by both `taskService` and the axios
 * wrapper. Axios uses the XHR adapter in a browser, so swapping `open`/`send` on the
 * prototype holds all of it while the hook, the services and the stores stay real.
 *
 * The recorded POST body is what makes the assignee dropdown testable at all:
 * `LabelDropdown` moves its own label on click whether or not the caller does anything
 * with `onSelect`, so the visible label proves nothing about the wiring. The value that
 * reaches `assignedTo` does.
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

    // Template lists answer empty; the create answers with a task carrying an id and an
    // org, because `upsertTask` console.warns when either is missing.
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

const seed = (team: Team[]) => () => {
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();
  const taskSnapshot = useTaskStore.getState();
  const restoreTransport = installTransport();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });
  // `useTeamForPrimaryOrg` reads ids for the primary org and maps them through
  // `teamsById`, so both halves have to be seeded or the hook returns [].
  useTeamStore.setState({
    teamsById: Object.fromEntries(team.map((item) => [item._id, item])),
    teamIdsByOrgId: { [ORG_ID]: team.map((item) => item._id) },
    status: 'loaded',
  });

  return () => {
    restoreTransport();
    useTaskStore.setState(taskSnapshot);
    useTeamStore.setState(teamSnapshot);
    useOrgStore.setState(orgSnapshot);
  };
};

/** The stacked field list inside the accordion. `gap-3` is TaskFormFields' own spacing. */
const fieldStack = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.flex.flex-col.gap-3') as HTMLElement;

/**
 * `LabelDropdown` portals its panel to `document.body` - not into the panel and not
 * into `canvasElement` - so querying the canvas for the options finds nothing and
 * passes as "closed".
 */
const openMenu = () => document.querySelector<HTMLElement>('[data-portal-dropdown]');

const menuOptions = async () => {
  await waitFor(() => expect(openMenu()).not.toBeNull());
  return within(openMenu() as HTMLElement).queryAllByRole('button');
};

const meta = {
  title: 'Appointments/Tasks/Task',
  component: Task,
  parameters: {
    layout: 'fullscreen',
    // `PermissionGate`'s denial fallback renders a "Request access" route with
    // next/navigation's useRouter.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The "task for a colleague" tab of the appointment panel. It adds exactly one thing to ' +
          'the shared `TaskFormBody`: the assignee dropdown, its options mapped from the team of ' +
          'the primary organisation, and the handler that writes the chosen value into ' +
          '`formData.assignedTo`.\n\n' +
          'The mapping is where the behaviour is. `label` falls through ' +
          '`name -> practionerId -> _id` and `value` falls through `practionerId -> _id`, so a ' +
          'colleague who has been invited but has not completed their profile appears in the ' +
          'list as a raw practitioner id rather than being hidden or blank. Both fall-throughs ' +
          'are live paths, not defensive code.\n\n' +
          'Two things to know before trusting a screenshot of this. **The trigger label is not ' +
          'evidence**: `LabelDropdown` keeps its own `internalSelected`, so it moves the label ' +
          'on click even if the caller throws `onSelect` away - the stories below read the ' +
          'created payload instead. And **there is no empty-team branch**: an org with no team ' +
          'still renders the dropdown, it just opens on "No options", so the form is ' +
          'unsatisfiable and only says so after the reader presses Save.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // 446px is the appointment side panel less its padding. `gap-4`, not `gap-3`, so
      // this wrapper is not mistaken for TaskFormFields' own stack by `fieldStack`.
      <div className="flex min-h-[640px] w-[446px] max-w-full flex-col gap-4 bg-[var(--screen)] p-3">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(TEAM),
} satisfies Meta<typeof Task>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TeamLoaded: Story = {
  name: 'Team loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The assignee row lands FIRST, above Category - nine fields where the parent-task
       panel has eight. Position matters because it is the field the reader lands on,
       and it is decided by the order in TaskFormFields, not by this component. */
    const stack = fieldStack(canvasElement);
    await expect(stack.children).toHaveLength(9);
    await expect(stack.children[0].textContent).toContain('Assigned to');

    /* Nothing is preselected: the trigger carries the bare placeholder as its
       accessible name, and gains ": <label>" only once a value resolves. So an
       employee task always opens unassigned even though the appointment has a lead. */
    const trigger = canvas.getByRole('button', { name: 'Assigned to' });
    await userEvent.click(trigger);

    /* One row per team member, in store order, with both fall-throughs visible: the
       third has no `name` and shows its practitioner id, the fourth has neither and
       shows its membership id. A mapping that dropped the unnamed members would still
       render a plausible-looking list of two - the length is what catches that. */
    const options = await menuOptions();
    await expect(options.map((item) => item.textContent)).toEqual([
      'Dr. Elena Marsh',
      'Dr. Ravi Patel',
      'practitioner-unnamed',
      'team-bare',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday state, with the two incomplete records the clinic actually has in it. ' +
          'Names come from the team store, so the list is as complete as the last team load - ' +
          'this component never triggers one itself.',
      },
    },
  },
};

export const AssigneeSelected: Story = {
  name: 'Assignee selected, then saved',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Assigned to' }));
    const options = await menuOptions();
    await userEvent.click(options[1]);

    // The label moves - but that alone would also happen if `onAssigneeSelect` did
    // nothing, because the dropdown holds its own selection. It is asserted as the
    // visible half of the contract, not as proof.
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Assigned to: Dr. Ravi Patel' })
      ).toBeInTheDocument()
    );

    await userEvent.type(canvas.getByRole('textbox', { name: 'Task' }), 'Re-run the PCV at 16:00');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* This is the proof. `assignedTo` carries the option's VALUE, which the mapping
       takes from `practionerId` - not the `_id` the store is keyed by and not the label
       on screen. Sending `_id` instead would look identical in every screenshot and
       assign the task to nobody. */
    await waitFor(() => expect(createdTask()).toBeDefined());
    const payload = createdTask()?.body ?? {};
    await expect(payload.assignedTo).toBe('practitioner-ravi');
    await expect(payload.name).toBe('Re-run the PCV at 16:00');
    // EMPLOYEE_TASK, because this panel asks `useTaskForm` for a non-companion task.
    // It is the one field that separates this write from the parent-task panel's.
    await expect(payload.audience).toBe('EMPLOYEE_TASK');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selecting a colleague and saving. The handler rebuilds the whole form object ' +
          '(`setFormData({ ...formData, assignedTo })`) from the render it was created in, so it ' +
          'is worth re-checking this if the form ever gains a field that updates outside React.',
      },
    },
  },
};

export const NoTeamMembers: Story = {
  name: 'No team members',
  beforeEach: seed([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The dropdown is rendered unconditionally - `showAssigneeSelect` is a literal, not
       derived from the options - so an org with nobody in it gets a control that opens
       onto the generic "No options" line. Not "No team members", not a hint about
       inviting anyone: `noOptionsMessage` is never passed here. */
    await userEvent.click(canvas.getByRole('button', { name: 'Assigned to' }));
    await waitFor(() => expect(openMenu()).not.toBeNull());
    await expect(await menuOptions()).toHaveLength(0);
    await expect(within(openMenu() as HTMLElement).getByText('No options')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Task' }),
      'Restock the crash trolley'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* The dead end: the form cannot be satisfied and only says so on Save, in copy that
       asks for something this panel cannot offer. */
    await waitFor(() =>
      expect(canvas.getByText('Please select a companion or staff')).toBeInTheDocument()
    );
    await expect(createdTask()).toBeUndefined();

    /* And it is not announced. `LabelDropdown` renders its error as a plain div - no
       `role="alert"`, no `aria-describedby` on the trigger, no `aria-invalid` - so the
       only signal is a red border. The name is filled here on purpose: the assignee is
       then the ONLY thing wrong with the form, and the live region count is zero, so a
       screen-reader user presses Save and is told nothing at all. `FormInput` does
       raise an alert for its own error, which is why this is a dropdown problem rather
       than a form-wide one. Asserted rather than left as a comment so that fixing the
       dropdown fails this line and brings someone back to read the rest. */
    const assignee = canvas.getByRole('button', { name: 'Assigned to' });
    await expect(assignee).not.toHaveAttribute('aria-invalid');
    await expect(assignee).not.toHaveAttribute('aria-describedby');
    const alerts = canvas.queryAllByRole('alert');
    await expect(alerts).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An organisation whose team has not loaded, or has no other members. The store starts ' +
          'empty on every cold page load and this component never asks for a load, so the ' +
          'unpopulated dropdown is also what a reader sees if they open the panel before ' +
          'something else has fetched the team.',
      },
    },
  },
};
