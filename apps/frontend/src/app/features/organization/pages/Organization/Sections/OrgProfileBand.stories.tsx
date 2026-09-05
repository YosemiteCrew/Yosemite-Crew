import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import OrgProfileBand from './OrgProfileBand';

/**
 * `getSafeImageUrl` only passes an `https://` source through - anything else is
 * swapped for the default business avatar - so the logo branch has to be fed a
 * real remote URL. The CDN asset the app already ships is used rather than an
 * invented host, so the story draws the same tile the product does.
 */
const LOGO_URL = MEDIA_SOURCES.avatars.business;

const SUNRISE: Organisation = {
  _id: 'org-sunrise',
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '+33 1 44 55 66 77',
  website: 'sunrisevet.fr',
  taxId: 'FR-8871-2290',
  isVerified: true,
  isActive: true,
  imageURL: LOGO_URL,
  address: {
    addressLine: '12 Rue de Lyon',
    postalCode: '75012',
    city: 'Paris',
    country: 'France',
  },
  appointmentCheckInBufferMinutes: 15,
  appointmentCheckInRadiusMeters: 150,
  DUNSNumber: '15-048-3782',
};

const PRIMARY_META =
  '12 Rue de Lyon, 75012 Paris · +33 1 44 55 66 77 · sunrisevet.fr · Tax ID FR-8871-2290';
const SECONDARY_META = 'Check-in buffer: 15 min · Check-in radius: 150 m · DUNS 15-048-3782';

/** No logo, not yet verified, and a different business type. */
const MEADOWBROOK: Organisation = {
  _id: 'org-meadow',
  name: 'Meadowbrook Boarding',
  type: 'BOARDER',
  phoneNo: '+44 20 7946 0102',
  taxId: 'GB-4410-8821',
  isVerified: false,
};

/** A freshly created org: a name and nothing else worth printing. */
const SPARSE: Organisation = {
  _id: 'org-sparse',
  name: 'Riverside Mobile Vets',
  type: 'HOSPITAL',
  phoneNo: '',
  taxId: '',
};

/** The identity column: the pill row, then whichever meta lines survived. */
const identityColumn = (nameNode: HTMLElement) => nameNode.parentElement?.parentElement;

const meta = {
  title: 'Organization/OrgProfileBand',
  component: OrgProfileBand,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The identity header of the organisation page: avatar, name, verification pill, type ' +
          'pill, two meta lines and the Edit action.\n\n' +
          'Four things branch here and each one is a separate row of the design. The avatar is a ' +
          '62px logo when `imageURL` survives `getSafeImageUrl` and a monogram tile when it does ' +
          'not. Verification is VERIFIED (green, with a shield) or PENDING (amber) - never absent, ' +
          'so a reader can always tell which they are looking at. `canEdit` removes the Edit ' +
          'button rather than disabling it. And both meta lines are joined from optional fields, ' +
          'so an organisation with none of them must collapse to a single line rather than leave ' +
          'an empty row and a stray separator.\n\n' +
          'The two meta lines are built by different rules: the first is contact detail ' +
          '(address, phone, website, tax ID), the second is check-in configuration, and the ' +
          'second only ever appears once someone has set those numbers.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    org: SUNRISE,
    canEdit: true,
    onEdit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[860px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrgProfileBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  name: 'Verified, with a logo and full meta',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('VERIFIED')).toBeInTheDocument();
    await expect(canvas.queryByText('PENDING')).not.toBeInTheDocument();
    // The type pill prints the stored enum verbatim - it is not title-cased -
    // which is deliberate here and worth pinning next to the two-pill row.
    await expect(canvas.getByText('HOSPITAL')).toBeInTheDocument();

    // Both meta lines, joined with the middle dot. Asserted whole rather than
    // per-field: the join is the part that breaks, either by leaving a leading
    // separator or by losing a field silently.
    await expect(canvas.getByText(PRIMARY_META)).toBeInTheDocument();
    await expect(canvas.getByText(SECONDARY_META)).toBeInTheDocument();
    await expect(identityColumn(canvas.getByText(SUNRISE.name))?.children.length).toBe(3);

    /* The logo is decoration next to a name that is already text, so it carries
       an empty alt. A filename or the org name here would make every screen
       reader announce the identity twice. */
    const logo = canvasElement.querySelector('img');
    await expect(logo).not.toBeNull();
    await expect(logo).toHaveAttribute('alt', '');

    const edit = canvas.getByRole('button', { name: 'Edit profile' });
    /* 36px: `Secondary size="small"`. This pill was hand-rolled at 38px while the
       identical "Edit profile" action on Settings was hand-rolled at 34px, and
       neither height is on the primitive's 32/36/40/44 scale. The band's row
       height depends on it - the avatar is 62px, so a taller button silently
       grows the whole band. */
    await expect(Math.round(edit.getBoundingClientRect().height)).toBe(36);

    await userEvent.click(edit);
    await expect(args.onEdit).toHaveBeenCalledTimes(1);
  },
};

