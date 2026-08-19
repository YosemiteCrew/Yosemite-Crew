import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, Form, UserOrganization } from '@yosemite-crew/types';

import type { FormField } from '@/app/features/forms/types/forms';
import { useAuthStore } from '@/app/stores/authStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';
import AppoitmentInfo, { CustomFormsView } from './index';

const ORG_ID = 'org-storybook-appointment-info';

/**
 * Deliberately WITHOUT an `id`.
 *
 * `useAppointmentCustomForms` returns on its first line when there is no appointment
 * id - no request, `customForms: []`, `loading: false` - and the SOAP fetch in
 * `useAppointmentFormData` is guarded the same way. That is what makes the modal
 * mountable here with no MSW wiring, and it is why the Templates pane below lands on
 * its empty branch rather than on a network error.
 */
const APPOINTMENT: Appointment = {
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  appointmentType: {
    id: 'svc-annual',
    name: 'Annual check-up',
    speciality: { id: 'spec-general', name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  concern: 'Limping on the left hind leg since Sunday.',
};

/** A vet membership: `prescription:edit:own` is what turns on the template picker. */
const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const SCHEMA: FormField[] = [
  { id: 'weight', type: 'input', label: 'Weight (kg)', required: true },
  { id: 'notes', type: 'textarea', label: 'Observations' },
];

const TEMPLATE_FORM = {
  _id: 'form-soap-1',
  orgId: ORG_ID,
  name: 'SOAP - general exam',
  category: 'SOAP',
  visibilityType: 'Internal',
  status: 'published',
  schema: SCHEMA,
  createdBy: 'user-storybook',
  updatedBy: 'user-storybook',
  createdAt: new Date('2026-01-04T09:00:00.000Z'),
  updatedAt: new Date('2026-01-04T09:00:00.000Z'),
} as unknown as Form;

const TEMPLATES = [
  { value: 'form-soap-1', label: 'SOAP - general exam', schema: SCHEMA, form: TEMPLATE_FORM },
];

/**
 * Seeds org membership, the signed-in user and the forms cache.
 *
 * `lastFetchedByOrgId` is the key that matters: `useLoadFormsForPrimaryOrg` returns
 * early once this org has an entry, so seeding it keeps the mount off the network with
 * no template service stub.
 */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const authSnapshot = useAuthStore.getState();
  const formsSnapshot = useFormsStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgsById: { [ORG_ID]: { _id: ORG_ID, type: 'HOSPITAL' } as never },
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });
  // Not a credential: an opaque app user id, the value `attributes.sub` holds.
  useAuthStore.setState({ attributes: { sub: 'user-storybook' } });
  useFormsStore.setState({
    formsById: {},
    formIds: [],
    loading: false,
    lastFetchedByOrgId: { [ORG_ID]: '2026-03-12T08:00:00.000Z' },
  });

  return () => {
    useOrgStore.setState(orgSnapshot);
    useAuthStore.setState(authSnapshot);
    useFormsStore.setState(formsSnapshot);
  };
};

type ModalProps = ComponentProps<typeof AppoitmentInfo>;

/**
 * Opened from a trigger rather than parked open: `ModalBase` takes a ref-counted scroll
 * lock on `document.body` while open, so a story that sat open would hold the whole docs
 * page under `overflow: hidden`.
 */
const Harness = (args: ModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[620px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-text-primary px-6 py-3 text-body-3-emphasis text-[var(--screen)]"
        onClick={() => setOpen(true)}
      >
        Open appointment
      </button>
      <AppoitmentInfo
        {...args}
        showModal={open}
        setShowModal={(value) => {
          setOpen(value);
          args.setShowModal(value);
        }}
      />
    </div>
  );
};

/**
 * `ModalBase` portals to `document.body`, so the panel is NOT inside `canvasElement`.
 * The dialog is also mounted a tick after the click, so the lookup is polled rather
 * than read once - and absence is asserted against `dialog[open]` specifically,
 * because a closed dialog stays in the tree without its `open` attribute.
 */
const openModal = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open appointment' }));
  await waitFor(() => {
    expect(document.body.querySelector('dialog[open]')).toBeInTheDocument();
  });
  return within(document.body.querySelector('dialog[open]') as HTMLElement);
};

