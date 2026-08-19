import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { UserProfile } from '@/app/features/users/types/profile';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import ProfileEditModal from './ProfileEditModal';

const ORG_ID = 'org-storybook-profile';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

const MEMBERSHIP: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/practitioner-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Business owner',
  active: true,
};

const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1988-04-12',
    phoneNumber: '+1 415 555 0110',
    address: {
      addressLine: '1180 Sutter Street',
      city: 'San Francisco',
      state: 'California',
      postalCode: '94109',
      country: 'United States',
    },
  },
  professionalDetails: {
    linkedin: 'https://www.linkedin.com/in/elena-marsh-dvm',
    medicalLicenseNumber: 'CA-VET-44821',
    yearsOfExperience: 11,
    specialization: 'Small animal internal medicine',
    qualification: 'DVM, DACVIM',
    biography: 'Internal medicine lead, with an interest in feline endocrinology.',
  },
};

/**
 * Seeds the real stores.
 *
 * `ProfileDetails` returns `null` unless all three of `attributes`, `org` and
 * `membership` are present, so a story that seeded only some of them would render an
 * "Edit profile" panel containing nothing but the Security card - and every "the
 * panel opened" assertion would still pass. All three are seeded, and the stories
 * assert the cards rather than the panel.
 *
 * Nothing here fetches on mount. The one request the panel does make is the Security
 * card's `GET /v1/auth/mfa/status`, which has no stub and is swallowed by the
 * component's own catch; that is what leaves the resting security state below.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
    error: null,
  });
  useUserProfileStore.setState({
    profilesByOrgId: { [ORG_ID]: PROFILE },
    status: 'loaded',
    error: null,
  });
  useAuthStore.setState({
    attributes: {
      sub: 'user-1',
      given_name: 'Elena',
      family_name: 'Marsh',
      email: 'elena.marsh@example.com',
    },
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
      error: null,
    });
    useUserProfileStore.setState({ profilesByOrgId: {}, status: 'idle', error: null });
    useAuthStore.setState({ attributes: null });
  };
};

/** `showModal` is the caller's state, so the harness holds it for the close control. */
const ProfileEditor = ({ open }: { open: boolean }) => {
  const [showModal, setShowModal] = useState(open);
  return (
    <div className="min-h-[760px] bg-[var(--page)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Settings page behind the scrim, so the backdrop tint and blur are visible.
      </p>
      <ProfileEditModal showModal={showModal} setShowModal={setShowModal} />
    </div>
  );
};

/** `ModalBase` portals to `document.body`, so the panel is never inside `canvasElement`. */
const openPanel = (): Promise<HTMLElement> =>
  waitFor(() => {
    const panel = document.querySelector('dialog[open]');
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
  });

/**
 * The right-hand cell of a read-only `FieldValueRow`. Reading the sibling rather
 * than searching for the value text is what makes "First name is Elena" an
 * assertion about the row and not about the panel containing the word somewhere.
 */
const fieldValue = (panel: HTMLElement, label: string): string =>
  within(panel).getByText(label).nextElementSibling?.textContent ?? '';

