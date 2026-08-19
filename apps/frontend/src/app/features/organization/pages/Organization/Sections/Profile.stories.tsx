import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import Profile from './Profile';

const ORG_ID = 'org-storybook-profile';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  website: 'sunrisevet.example',
  taxId: 'DE-8871-2290',
  DUNSNumber: '15-048-3782',
  isVerified: true,
  isActive: true,
  address: {
    addressLine: '18 Larkspur Way',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
  appointmentCheckInBufferMinutes: 10,
  appointmentCheckInRadiusMeters: 150,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/** RECEPTIONIST holds no `org:edit`, which is the only thing gated on this screen. */
const RECEPTIONIST: UserOrganization = {
  ...OWNER,
  id: 'membership-reception',
  roleCode: 'RECEPTIONIST',
};

/**
 * Seeds the org store rather than mocking `usePermissions`. The three edit cards
 * also read `usePrimaryOrg` for the id they hand the logo endpoints - without it
 * `LogoUpdator` renders permanently disabled, which is a different picture from
 * the one the product shows.
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

/** The `label | value` row of a read card: a flex row of exactly two divs. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

const meta = {
  title: 'Organization/Profile',
  component: Profile,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The organisation identity section, which is really two entirely different screens ' +
          'behind one `isEditing` flag. Only the resting one had ever been drawn.\n\n' +
          'The pencil does not open a form inside the band - it **replaces the band**. Resting, ' +
          'this is one wide card: a 62px monogram tile, the name in Newsreader at 24px, three ' +
          'status pills, and two dense meta lines that fold the address, phone, website, tax id, ' +
          'both check-in numbers and the DUNS into `·`-joined sentences. Editing, all of that ' +
          'is gone and in its place are a serif page heading, a `Done` pill and three stacked ' +
          'label/value cards, each with its own pencil and its own save handler.\n\n' +
          'So the two states share no markup at all, which is why a snapshot of either one ' +
          'proves nothing about the other, and why the swap itself is the thing worth a ' +
          'story.\n\n' +
          '`org:edit` is the only permission involved and it gates only the pencil: a role ' +
          'without it gets the full band and no way out of it, which is a deliberately quiet ' +
          'denial with no message attached.',
      },
    },
  },
  tags: ['autodocs'],
  args: { primaryOrg: ORG },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] w-[900px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof Profile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Band: Story = {
  name: 'Resting band',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sunrise Veterinary Hospital')).toBeInTheDocument();

    // Two derived sentences, asserted whole. Each is a `·`-join over four or five
    // optional fields, so a dropped field leaves a valid-looking shorter line.
    await expect(
      canvas.getByText(
        '18 Larkspur Way, 10405 Berlin · 4155550110 · sunrisevet.example · Tax ID DE-8871-2290'
      )
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Check-in buffer: 10 min · Check-in radius: 150 m · DUNS 15-048-3782')
    ).toBeInTheDocument();

    // Verified is a pill swap, not a badge that appears: unverified reads PENDING.
    await expect(canvas.getByText('VERIFIED')).toBeInTheDocument();
    await expect(canvas.queryByText('PENDING')).not.toBeInTheDocument();
    await expect(canvas.getByText('HOSPITAL')).toBeInTheDocument();

    await expect(canvas.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    // None of the edit-mode tree exists yet.
    await expect(canvas.queryByText('Edit organization profile')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting band. The monogram is the FIRST initial only - `initialsOf` returns up ' +
          'to two and the avatar takes `charAt(0)` - so a two-word clinic name renders one ' +
          'letter here and two on a team member’s row elsewhere on the same page.',
      },
    },
  },
};

export const Unverified: Story = {
  name: 'Unverified org',
  args: { primaryOrg: { ...ORG, isVerified: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('PENDING')).toBeInTheDocument();
    await expect(canvas.queryByText('VERIFIED')).not.toBeInTheDocument();

    /* Verification changes the PILL only, so the rest of the band is asserted
       whole rather than left implied: the type pill beside it, both derived meta
       sentences and the pencil all have to survive, otherwise `isVerified` is
       gating more than the design says it does. */
    await expect(canvas.getByText('HOSPITAL')).toBeInTheDocument();
    await expect(
      canvas.getByText(
        '18 Larkspur Way, 10405 Berlin · 4155550110 · sunrisevet.example · Tax ID DE-8871-2290'
      )
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Check-in buffer: 10 min · Check-in radius: 150 m · DUNS 15-048-3782')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The amber PENDING pill sits in the same slot as the green VERIFIED one, shield glyph ' +
          'and all removed, so the row does not reflow when a clinic is verified.',
      },
    },
  },
};