const meta = {
  title: 'Appointments/AppointmentInfo (modal)',
  component: AppoitmentInfo,
  parameters: {
    layout: 'fullscreen',
    // The header rail pushes into the workspace with next/navigation's router.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The appointment detail modal. Its header is a tab rail and its body is whatever ' +
          '`COMPONENT_MAP[label][subLabel]` resolves to - about twenty different components ' +
          'behind five tabs - so the modal has no fixed body at all. Nothing had ever drawn the ' +
          'swap, only the Info tab it happens to open on.\n\n' +
          'The tab set is derived, not fixed: `buildInfoLabels` renames the Templates sub-tab to ' +
          'SOAP for hospitals, swaps the whole Medical Records tab for a Care plan tab at ' +
          'boarders, breeders and groomers, and drops the MSD sub-tab entirely unless that ' +
          'integration resolves as enabled. So "click the second tab" lands on a different ' +
          'component depending on the organisation.\n\n' +
          'The Templates/SOAP pane behind that tab has four states that only exist around a ' +
          'network call - loading, failed, empty, and a rejected submit - and they are ' +
          'exercised below from `CustomFormsView` directly, because inside the modal they are ' +
          'owned by a hook that reaches them only through a live `fetchAppointmentForms`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    activeAppointment: APPOINTMENT,
    canEditAppointments: true,
    onReschedule: fn(),
  },
  render: (args) => <Harness {...args} />,
  beforeEach: seed,
} satisfies Meta<typeof AppoitmentInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoTab: Story = {
  name: 'Info tab (default body)',
  play: async ({ canvasElement }) => {
    const panel = await openModal(canvasElement);

    /* Both rails render a `role="tablist"` of `role="tab"` buttons, so a bare
       getAllByRole('tab') here returns eight, not five. Only the top rail is named. */
    const topRail = panel.getByRole('tablist', { name: 'Section navigation' });
    const tabs = within(topRail).getAllByRole('tab');
    await expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Info',
      'Medical Records',
      'Tasks',
      'Finance',
      'Labs',
    ]);
    await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    // The body is the Info section, identified by its own accordion rather than by
    // "something rendered" - COMPONENT_MAP returning undefined renders nothing at all,
    // which is indistinguishable from a crash without an assertion on the contents.
    await expect(panel.getByText('Appointments details')).toBeInTheDocument();
    await expect(panel.getByText('Limping on the left hind leg since Sunday.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What opens from a board card: the companion header, a status sentence, four ' +
          'shortcut buttons into the workspace, the tab rail, and the Info body under it. The ' +
          'MSD sub-tab is absent because the integration is not seeded as enabled here, which ' +
          'is the majority case.',
      },
    },
  },
};

