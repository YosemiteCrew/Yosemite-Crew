import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import {
  BasicFields,
  CheckInFields,
} from '@/app/features/organization/pages/Organization/Sections/profileFields';
import ProfileCard from './ProfileCard';

const ORG_ID = 'org-storybook-profilecard';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
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

const membership: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/**
 * The record shape the real caller passes: the org flattened, with `country`
 * lifted out of `address` because `BasicFields` addresses it by a top-level key.
 */
const ORG_RECORD: Record<string, unknown> = { ...ORG, country: ORG.address?.country };

const CHECK_IN_RECORD: Record<string, unknown> = {
  appointmentCheckInBufferMinutes: ORG.appointmentCheckInBufferMinutes,
  appointmentCheckInRadiusMeters: ORG.appointmentCheckInRadiusMeters,
};

/**
 * The `label | value` row that owns a label cell, given the label element.
 *
 * `FieldValueRow` is a flex row of exactly two divs, so the label's parent IS the
 * row. Asserting `row.textContent` rather than two separate `getByText`s is what
 * proves the PAIRING: a renamed field key leaves both texts on screen, in
 * different rows, and every existence assertion still passes.
 */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

/** Exactly the six `BasicFields` labels, so a row count cannot be met by other text. */
const BASIC_LABELS =
  /^(Organization type|Organization name|Tax ID|Country|DUNS number|Phone number)$/;

/**
 * Seeds the org store rather than mocking the hooks. The card reads
 * `usePrimaryOrg` only for the id it hands the two logo endpoints - without it
 * `LogoUpdator` renders permanently disabled, which is a different picture from
 * the one the product shows.
 */
const seedOrg = () => {
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

const meta = {
  title: 'Organization/ProfileCard',
  component: ProfileCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The label/value card behind **six surfaces**: the three organization cards ' +
          '(Organization, Address, Check-in settings) and the three Settings profile cards ' +
          '(User profile, Address, Professional details). Every one of them is driven by the ' +
          'same `fields` array, and none of them had a story.\n\n' +
          'The pencil swaps the card body for a different tree, not for an editable version of ' +
          'the same one. Read rows are a two-column `label | value` line with a hairline under ' +
          'every row but the last; the edit body is a stack of 44px inputs with no dividers at ' +
          'all, plus an action row that only exists while editing.\n\n' +
          'The swap is partial, which is the part worth reviewing: only fields flagged ' +
          '`editable` become inputs. A field that is `required` but not `editable` (organization ' +
          'type, name, email) stays a read row inside the open form and is skipped by ' +
          '`validate()` entirely, so it can never block a save. Values also live in the card, ' +
          'not the caller: Cancel rebuilds them from the `org` prop, and a successful Save keeps ' +
          'the edited values on screen without waiting for the parent to send fresh ones down.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Organization',
    fields: BasicFields,
    org: ORG_RECORD,
    showProfile: true,
    onSave: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full bg-[var(--page)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedOrg,
} satisfies Meta<typeof ProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Read rows',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The name is drawn twice on purpose: once in the identity band that
    // `showProfile` adds, once as the `Organization name` row below it.
    await expect(canvas.getAllByText('Sunrise Veterinary Hospital')).toHaveLength(2);
    await expect(canvas.getByText('Verified')).toBeInTheDocument();

    /* Label and value asserted as ONE row, not as two texts that happen to be on
       screen. Selects resolve through their options on the way, so the row reads
       the option label and never the stored code - HOSPITAL is what the record
       holds and Hospital is what the row must say. */
    await expect(rowOf(canvas.getByText('Organization type')).textContent).toBe(
      'Organization typeHospital'
    );
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
    await expect(rowOf(canvas.getByText('Country')).textContent).toBe('CountryGermany');
    await expect(rowOf(canvas.getByText('Phone number')).textContent).toBe(
      'Phone number4155550110'
    );
    await expect(canvas.queryByText('HOSPITAL')).toBeNull();

    /* Six rows, and the hairline sits on every one but the last: `showDivider` is
       `index !== fields.length - 1`, so adding a field silently moves the rule and
       the regression is a card that ends on a hairline. Read as computed style,
       because the class is conditional and its absence is invisible in the tree. */
    await expect(canvas.getAllByText(BASIC_LABELS)).toHaveLength(6);
    await expect(getComputedStyle(rowOf(canvas.getByText('Tax ID'))).borderBottomWidth).not.toBe(
      '0px'
    );
    await expect(getComputedStyle(rowOf(canvas.getByText('Phone number'))).borderBottomWidth).toBe(
      '0px'
    );

    // Nothing editable is mounted at rest, and the action row does not exist yet.
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Edit Organization' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting card. Labels are `--ink-faint` on the left, values are ' +
          '`--ink-body` medium and right-aligned, and the last row deliberately has no rule ' +
          'under it so the card does not end on a hairline.',
      },
    },
  },
};