const meta = {
  title: 'Settings/ProfileEditModal',
  component: ProfileEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Everything behind the Settings Personal card\'s "Edit profile" button. The page ' +
          'itself is a compact control panel by design, so all the detailed personal-profile ' +
          'editing was moved in here - and then nothing drew it, at any size.\n\n' +
          'It is a centered `lg` Modal (840px) holding **four** cards in one scroll ' +
          'container: `ProfileDetails` contributes User profile, Address and Professional ' +
          'details, and `SecuritySection` adds the authenticator controls. Each profile card ' +
          'has two shapes - a read-only list of label/value rows, and, once its round Edit ' +
          'button is pressed, a form where only the `editable` fields become inputs while the ' +
          'rest stay as value rows. That mixed read/write shape is the thing to look at, and ' +
          'it is drawn below.\n\n' +
          '`ProfileDetails` renders nothing at all unless auth attributes, the org and the ' +
          'membership are all present, so the panel has a genuinely empty form of itself that ' +
          'still opens and still says "Edit profile". The stories assert the cards for that ' +
          'reason.',
      },
    },
  },
  tags: ['autodocs'],
  args: { open: true },
  beforeEach: seed,
} satisfies Meta<typeof ProfileEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    await expect(dialog.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument();
    // The centered `lg` width from the Modal recipe, on the border box.
    await expect(panel.getBoundingClientRect().width).toBeCloseTo(840, 0);

    // Four cards in ONE scroll container, not four stacked panels.
    await expect(dialog.getByText('User profile')).toBeInTheDocument();
    await expect(dialog.getByText('Address')).toBeInTheDocument();
    await expect(dialog.getByText('Professional details')).toBeInTheDocument();
    await expect(dialog.getByText('Security')).toBeInTheDocument();
    const scroller = dialog.getByText('User profile').closest('.overflow-y-auto') as HTMLElement;
    await expect(scroller.children).toHaveLength(2);
    await expect(getComputedStyle(scroller).overflowY).toBe('auto');

    // Three round Edit affordances, one per profile card. Security has none - its
    // controls are always live.
    await expect(dialog.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);

    // Real values in the read-only rows, from the seeded profile and auth attributes.
    await expect(fieldValue(panel, 'First name')).toBe('Elena');
    await expect(fieldValue(panel, 'Email address')).toBe('elena.marsh@example.com');
    await expect(fieldValue(panel, 'Org name')).toBe('Sunrise Veterinary Hospital');
    await expect(fieldValue(panel, 'Address line')).toBe('1180 Sutter Street');
    await expect(fieldValue(panel, 'Specialisation')).toBe('Small animal internal medicine');

    /* The security card at rest. `GET /v1/auth/mfa/status` has no stub here, the
       component swallows the failure, and `mfaStatus` stays null - which is exactly
       the state a real user gets when that endpoint is down: the copy says "Not
       enabled" (indistinguishable from a genuine "off") and the only control is
       disabled with nothing explaining why. */
    await expect(dialog.getByTestId('totp-status')).toHaveTextContent(
      'Authenticator app: Not enabled'
    );
    await expect(dialog.getByRole('button', { name: 'Set up authenticator app' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as it opens. Every field is a read-only row: 13px `--ink-faint` label ' +
          'left, 13px medium `--ink-body` value right, hairline dividers between them and ' +
          'none after the last one.\n\n' +
          'The unresolved MFA state at the bottom is worth a decision. A failed status call ' +
          'and a real "not set up" look identical, and the button is disabled either way, so ' +
          'someone who cannot reach the endpoint has no way to tell that setup is unavailable ' +
          'rather than untried.',
      },
    },
  },
};

export const EditingIdentity: Story = {
  name: 'Editing the User profile card',
  play: async () => {
    const panel = await openPanel();
    const dialog = within(panel);

    await expect(dialog.queryByRole('textbox', { name: 'First name' })).not.toBeInTheDocument();

    await userEvent.click(dialog.getByRole('button', { name: 'Edit User profile' }));

    // Editable fields became controls, seeded from the values that were on screen.
    const firstName = await dialog.findByRole('textbox', { name: 'First name' });
    await expect(firstName).toHaveValue('Elena');
    await expect(dialog.getByRole('textbox', { name: 'Last name' })).toHaveValue('Marsh');
    await expect(dialog.getByRole('textbox', { name: 'Phone number' })).toHaveValue(
      '+1 415 555 0110'
    );
    await expect(dialog.getByRole('button', { name: /^Gender/ })).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: /^Country/ })).toBeInTheDocument();

    /* The half-and-half shape this card is really in while editing: `editable: false`
       fields do NOT become inputs, they stay as value rows in the middle of the form.
       Email, org name, role and employment type are all identity the user cannot
       change here, so the card mixes 44px fields with 13px text rows. */
    await expect(dialog.queryByRole('textbox', { name: 'Email address' })).not.toBeInTheDocument();
    await expect(fieldValue(panel, 'Email address')).toBe('elena.marsh@example.com');
    await expect(fieldValue(panel, 'Role')).toBe('Business owner');

    // The other two cards did not follow it into edit mode.
    await expect(dialog.queryByRole('textbox', { name: 'Address line' })).not.toBeInTheDocument();
    await expect(dialog.getAllByRole('button', { name: /^Edit / })).toHaveLength(2);

    // The footer only exists while editing.
    const save = dialog.getByRole('button', { name: 'Save' });
    await expect(save).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(dialog.queryByRole('textbox', { name: 'First name' })).not.toBeInTheDocument()
    );
    await expect(dialog.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(fieldValue(panel, 'First name')).toBe('Elena');
    await expect(dialog.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Edit is per card, not per panel: pressing one card's Edit leaves the other two " +
          'read-only, so the panel can hold a form and two lists at once. The Cancel/Save ' +
          'footer belongs to the editing card and is right-aligned above its own hairline.\n\n' +
          'Cancel rebuilds the form values from the props, so it really does discard - unlike ' +
          'the hours editor next door, which keeps an abandoned edit until the store changes.',
      },
    },
  },
};