export const TabSwapToMedicalRecords: Story = {
  name: 'Tab swap - Info to Medical Records',
  play: async ({ canvasElement }) => {
    const panel = await openModal(canvasElement);
    await expect(panel.getByText('Appointments details')).toBeInTheDocument();

    const topRail = panel.getByRole('tablist', { name: 'Section navigation' });
    await userEvent.click(within(topRail).getByRole('tab', { name: 'Medical Records' }));

    // The entire body is replaced, not added to.
    await waitFor(() => {
      expect(panel.queryByText('Appointments details')).not.toBeInTheDocument();
    });

    // The sub-rail switches with it, and the first sub-tab is selected by default.
    await expect(within(topRail).getByRole('tab', { name: 'Medical Records' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    /* "SOAP", not "Templates", in TWO places: `buildInfoLabels` renames the sub-tab for
       hospitals and `formsAccordionTitle` renames the accordion by a separate rule, so
       the word appears twice and the two can drift apart. */
    await expect(panel.getAllByText('SOAP')).toHaveLength(2);
    await expect(panel.getByLabelText('Search templates')).toBeInTheDocument();

    // The past-submissions accordion is the empty branch, and it starts closed.
    const previous = panel.getByRole('button', { name: 'Previous Submissions' });
    await expect(panel.queryByText('No past form submissions.')).not.toBeInTheDocument();
    await userEvent.click(previous);
    expect(await panel.findByText('No past form submissions.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The swap itself. Worth noting that the header keeps its height while the body ' +
          'changes by hundreds of pixels - the scroll container under the rail is reset to the ' +
          'top on every tab change, which is the only reason a long Finance tab does not open ' +
          'mid-scroll after a short Info tab.',
      },
    },
  },
};

export const TabSwapToFinance: Story = {
  name: 'Tab swap - Finance',
  play: async ({ canvasElement }) => {
    const panel = await openModal(canvasElement);
    const topRail = panel.getByRole('tablist', { name: 'Section navigation' });
    await userEvent.click(within(topRail).getByRole('tab', { name: 'Finance' }));

    /* "Appointments details" does NOT identify the Info body, and asserting its
       absence here was wrong: `Finance/Summary` opens with an `EditableAccordion`
       under the very same title, carrying the same concern, date, lead and
       status. The swap is real - it is the affordance that differs. The Info
       body's accordion is editable (`showEditIcon={canEditAppointments}`, so it
       renders an `Edit Appointments details` button); Finance's passes
       `showEditIcon={false}`. That button is therefore the discriminator, and
       `Estimated total:` is the Finance-only counterpart. */
    await waitFor(() => {
      expect(
        panel.queryByRole('button', { name: 'Edit Appointments details' })
      ).not.toBeInTheDocument();
    });
    await expect(panel.getByText('Estimated total:')).toBeInTheDocument();
    // Still exactly one, and it belongs to Finance now - pinned rather than
    // glossed over, because the duplicate title is what made the old assertion
    // look like a broken tab swap.
    await expect(panel.getAllByText('Appointments details')).toHaveLength(1);
    await expect(within(topRail).getByRole('tab', { name: 'Finance' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // The second, unnamed tablist is the sub-rail: two sub-tabs, Summary selected first.
    const subRail = panel.getAllByRole('tablist')[1];
    await expect(
      within(subRail)
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.trim())
    ).toEqual(['Summary', 'Invoices']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A second destination, to show that the rail is a real router and not a two-state ' +
          'toggle. Both rails render into the same `role="tablist"`, so the sub-tabs have to be ' +
          'filtered out by name rather than by role when asserting the top rail.\n\n' +
          'Two tabs render an accordion titled **"Appointments details"**: the Info body and the ' +
          'Finance Summary body, which repeats service, reason, date, time, lead and status above ' +
          'the payment block. They are not interchangeable - the Info one is editable and the ' +
          'Finance one is read-only - but nothing on screen says so, and the duplicate title is ' +
          'the reason this story asserts the swap through the edit affordance instead.',
      },
    },
  },
};

/* ---------------------------------------------------------------------------
   The Templates/SOAP pane, driven directly.
   --------------------------------------------------------------------------- */

const formsViewArgs = {
  forms: [],
  canEdit: true,
  activeAppointment: { ...APPOINTMENT, id: 'appt-info-1' },
  templates: TEMPLATES,
  accordionTitle: 'SOAP',
};

export const FormsLoading: Story = {
  name: 'Templates pane - loading',
  render: () => (
    <div className="max-w-[560px] p-4">
      <CustomFormsView {...formsViewArgs} loading error={null} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading forms…')).toBeInTheDocument();
    // It replaces the accordion outright rather than sitting inside it, so there is no
    // template picker and no submissions list while forms load.
    await expect(canvas.queryByLabelText('Search templates')).not.toBeInTheDocument();
    await expect(canvas.queryByText('SOAP')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A bare line of body text, with no skeleton and no accordion around it - so the pane ' +
          'visibly collapses to one row and then expands again when the forms arrive. That jump ' +
          'is the thing to look at here.',
      },
    },
  },
};

export const FormsError: Story = {
  name: 'Templates pane - load failed',
  render: () => (
    <div className="max-w-[560px] p-4">
      <CustomFormsView {...formsViewArgs} loading={false} error="Unable to load forms" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const line = canvas.getByText('Unable to load forms');
    await expect(line).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Search templates')).not.toBeInTheDocument();

    // The only thing separating this from the loading line is its colour. Poll rather
    // than reading once - the surrounding rows carry `transition-colors`.
    await waitFor(() => {
      expect(getComputedStyle(line).color).not.toBe(
        getComputedStyle(line.parentElement as HTMLElement).color
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure branch. It is the same shape as the loading branch with a different ' +
          'token, no retry and no icon, which is exactly why it is worth drawing: a reader who ' +
          'misses the colour cannot tell a failed load from a slow one.',
      },
    },
  },
};

export const FormsEmpty: Story = {
  name: 'Templates pane - no past submissions',
  render: () => (
    <div className="max-w-[560px] p-4">
      <CustomFormsView {...formsViewArgs} loading={false} error={null} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('SOAP')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Search templates')).toBeInTheDocument();

    // The empty state is nested one accordion deep and starts closed, so the sentence
    // is not on screen until it is opened - the pane looks like it has nothing in it.
    await expect(canvas.queryByText('No past form submissions.')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Previous Submissions' }));
    expect(await canvas.findByText('No past form submissions.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loaded and genuinely empty. Both the loaded-empty and still-loading states show a ' +
          'pane with no forms in it, and only this one has the accordion around it - which is ' +
          'the difference a reviewer should be able to spot at a glance and currently cannot.',
      },
    },
  },
};

export const FormsSubmitError: Story = {
  name: 'Templates pane - submit blocked by a required field',
  render: () => (
    <div className="max-w-[560px] p-4">
      <CustomFormsView {...formsViewArgs} loading={false} error={null} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // minChars is 0 here, so focusing the field opens the whole template list.
    await userEvent.click(canvas.getByLabelText('Search templates'));
    await userEvent.click(await canvas.findByRole('button', { name: 'SOAP - general exam' }));

    // The template's schema is rendered inline, required field first.
    expect(await canvas.findByText('Weight (kg)')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    // Client-side, before any request: the missing labels are named back to the user.
    expect(
      await canvas.findByText('Please complete the required field(s): Weight (kg)')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The submit error. It is raised by `collectMissingRequiredFields` before the ' +
          'submission request is made, so it is reachable with no backend at all - and it is ' +
          'rendered at the very bottom of the pane, below every form, rather than beside the ' +
          'field it names. On a long template that puts the message off screen, which is the ' +
          'thing to judge here.',
      },
    },
  },
};