export const Editing: Story = {
  name: 'Edit form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Organization' }));

    /* Four of the six fields are editable, and one of those four is a dropdown -
       so three textboxes, not six inputs. Type and name keep their read rows
       inside the open form. */
    const textboxes = await canvas.findAllByRole('textbox');
    await expect(textboxes).toHaveLength(3);
    await expect(canvas.getByRole('textbox', { name: 'Tax ID' })).toHaveValue('DE-8871-2290');
    await expect(canvas.getByRole('textbox', { name: 'DUNS number' })).toHaveValue('15-048-3782');
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('4155550110');
    await expect(canvas.getByRole('button', { name: 'Country: Germany' })).toHaveAttribute(
      'aria-haspopup',
      'listbox'
    );
    await expect(canvas.getByText('Organization type')).toBeInTheDocument();
    await expect(canvas.getByText('Hospital')).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Organization name' })).toBeNull();

    // The pencil is gone while the form is open; the actions are the only way out.
    await expect(canvas.queryByRole('button', { name: 'Edit Organization' })).toBeNull();

    /* The action row is flex, not grid - there is no grid template to read here.
       What can silently break is the pairing: both actions have to stay in the one
       end-aligned row rather than wrap or stretch to full width. */
    const save = canvas.getByRole('button', { name: 'Save' });
    const footer = save.parentElement as HTMLElement;
    await expect(footer.children).toHaveLength(2);
    await expect(within(footer).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const footerStyle = getComputedStyle(footer);
    await expect(footerStyle.display).toBe('flex');
    await expect(footerStyle.justifyContent).toBe('flex-end');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tree the pencil reveals. Both controls are 44px tall on `--field-bg` with a ' +
          '1.5px `--hairline` border, so the text input and the dropdown trigger line up: they ' +
          'are separate components and the two heights have drifted apart before.',
      },
    },
  },
};

export const ValidationBlocksSave: Story = {
  name: 'Required field blocks Save',
  // Its own spy, so the assertion below cannot be satisfied or broken by a call
  // another story made to a shared one.
  args: { onSave: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Organization' }));
    await userEvent.clear(await canvas.findByRole('textbox', { name: 'Tax ID' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    // One alert, naming the field. The card stays open and nothing was sent up.
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Tax ID is required');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(args.onSave).not.toHaveBeenCalled();

    /* DUNS number is the control: not required, cleared, and still no error - so
       the alert above came from the required flag rather than from emptiness. */
    await userEvent.clear(canvas.getByRole('textbox', { name: 'DUNS number' }));
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);

    // Typing clears the error for that field on the keystroke, not on the next save.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tax ID' }), 'DE-9999-0001');
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull());
  },
  parameters: {
    docs: {
      description: {
        story:
          '`validate()` walks only the fields that are both `required` and `editable`, so a ' +
          'required-but-locked field can never trap the user in a form with no way to satisfy ' +
          'it. The message is the field label plus " is required", rendered under the input in ' +
          '`--danger` with the border switched to match.',
      },
    },
  },
};

export const SaveExitsEditing: Story = {
  name: 'Save returns to read rows',
  args: { onSave: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Organization' }));
    const taxId = await canvas.findByRole('textbox', { name: 'Tax ID' });
    await userEvent.clear(taxId);
    await userEvent.type(taxId, 'DE-4410-7788');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(args.onSave).toHaveBeenCalledTimes(1));
    /* The whole form is handed up, not a diff - including the fields that were
       never editable, which is what lets the caller spread it straight onto the
       org record. */
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        taxId: 'DE-4410-7788',
        name: 'Sunrise Veterinary Hospital',
        type: 'HOSPITAL',
        country: 'Germany',
      })
    );

    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull());
    /* The whole read body is back - all six rows, not just the one that changed -
       and the edited value stays on screen: the card renders its own state, not
       the `org` prop, so it does not blank out while the parent round-trips. */
    await expect(canvas.getAllByText(BASIC_LABELS)).toHaveLength(6);
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-4410-7788');
    await expect(rowOf(canvas.getByText('Country')).textContent).toBe('CountryGermany');
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Edit Organization' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole form goes up, not a diff, which is what lets a caller spread it straight ' +
          'onto its record. Exiting edit mode is conditional on the promise resolving: a ' +
          'rejected `onSave` is caught, logged to the console and nothing else - the card stays ' +
          'open with the typed values and says nothing to the user. There is no failure story ' +
          'here because there is no failure UI to draw.',
      },
    },
  },
};

export const CancelDiscardsEdits: Story = {
  name: 'Cancel restores the original values',
  args: { onSave: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Organization' }));
    const taxId = await canvas.findByRole('textbox', { name: 'Tax ID' });
    await userEvent.clear(taxId);
    await userEvent.type(taxId, 'NOT-SAVED-0001');
    await expect(taxId).toHaveValue('NOT-SAVED-0001');

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(canvas.queryByRole('textbox', { name: 'Tax ID' })).toBeNull());
    await expect(canvas.getByText('DE-8871-2290')).toBeInTheDocument();
    await expect(canvas.queryByText('NOT-SAVED-0001')).toBeNull();
    await expect(args.onSave).not.toHaveBeenCalled();

    // Reopening starts from the record again rather than from the abandoned edit.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Organization' }));
    const reopened = await canvas.findByRole('textbox', { name: 'Tax ID' });
    await expect(reopened).toHaveValue('DE-8871-2290');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel rebuilds the values from the `org` prop and drops the error map, so a card ' +
          'left in a failed-validation state comes back clean. There is no confirmation step - ' +
          'the discard is immediate, which is worth knowing before adding a longer form here.',
      },
    },
  },
};

