import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Speciality } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AddRoom from './AddRoom';

const ORG_ID = 'org-storybook-rooms';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const SPECIALITIES: Speciality[] = [
  { _id: 'spec-surgery', organisationId: ORG_ID, name: 'Surgery', isActive: true },
  { _id: 'spec-internal', organisationId: ORG_ID, name: 'Internal medicine', isActive: true },
];

const TEAMS: Team[] = [
  {
    _id: 'team-hartmann',
    practionerId: 'vet-hartmann',
    organisationId: ORG_ID,
    name: 'Dr. Lena Hartmann',
    role: 'VETERINARIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
  {
    _id: 'team-raman',
    practionerId: 'nurse-raman',
    organisationId: ORG_ID,
    name: 'Priya Raman',
    role: 'TECHNICIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

/**
 * Seeds the real stores rather than mocking the hooks. Both dropdowns in the
 * drawer read `useTeamForPrimaryOrg` / `useSpecialitiesForPrimaryOrg`, which are
 * pure store selectors with no fetch of their own, so the drawer mounts with real
 * options and no network at all.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);
  useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);

  return () => {
    useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, status: 'idle' });
    useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
    useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
  };
};

/**
 * Both panels portal to `document.body`, so neither is inside `canvasElement`,
 * and both `<dialog>` elements are mounted from the first render - only the
 * `open` attribute moves. Absence therefore has to be asserted against
 * `dialog[open]`, and the drawer is always the first of the two in document
 * order because it is rendered first.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
const drawer = () => openDialogs()[0];
const confirmSheet = () => openDialogs()[1];

const AddRoomHarness = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The rooms list sits behind the drawer, so the backdrop tint and blur are visible.
      </p>
      <AddRoom showModal={open} setShowModal={setOpen} />
    </div>
  );
};

const meta = {
  title: 'Organization/AddRoom',
  component: AddRoomHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "New room" drawer. It is opened from the Rooms section and had never been ' +
          'drawn in Storybook, so neither its resting layout nor either of the two states it can ' +
          'refuse to close in were reviewable.\n\n' +
          '**Closing is conditional.** The header X, the backdrop and Escape all route through ' +
          'the same dirty check: with any field touched, the drawer refuses and raises a ' +
          '"Discard changes?" confirm instead. The Escape and backdrop paths go through the ' +
          'Modal `canClose` hook, which returns `false` **and** opens the confirm as a side ' +
          'effect - so a reviewer cannot verify the guard by looking at the drawer alone.\n\n' +
          '**Validation is name and type only.** Room code, availability, units and equipment ' +
          'all save empty; the two required fields report in different places, because one is a ' +
          '`FormInput` (red border, `role="alert"` line, `aria-invalid`) and the other is a ' +
          '`LabelDropdown` (red border and a plain message with no alert role).\n\n' +
          'The four section bodies are covered separately in ' +
          '**Organization/AddRoomSections**, which drives them from props rather than through ' +
          'this drawer.\n\n' +
          'One state is deliberately not storied: the `Adding room...` footer label. It exists ' +
          'only while `createRoom` is in flight, and this repo has no request-mocking layer, so ' +
          "the label's lifetime would be decided by how fast a real request fails.",
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed,
} satisfies Meta<typeof AddRoomHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'New room',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await expect(panel.getByRole('heading', { name: 'New room' })).toBeVisible();
    // Every section starts open, so the drawer opens at its full height rather
    // than as four collapsed rows.
    await expect(panel.getByRole('button', { name: 'Basic details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(panel.getByLabelText('Name')).toHaveValue('');
    await expect(panel.getByLabelText('Room code')).toHaveValue('');
    // No type chosen yet, so the trigger shows the bare placeholder and both
    // unit-capable sections show their "not supported" copy.
    await expect(panel.getByRole('button', { name: 'Room type' })).toBeInTheDocument();
    await expect(
      panel.getByText('Units are available for ICU, Inpatient, Isolation, and Boarding rooms.')
    ).toBeInTheDocument();

    // Both option triggers show their bare placeholder, so nothing is preselected.
    await expect(panel.getByRole('button', { name: 'Speciality (optional)' })).toBeInTheDocument();
    await expect(
      panel.getByRole('button', { name: 'Assigned staff (optional)' })
    ).toBeInTheDocument();

    await expect(panel.getByRole('button', { name: 'New room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens: a 530px right-side panel with a fixed header, one scrolling ' +
          'column of four sections and a single footer action. Nothing is required except a name ' +
          'and a type, and neither is prefilled.',
      },
    },
  },
};

export const OptionsComeFromTheOrg: Story = {
  name: 'Speciality options resolved from the org',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Speciality (optional)' }));
    /* The listbox portals to document.body, so it is outside the drawer's own
       `overflow-y-auto` column - which is the reason it is not clipped by it, and
       also the reason it cannot be found through `within(drawer())`. */
    await waitFor(() =>
      expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument()
    );
    const options = document.querySelector('[data-portal-dropdown]') as HTMLElement;
    // Both seeded specialities, and only those - the list is the org's, not a
    // constant, so an empty store would render an empty panel here.
    await expect(within(options).getAllByRole('button')).toHaveLength(2);
    await expect(within(options).getByText('Surgery')).toBeInTheDocument();
    await expect(within(options).getByText('Internal medicine')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The speciality and staff pickers read the org stores through ' +
          '`useSpecialitiesForPrimaryOrg` and `useTeamForPrimaryOrg`, so a room can only be ' +
          'assigned to people and specialities that already exist. Both panels portal out of the ' +
          'drawer, which is what stops the scrolling column from clipping them.',
      },
    },
  },
};

