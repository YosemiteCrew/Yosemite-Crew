import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import DeleteOrg from './DeleteOrg';

const ORG_ID = 'org-storybook-delete';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

/** `org:delete` is held by OWNER alone in the shipped role table. */
const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/** ADMIN holds `org:edit` but not `org:delete` - the nearest role that cannot. */
const ADMIN: UserOrganization = {
  ...OWNER,
  id: 'membership-admin',
  roleCode: 'ADMIN',
};

/** The six lines this section passes to the shared confirmation modal. */
const ORG_ITEMS = [
  'All organization settings',
  'Rooms, teams, users & roles',
  'Appointments, tasks & history',
  'Inventory, finance & documents',
  'Companions/pet records',
  'Subscription & billing data',
];

/**
 * Seeds the org store rather than mocking `usePermissions`. `status: 'loaded'`
 * is required: the hook reports `isLoading` while the store is `idle` and the
 * gate then renders its null skeleton, which looks exactly like the denied
 * state and would make the permission stories prove nothing.
 */
const seed =
  (membership: UserOrganization = OWNER) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
      });
    };
  };

/** The confirm portals to `document.body`, so it is never inside `canvasElement`. */
const openDialog = () => document.querySelector('dialog[open]') as HTMLElement | null;

const meta = {
  title: 'Organization/DeleteOrg',
  component: DeleteOrg,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The danger band at the bottom of the organisation page, and the confirmation it ' +
          'raises. Neither had been drawn: the whole section is behind `org:delete`, which only ' +
          'OWNER holds, so for every other role it renders **nothing at all** - not a disabled ' +
          'band, no node.\n\n' +
          'The band itself is the only place in PIMS that uses `--danger-border` as a resting ' +
          'container border rather than an error state, paired with `--danger-text` on the title ' +
          'and the outlined `Delete…` pill while the supporting line stays in ordinary faint ' +
          'ink. That mix is deliberate - it reads as a zone, not as an error - and it is exactly ' +
          'what a token rename would flatten without failing anything.\n\n' +
          'The confirmation is the shared `DeleteConfirmationModal` (which has its own stories ' +
          'for the consent gate), so what is worth reviewing here is the copy THIS caller ' +
          'passes into it: six bullets naming every category of data that goes, an email prompt ' +
          'that asks for the owner address specifically, and the ellipsis on the trigger that ' +
          'promises a further step before anything happens.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[220px] w-[760px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof DeleteOrg>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DangerBand: Story = {
  name: 'Danger band (owner)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText('Delete organization');
    await expect(
      canvas.getByText('Removes the clinic and revokes all team access')
    ).toBeInTheDocument();
    const trigger = canvas.getByRole('button', { name: 'Delete…' });

    /* Three colours, three roles. The title is `--danger-text` and the ellipsis
       pill matches it exactly, which is what makes the pair read as one control;
       the supporting line stays ordinary faint ink so the band is not a wall of
       red; and the container border is `--danger-border`, a translucent red that
       must NOT equal the text colour or the band turns into a hard error box.

       Only the first comparison is polled, and deliberately so: the pill is the
       one element here that carries `transition-all`, so a synchronous read of
       it can land on an interpolated colour and report a mismatch that is not
       real. The title, the subline and the band border have no transition at
       all, and the two assertions below them are negative - a mid-transition
       read could only ever make them pass for the wrong reason, which is the
       failure mode `waitFor` would hide rather than catch. */
    await waitFor(() => {
      expect(getComputedStyle(trigger).color).toBe(getComputedStyle(title).color);
    });
    const band = title.parentElement?.parentElement as HTMLElement;
    await expect(
      getComputedStyle(canvas.getByText('Removes the clinic and revokes all team access')).color
    ).not.toBe(getComputedStyle(title).color);
    await expect(getComputedStyle(band).borderTopColor).not.toBe(getComputedStyle(title).color);

    // Nothing is open yet: the trigger promises a step, it does not take one.
    await expect(openDialog()).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting band. It is `mt-auto` inside the page column, so it is pinned to the ' +
          'bottom of the organisation page rather than flowing after the last section - which ' +
          'is why it is drawn here in a short wrapper instead of at the end of a tall one.',
      },
    },
  },
};

export const ConfirmationOpen: Story = {
  name: 'Confirmation open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }));

    await waitFor(() => expect(openDialog()).not.toBeNull());
    const dialog = within(openDialog() as HTMLElement);

    /* Polled, not read once. `DeleteConfirmationModal` wraps a `CenterModal`,
       whose panel fades in over `transition-opacity duration-100`, and
       `opacity-0 -> opacity-100` lands in the same commit that adds `open` - so
       the `waitFor` above returns while the computed opacity is still exactly
       `0` and jest-dom calls every descendant invisible. `getByRole` does not
       look at opacity, so the heading is FOUND and then reported hidden. Waiting
       for the fade keeps the assertion rather than trading it for a weaker
       presence check. */
    const heading = dialog.getByRole('heading', { name: 'Delete organization' });
    await waitFor(() => expect(heading).toBeVisible());
    await expect(
      dialog.getByText('Are you sure you want to delete this organization?')
    ).toBeInTheDocument();

    /* The six bullets are the substance of the warning, and they are this
       section's own copy rather than the modal's - assert all six, in order,
       not merely that a list exists. */
    await expect(dialog.getAllByRole('listitem').map((li) => li.textContent)).toEqual(ORG_ITEMS);

    // The email prompt names the OWNER address, which no other caller of this modal does.
    await expect(
      dialog.getByText('This cannot be undone. Enter owner email address')
    ).toBeInTheDocument();
    await expect(
      dialog.getByText('I understand that all data will be permanently deleted.')
    ).toBeInTheDocument();
    await expect(
      dialog.getByText(/Deleting the organization will remove all data and cannot be reversed\./)
    ).toBeInTheDocument();

    // The gate itself is the shared modal's, and it starts shut.
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirmation as it opens. Everything except the consent gate is copy this ' +
          'section supplies, so this story is what catches a bullet list that drifts out of ' +
          'step with what the delete endpoint actually removes.',
      },
    },
  },
};

export const HiddenWithoutPermission: Story = {
  name: 'Hidden without org:delete',
  beforeEach: seed(ADMIN),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* `PermissionGate` here has neither a `fallback` nor a `deniedResource`, so
       a denied check returns null: an admin gets no band, no explanation and no
       disabled control. That is the intended design, and it is indistinguishable
       from the still-loading state - which is why the seed sets `status:
       'loaded'` rather than leaving the store idle. */
    await expect(canvas.queryByText('Delete organization')).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('Removes the clinic and revokes all team access')
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'ADMIN is the nearest role to OWNER and still cannot see this: it holds `org:edit` ' +
          'but not `org:delete`. The modal is not mounted either, so there is no closed dialog ' +
          'left behind in the DOM for a stray Escape or a focus trap to find.',
      },
    },
  },
};