export const CheckInNumbers: Story = {
  name: 'Number fields (Check-in settings)',
  args: {
    title: 'Check-in settings',
    fields: CheckInFields,
    org: CHECK_IN_RECORD,
    showProfile: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Maximum check-in distance (meters)')).toBeInTheDocument();
    await expect(canvas.getByText('150')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Check-in settings' }));

    // Number fields are spinbuttons, not textboxes - the labels are long enough
    // to wrap, which is the thing to look at here.
    const spinners = await canvas.findAllByRole('spinbutton');
    await expect(spinners).toHaveLength(2);
    await expect(
      canvas.getByRole('spinbutton', { name: 'Enable check-in this many minutes before start' })
    ).toHaveValue(10);
    await expect(
      canvas.getByRole('spinbutton', { name: 'Maximum check-in distance (meters)' })
    ).toHaveValue(150);
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third organization card, and the only one built entirely from number fields. ' +
          'Zero is a legitimate value for both of these, which is why `getRequiredError` special ' +
          'cases `0` instead of treating it as empty.',
      },
    },
  },
};

export const Unverified: Story = {
  name: 'Unverified organization',
  args: { org: { ...ORG_RECORD, isVerified: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Pending')).toBeInTheDocument();
    await expect(canvas.queryByText('Verified')).toBeNull();

    /* `Primary` renders a <button> rather than a link because its href is '#',
       so the CTA is keyboard-reachable as an action. Deliberately not clicked:
       it mounts a third-party booking iframe. */
    const cta = canvas.getByRole('button', { name: 'Verify business profile' });
    await expect(cta.tagName).toBe('BUTTON');

    // The whole note, not a prefix - it is the only explanatory copy on the card
    // and it is easy to truncate a sentence out of it without anyone noticing.
    const note = canvas.getByText(/^This short chat helps us confirm your business/);
    await expect(note.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
      'Note : This short chat helps us confirm your business and add you to our trusted network ' +
        'of verified pet professionals - so you can start connecting with clients faster.'
    );

    /* `sm:max-w-1/2` caps the note at half the band from 640px up, and this story
       renders at the project default (laptop, 1280). A dropped cap is invisible in
       the tree and only shows as a full-width paragraph, so it is measured. */
    const band = note.parentElement as HTMLElement;
    await expect(getComputedStyle(note).maxWidth).not.toBe('none');
    await expect(note.getBoundingClientRect().width).toBeLessThan(
      band.getBoundingClientRect().width * 0.6
    );

    // The rows below the band are untouched by verification state.
    await expect(canvas.getAllByText(BASIC_LABELS)).toHaveLength(6);
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verification is the only state that adds chrome to the identity band: an amber ' +
          'Pending pill, a CTA that opens the booking overlay, and an explanatory note capped ' +
          'at half the card width from `sm` up. The CTA is deliberately not clicked here - it ' +
          'mounts a third-party booking iframe.',
      },
    },
  },
};

export const NotEditable: Story = {
  name: 'Read-only (no onSave)',
  args: { onSave: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `editable` alone is not enough: the pencil needs a save handler too, so a
       caller that forgets `onSave` gets a permanently read-only card rather than
       a form whose Save silently does nothing. */
    await expect(canvas.queryByRole('button', { name: 'Edit Organization' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();

    /* The point of the story is that ONLY the affordance is gone. All six rows
       still render their pairs and the dividers still fall where they did, which
       is what separates a read-only card from a card that failed to render. */
    await expect(canvas.getAllByText(BASIC_LABELS)).toHaveLength(6);
    await expect(rowOf(canvas.getByText('Organization type')).textContent).toBe(
      'Organization typeHospital'
    );
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
    await expect(rowOf(canvas.getByText('Phone number')).textContent).toBe(
      'Phone number4155550110'
    );
    await expect(getComputedStyle(rowOf(canvas.getByText('Phone number'))).borderBottomWidth).toBe(
      '0px'
    );
    // The identity band is independent of `onSave` and keeps its logo and pill.
    await expect(canvas.getAllByText('Sunrise Veterinary Hospital')).toHaveLength(2);
    await expect(canvas.getByText('Verified')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shape the Settings cards use for a viewer without edit rights. Note the card is ' +
          'identical to the resting one minus the 38px pencil - there is no separate read-only ' +
          'treatment, no muted labels and no lock glyph, so nothing on screen tells the user ' +
          'why the card cannot be edited.',
      },
    },
  },
};
