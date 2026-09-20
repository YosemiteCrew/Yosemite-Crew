import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import ToastProvider from '@/app/ui/layout/ToastProvider';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import DeleteProfile from './DeleteProfile';

const org = (id: string, name: string): Organisation => ({
  _id: id,
  name,
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
});

const membership = (orgId: string, roleDisplay: string): UserOrganization => ({
  id: `membership-${orgId}`,
  practitionerReference: 'Practitioner/pract-1',
  organizationReference: `Organization/${orgId}`,
  roleCode: roleDisplay.toUpperCase(),
  roleDisplay,
  active: true,
});

const EMPTY_ORG_STATE = {
  orgsById: {},
  orgIds: [],
  primaryOrgId: null,
  membershipsByOrgId: {},
  status: 'idle' as const,
  error: null,
};

type Seed = {
  /** `attributes.sub` is the app user id the delete call is addressed to. */
  userId: string | null;
  /** `[orgId, org name, the role held there]`. Only "owner" blocks deletion. */
  roles: Array<[string, string, string]>;
};

/**
 * Seeds the two stores the section reads.
 *
 * `ownerOrgNames` is derived from BOTH: a membership whose role reads "owner"
 * only produces a name when `orgsById` also holds that organisation. Seeding the
 * two separately is deliberate - a membership with no matching org record is a
 * real state (the org list and the membership list load independently) and it
 * silently drops the org from the warning.
 */
const seed =
  ({ userId, roles }: Seed) =>
  () => {
    const orgsById: Record<string, Organisation> = {};
    const membershipsByOrgId: Record<string, UserOrganization> = {};
    for (const [orgId, name, role] of roles) {
      orgsById[orgId] = org(orgId, name);
      membershipsByOrgId[orgId] = membership(orgId, role);
    }

    useOrgStore.setState({
      orgsById,
      orgIds: Object.keys(orgsById),
      primaryOrgId: Object.keys(orgsById)[0] ?? null,
      membershipsByOrgId,
      status: 'loaded',
      error: null,
    });
    useAuthStore.setState({ attributes: userId ? { sub: userId } : null });

    return () => {
      useOrgStore.setState(EMPTY_ORG_STATE);
      useAuthStore.setState({ attributes: null });
    };
  };

/**
 * The text of the toasts currently on screen, read off the container rather than
 * through a text query: on the docs page every story mounts its own
 * `ToastContainer`, so one `notify` can render in more than one of them and a
 * `findByText` would throw on the duplicates.
 */
const toastText = (): string =>
  [...globalThis.document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

/** `ModalBase` portals to `document.body`, so the panel is never in `canvasElement`. */
const openDialog = (): Promise<HTMLElement> =>
  waitFor(() => {
    const dialog = globalThis.document.querySelector('dialog[open]');
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });

const DeleteProfileCard = () => (
  <div className="w-[520px] max-w-full bg-[var(--page)] p-4">
    <ToastProvider />
    <DeleteProfile />
  </div>
);

const meta = {
  title: 'Settings/DeleteProfile',
  component: DeleteProfileCard,
  parameters: {
    layout: 'centered',
    // `handleDelete` ends on `router.replace('/signin')`, so the app router has to
    // be mounted or the section throws on render.
    nextjs: { appDirectory: true, navigation: { pathname: '/settings' } },
    docs: {
      description: {
        component:
          'The account-deletion affordance at the foot of Settings: a `--danger-border` row and ' +
          'a "Delete profile" button.\n\n' +
          'The button is a fork, not an opener. Before anything is shown it asks whether this ' +
          'person still OWNS any organisation, and an owner is refused outright with a warning ' +
          'toast naming the clinics - deleting them would leave a clinic with no owner and no ' +
          'route back in. Only a non-owner reaches the confirmation modal.\n\n' +
          'Ownership is inferred, not flagged: the membership role string is lower-cased and ' +
          'compared to `owner`, falling back to `roleCode` when `roleDisplay` is missing, and ' +
          'the organisation name is looked up separately. So a role spelled anything else - and ' +
          'an owning membership whose org record has not loaded - both read as "not an owner" ' +
          'and open the modal. The stories below cover both sides of that fork; the confirmed ' +
          'delete itself is a real `DELETE /fhir/v1/user/:id` followed by a sign-out, which ' +
          'this repo has no stub for, so no story clicks through it with a user id present.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed({
    userId: 'user-1',
    roles: [['org-sunrise', 'Sunrise Veterinary', 'veterinarian']],
  }),
} satisfies Meta<typeof DeleteProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'The row before anything is clicked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Delete profile')).toBeInTheDocument();
    await expect(
      canvas.getByText('Leaves all organizations and erases your account')
    ).toBeInTheDocument();

    /* `Secondary` renders an <a> for a real href and a <button> for "#". This one
       passes "#", so it must be a button: an anchor here would be a destructive
       action that a screen reader announces as a link and that middle-click opens
       in a new tab. */
    const trigger = canvas.getByRole('button', { name: 'Delete profile' });
    await expect(trigger.tagName).toBe('BUTTON');

    // Nothing is open until it is clicked.
    await expect(globalThis.document.querySelector('dialog[open]')).toBeNull();
  },
};