export const PhoneSheet: Story = {
  name: 'Phone: the panel as a bottom sheet',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert: a story using it renders the 840px desktop panel
  // under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // `useIsPhone` is false during the first client render, so the sheet class
    // arrives on a second pass rather than on mount.
    const panel = await waitFor(() => {
      const sheet = document.querySelector('dialog[open].yc-modal-sheet');
      expect(sheet).not.toBeNull();
      return sheet as HTMLElement;
    });
    const dialog = within(panel);

    /* The pin, checked rather than trusted. The sheet skin lives entirely inside a
       `max-width: 767px` media query, so if the `mobile` global had not applied this
       story would draw the 840px centered panel - and the `dialog[open].yc-modal-sheet`
       wait above is the only thing that would notice. Measuring the width says which
       of the two shapes is actually on screen. */
    await expect(window.innerWidth).toBe(375);
    /* Measured against the layout viewport rather than a hard 375, so a scrollbar
       cannot turn a correct full-bleed sheet into a failure. `left: 0; right: 0` is
       what makes it full-bleed; the desktop panel would be 840 and centered. */
    const viewport = document.documentElement;
    const box = panel.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(viewport.clientWidth, 0);
    // Anchored to the bottom edge and capped at 86vh, per the sheet rule.
    await expect(box.bottom).toBeCloseTo(viewport.clientHeight, 0);
    // `vh` resolves against the initial containing block, so the cap is checked
    // against innerHeight rather than clientHeight.
    await expect(box.height).toBeLessThanOrEqual(window.innerHeight * 0.86 + 1);

    // The grabber and the 24px top radius from the phone adaptation rule.
    await expect(panel.querySelector('.yc-phone-sheet-grabber')).not.toBeNull();
    await expect(getComputedStyle(panel).borderTopLeftRadius).toBe('24px');

    // All four cards survive the re-form; the sheet scrolls rather than dropping any.
    await expect(dialog.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument();
    await expect(dialog.getByText('User profile')).toBeInTheDocument();
    await expect(dialog.getByText('Address')).toBeInTheDocument();
    await expect(dialog.getByText('Professional details')).toBeInTheDocument();
    await expect(dialog.getByText('Security')).toBeInTheDocument();
    await expect(dialog.getAllByRole('button', { name: /^Edit / })).toHaveLength(3);

    /* The rows carry their real values at 375px too. The label/value row is a
       `justify-between` flex with no wrap, so this is where a long value would be
       squeezed against its label rather than dropping to a second line - the
       assertion pins the content, and the snapshot shows the squeeze. */
    await expect(fieldValue(panel, 'First name')).toBe('Elena');
    await expect(fieldValue(panel, 'Email address')).toBe('elena.marsh@example.com');
    await expect(fieldValue(panel, 'Address line')).toBe('1180 Sutter Street');
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Under 768px the centered panel re-forms into a bottom sheet: grabber, 24px top ' +
          'radius, capped at 86vh. Four cards of label/value rows inside that cap is a long ' +
          'scroll on a phone, and the sheet is the only thing between the header and the ' +
          'footer that moves - so this is where to check whether the panel wants a phone ' +
          'layout of its own rather than the desktop stack at 375px.',
      },
    },
  },
};