export const RequiredFieldErrors: Story = {
  name: 'Add pressed with nothing filled in',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);

    await userEvent.click(panel.getByRole('button', { name: 'New room' }));

    // Two required fields, reported in two different components: the name gets a
    // `role="alert"` line wired to the input, the room type gets a plain message
    // under a red trigger with no alert semantics at all.
    expect(await panel.findByText('Name is required')).toBeInTheDocument();
    await expect(panel.getByText('Room type is required')).toBeInTheDocument();
    await expect(panel.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(panel.queryAllByRole('alert')).toHaveLength(1);
    // Room code is optional, so it must stay clean - all three sit in one grid
    // and it is easy to mark the wrong one.
    await expect(panel.getByLabelText('Room code')).toHaveAttribute('aria-invalid', 'false');

    // Validation runs before the request, so a failed Add leaves the drawer open
    // and the footer label unchanged rather than flashing "Adding room...".
    await expect(openDialogs()).toHaveLength(1);
    await expect(panel.getByRole('button', { name: 'New room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only state a reviewer can reach without a backend, and the one where the two ' +
          'error treatments sit side by side. The asymmetry is real: assistive tech is told about ' +
          'the name but not about the room type.',
      },
    },
  },
};

export const DiscardConfirm: Story = {
  name: 'Closing a dirty form',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());
    await userEvent.type(panel.getByLabelText('Name'), 'Recovery Bay 3');

    await userEvent.click(panel.getByRole('button', { name: 'Close' }));

    // The drawer does NOT close: two dialogs are open at once, the confirm over
    // the drawer that raised it.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));
    const sheet = within(confirmSheet());
    /* Polled, not read once. The confirm is a `CenterModal`, whose panel fades in
       over `transition-opacity duration-100` - `opacity-0 -> opacity-100` is
       applied in the same commit that sets `open`, so the `waitFor` above returns
       at a frame where the computed opacity is still exactly `0`. `getByRole`
       ignores opacity, so the heading is FOUND and then called invisible; the
       drawer underneath never hits this because it animates `transform`, not
       opacity. */
    const confirmHeading = sheet.getByRole('heading', { name: 'Discard changes?' });
    await waitFor(() => expect(confirmHeading).toBeVisible());
    await expect(
      sheet.getByText('You have unsaved changes. Are you sure you want to discard them?')
    ).toBeInTheDocument();
    await expect(sheet.getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    await expect(sheet.getByRole('button', { name: 'Discard' })).toBeInTheDocument();

    await userEvent.click(sheet.getByRole('button', { name: 'Keep editing' }));

    // Back to one dialog, with the typed value intact - "Keep editing" dismisses
    // the confirm without touching the form.
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await expect(within(drawer()).getByLabelText('Name')).toHaveValue('Recovery Bay 3');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirm only exists once something has been typed: `isDirty` compares the whole ' +
          'form against its initial object, plus the un-added custom equipment name, so an ' +
          'untouched drawer closes on the first click with no interruption.',
      },
    },
  },
};

export const DiscardResetsTheDraft: Story = {
  name: 'Discarding closes both panels',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await userEvent.type(within(drawer()).getByLabelText('Name'), 'Recovery Bay 3');
    await userEvent.click(within(drawer()).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    await userEvent.click(within(confirmSheet()).getByRole('button', { name: 'Discard' }));

    /* Both dialogs stay MOUNTED without their `open` attribute, so absence has to
       be asserted against `dialog[open]` - querying for the elements themselves
       finds them either way and would pass whatever happened. */
    await waitFor(() => expect(openDialogs()).toHaveLength(0));
  },
  parameters: {
    docs: {
      description: {
        story:
          '`resetAndClose` does four things in one call - clears the form, clears the errors, ' +
          'clears the pending equipment name and closes both panels - which is why reopening the ' +
          'drawer after a discard shows a blank form rather than the abandoned one.',
      },
    },
  },
};

export const EscapeOnDirtyForm: Story = {
  name: 'Escape on a dirty form',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await userEvent.type(within(drawer()).getByLabelText('Name'), 'Recovery Bay 3');

    await userEvent.keyboard('{Escape}');

    // Escape goes through Modal's `canClose`, which is a different path from the
    // header X: it returns false to block the dismissal AND opens the confirm as
    // a side effect, so the key press is neither ignored nor destructive.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));
    // Polled for the same reason as the header-X story above: `open` is set a
    // full `duration-100` before the CenterModal panel has faded past opacity 0.
    const confirmHeading = within(confirmSheet()).getByRole('heading', {
      name: 'Discard changes?',
    });
    await waitFor(() => expect(confirmHeading).toBeVisible());
    await expect(within(drawer()).getByLabelText('Name')).toHaveValue('Recovery Bay 3');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The backdrop click takes the same route. Without the guard, Escape on a half-filled ' +
          'room would discard it silently - the drawer holds every field in local state and ' +
          'nothing is persisted until Add is pressed.',
      },
    },
  },
};