export const NotAnOwner: Story = {
  name: 'Not an owner: the confirmation opens',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete profile' }));

    const dialog = await openDialog();
    const panel = within(dialog);

    // The five things deletion takes with it. Asserted as a count as well as by
    // name: an item quietly dropped from the list is a consent the person never
    // actually gave.
    await expect(panel.getAllByRole('listitem')).toHaveLength(5);
    await expect(
      panel.getByText('Access permissions within all organizations')
    ).toBeInTheDocument();
    await expect(
      panel.getByText('This cannot be undone. Enter your email address')
    ).toBeInTheDocument();

    /* The consent tick is the gate, and it used to be decorative - the box was
       rendered, read by nothing, and a profile could be deleted without it. The
       Delete button must be disabled until it is ticked, and must become enabled
       on the tick alone (the email keeps its own inline validation, so folding it
       in here would make "Email is required" unreachable). */
    const confirm = panel.getByRole('button', { name: 'Delete' });
    const consent = panel.getByRole('checkbox', { name: 'Confirm deletion consent' });
    await expect(consent).not.toBeChecked();
    await expect(confirm).toBeDisabled();

    await userEvent.click(consent);
    await expect(consent).toBeChecked();
    await waitFor(() => expect(confirm).toBeEnabled());
  },
};

export const StillAnOwner: Story = {
  name: 'Still an owner: refused by name',
  beforeEach: seed({
    userId: 'user-1',
    roles: [
      ['org-sunrise', 'Sunrise Veterinary', 'Owner'],
      ['org-meadow', 'Meadowbrook Boarding', 'owner'],
      ['org-harbour', 'Harbour Referrals', 'veterinarian'],
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete profile' }));

    /* The refusal names the clinics rather than saying "you own some
       organisations", so the person knows exactly what to hand over. Both
       spellings of the role - "Owner" and "owner" - have to land in the list, and
       the clinic where this person is only a vet must NOT. */
    await waitFor(() => expect(toastText()).toContain('Transfer ownership first'));
    await expect(toastText()).toContain(
      'You still own Sunrise Veterinary, Meadowbrook Boarding. Transfer ownership before deleting your profile.'
    );
    await expect(toastText()).not.toContain('Harbour Referrals');

    // The refusal replaces the modal; it does not accompany it.
    await expect(globalThis.document.querySelector('dialog[open]')).toBeNull();
  },
};

export const MissingUserId: Story = {
  name: 'No user id: confirmed, then refused',
  // The signed-in session exists (the page rendered) but the profile lookup that
  // fills `attributes` never landed, so `sub` is missing.
  beforeEach: seed({
    userId: null,
    roles: [['org-sunrise', 'Sunrise Veterinary', 'veterinarian']],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete profile' }));

    const dialog = await openDialog();
    const panel = within(dialog);
    await userEvent.click(panel.getByRole('checkbox', { name: 'Confirm deletion consent' }));
    await userEvent.type(
      panel.getByRole('textbox', { name: 'Enter email address' }),
      'elena@sunrise.vet'
    );
    await userEvent.click(panel.getByRole('button', { name: 'Delete' }));

    /* The one confirmed-delete path that reaches no network: `handleDelete`
       returns before `startRouteLoader` and before the DELETE, so this is
       reachable in Storybook where the success path is not. */
    await waitFor(() =>
      expect(toastText()).toContain('Missing user identity. Please sign in again.')
    );

    /* Worth a reviewer's attention: the modal closes anyway. `DeleteConfirmationModal`
       resets and dismisses as soon as `onDelete` RESOLVES, and refusing by
       returning early resolves. The person is left on a page that has quietly
       discarded their typed email with only a toast to say the deletion did not
       happen. */
    await waitFor(() => expect(globalThis.document.querySelector('dialog[open]')).toBeNull());
  },
};

export const Phone: Story = {
  name: 'Phone: the danger row holds its line',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Delete profile' });

    /* The row is a single non-wrapping flex line: label block, then the pill. At
       375 the description is the longest string in it, so this is where the pill
       gets squeezed or pushed off. */
    const row = trigger.parentElement as HTMLElement;
    const rowBox = row.getBoundingClientRect();
    const pillBox = trigger.getBoundingClientRect();
    await expect(pillBox.right).toBeLessThanOrEqual(rowBox.right + 1);
    await expect(pillBox.height).toBeCloseTo(34, 0);

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