export const EditMode: Story = {
  name: 'Edit mode (band replaced)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));

    /* The band is GONE, not collapsed. Its two meta sentences are the safe
       signal: the verified pill is NOT, because the first edit card renders its
       own pill whose label is the sentence-case "Verified" while the band's is
       the literal "VERIFIED". Case-sensitive queries keep the two apart, but a
       reviewer reading `queryByText('VERIFIED')` here would reasonably assume
       there is only one pill on this screen. */
    await waitFor(() =>
      expect(
        canvas.queryByText('Check-in buffer: 10 min · Check-in radius: 150 m · DUNS 15-048-3782')
      ).not.toBeInTheDocument()
    );
    await expect(
      canvas.queryByText(
        '18 Larkspur Way, 10405 Berlin · 4155550110 · sunrisevet.example · Tax ID DE-8871-2290'
      )
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();

    // In its place: the serif heading, the Done pill and the three cards.
    await expect(canvas.getByText('Edit organization profile')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    await expect(canvas.getByText('Organization')).toBeInTheDocument();
    await expect(canvas.getByText('Address')).toBeInTheDocument();
    await expect(canvas.getByText('Check-in settings')).toBeInTheDocument();

    /* The cards read the same record the band did - assert the ROW, so a value
       rendered under the wrong label cannot pass. `Country` is the interesting
       one: it is lifted out of `address` because `BasicFields` addresses it by a
       top-level key, so it is the field that silently empties if that lift is
       dropped. */
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
    await expect(rowOf(canvas.getByText('Country')).textContent).toBe('CountryGermany');
    await expect(rowOf(canvas.getByText('Postal code')).textContent).toBe('Postal code10405');

    // Each card owns its own pencil and its own save handler.
    for (const card of ['Organization', 'Address', 'Check-in settings']) {
      await expect(canvas.getByRole('button', { name: `Edit ${card}` })).toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. Note there is no Cancel: `Done` only flips `isEditing` back, ' +
          'because each card already saved itself when its own pencil was closed. Nothing on ' +
          'this screen is pending when it is dismissed.',
      },
    },
  },
};

export const DoneReturnsToBand: Story = {
  name: 'Done returns to the band',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    const done = await canvas.findByRole('button', { name: 'Done' });
    await expect(done).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));

    await waitFor(() =>
      expect(canvas.queryByText('Edit organization profile')).not.toBeInTheDocument()
    );
    // The band comes back reading the form's state, not the original prop, which
    // is what makes an edit visible without waiting for the page to refetch.
    await expect(
      canvas.getByText('Check-in buffer: 10 min · Check-in radius: 150 m · DUNS 15-048-3782')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The round trip. `useOrgProfileForm` holds `formData` above the swap, so the band ' +
          'rebuilds from whatever the cards last saved - the two states share a record even ' +
          'though they share no markup.',
      },
    },
  },
};

export const WithoutEditPermission: Story = {
  name: 'Pencil hidden without org:edit',
  beforeEach: seed(RECEPTIONIST),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    // Everything else is untouched: this is a quiet denial with no message.
    await expect(canvas.getByText('Sunrise Veterinary Hospital')).toBeInTheDocument();
    await expect(canvas.getByText('VERIFIED')).toBeInTheDocument();
    await expect(
      canvas.getByText('Check-in buffer: 10 min · Check-in radius: 150 m · DUNS 15-048-3782')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without `org:edit` the band loses its only control and the edit screen becomes ' +
          'unreachable - there is no other route to `isEditing`, so the three cards behind it ' +
          'are dead code for this role rather than read-only.',
      },
    },
  },
};