export const Pending: Story = {
  name: 'Unverified, monogram avatar',
  args: { org: MEADOWBROOK },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('PENDING')).toBeInTheDocument();
    await expect(canvas.queryByText('VERIFIED')).not.toBeInTheDocument();
    await expect(canvas.getByText('BOARDER')).toBeInTheDocument();

    // No logo means no <img> at all rather than a broken one pointing at the
    // fallback avatar, which is what the earlier `getSafeImageUrl` default would
    // have produced if the branch were removed.
    await expect(canvasElement.querySelector('img')).toBeNull();

    /* One glyph, not two. `initialsOf` returns up to two letters ("MB") and the
       org picker shows both, but the band takes `.charAt(0)` - so a well-meant
       tidy-up that drops the charAt changes this tile and nothing else. */
    await expect(canvas.getByText('M')).toBeInTheDocument();

    // Phone and tax ID are the only meta this org has, so the contact line
    // renders without an address and the check-in line is absent entirely.
    await expect(canvas.getByText('+44 20 7946 0102 · Tax ID GB-4410-8821')).toBeInTheDocument();
    await expect(identityColumn(canvas.getByText(MEADOWBROOK.name))?.children.length).toBe(2);
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEdit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Removed, not disabled. A member without the permission should not be shown
    // an affordance they can never use - but they still get the whole identity,
    // so nothing else may disappear with it.
    await expect(canvas.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText(PRIMARY_META)).toBeInTheDocument();
    await expect(canvas.getByText('VERIFIED')).toBeInTheDocument();
  },
};

export const Sparse: Story = {
  name: 'Nothing but a name',
  args: { org: SPARSE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both meta lines are `{value && <span>}`, so an org with no address, no
       phone, no tax ID and no check-in settings must render ONE child in the
       identity column - the pill row. An empty string rendered as a span instead
       would be invisible in a screenshot and add a 13px gap under every new org. */
    await expect(identityColumn(canvas.getByText(SPARSE.name))?.children.length).toBe(1);
    await expect(canvas.queryByText(/·/)).not.toBeInTheDocument();

    // The pills are not optional: a brand-new org still says what it is and that
    // it is waiting on verification.
    await expect(canvas.getByText('PENDING')).toBeInTheDocument();
    await expect(canvas.getByText('HOSPITAL')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the band stacks',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // The contact line is one long unbroken string on a 375px card. It has no
    // truncation, so it has to wrap inside the band rather than push the page.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below sm the band drops its `sm:flex-row`, so the avatar, the identity column and the ' +
          'Edit button stack. The button is the row to watch: it is `flex-none`, which governs the ' +
          'main axis only, so in a column it is stretched to the full card width by the default ' +
          'cross-axis alignment.',
      },
    },
  },
};
