import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { CompanionCardDTO } from '@yosemite-crew/types';

import CompanionIdCard from './CompanionIdCard';

/**
 * A staff-audience card with every block populated, which is the only case where
 * all twelve detail rows exist at once. `photoUrl` is left off on purpose:
 * `getSafeImageUrl` then resolves the bundled species placeholder out of
 * `/images`, so the card never reaches for a remote host.
 */
const STAFF_CARD: CompanionCardDTO = {
  audience: 'STAFF',
  identity: {
    id: 'companion-kizie',
    name: 'Kizie',
    type: 'dog',
    breed: 'Beagle',
    colour: 'Tricolour',
    microchipNumber: '953010001234567',
  },
  passportNumber: 'GB40123456',
  dateOfBirth: '2019-04-18',
  alerts: [
    { title: 'Anaphylaxis risk', severity: 'critical' },
    { title: 'Nervous around other dogs', severity: 'medium' },
  ],
  ownerContact: {
    firstName: 'Sky',
    lastName: 'Doe',
    phoneNumber: '+44 7700 900412',
    email: 'sky.doe@example.com',
  },
  medical: {
    allergy: 'Penicillin',
    bloodGroup: 'DEA 1.1 negative',
    currentWeight: 24,
    isNeutered: true,
  },
  insurance: { isInsured: true, companyName: 'Petplan' },
  latestVisit: { status: 'Completed', occurredAt: '2026-07-30T09:15:00.000Z' },
};

/** The public projection: identity, a chip number and a birth date, nothing else. */
const PUBLIC_CARD: CompanionCardDTO = {
  audience: 'PUBLIC',
  identity: {
    id: 'companion-kizie',
    name: 'Kizie',
    type: 'dog',
    breed: 'Beagle',
    microchipNumber: '953010001234567',
  },
  dateOfBirth: '2019-04-18',
  alerts: [{ title: 'Anaphylaxis risk', severity: 'critical' }],
};

/** The detail block, reached from one of its labels rather than by nth-child. */
const detailRows = (label: HTMLElement): HTMLElement => {
  const row = label.closest('.justify-between') as HTMLElement;
  return row.parentElement as HTMLElement;
};

/**
 * The value printed opposite a label, scoped to that label's own row.
 *
 * Scoped rather than looked up globally because a bare text query is answered by
 * the whole canvas - including the preview decorator's sr-only `<h1>` - and
 * because several of these values are short enough to collide with each other.
 */
const valueFor = (label: HTMLElement): string =>
  (label.nextElementSibling?.textContent ?? '').trim();

const meta = {
  title: 'Cards/CompanionIdCard',
  component: CompanionIdCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The companion card as it is handed to someone outside the practice: an avatar/name/species ' +
          'header, the alert pills, and a two-column list of the twelve identity, medical, insurance ' +
          'and owner-contact rows.\n\n' +
          'It had never been drawn because neither consumer can render it synchronously. The public ' +
          'route `/card/[token]` resolves a share token before it has a card at all, and ' +
          '`ShareCompanionCardModal` fetches on open - so in both places the whole card body is ' +
          'behind an await, and a static snapshot of either surface shows a spinner.\n\n' +
          'What the stories are for is the **redaction**. `CompanionCardDTO` is an audience-scoped ' +
          'projection: everything past `identity` is optional, and `DetailRow` returns null for an ' +
          'undefined or empty value, so a card omits rows rather than printing blanks. The same ' +
          'component therefore renders twelve rows for a staff card and two for a public one, with ' +
          'nothing in the markup announcing which is which. Comparing the two frames below is the ' +
          'only way to see it.\n\n' +
          'Severity is the other silent detail: `critical` and `high` share the warning tint, ' +
          '`medium` and `low` share the neutral card tint, so four severities render as two pills.',
      },
    },
  },
  tags: ['autodocs'],
  args: { card: STAFF_CARD },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionIdCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaffCard: Story = {
  name: 'Staff audience (all twelve rows)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Kizie')).toBeInTheDocument();
    // The species header is a single interpolated string, not two nodes.
    await expect(canvas.getByText('Beagle / Canine')).toBeInTheDocument();

    /* Row COUNT, not "a row appeared": every row is gated on its own value, so a
       projection that dropped the medical block would still satisfy any single
       label lookup. Twelve is the maximum this component can render. */
    const rows = detailRows(canvas.getByText('Microchip'));
    await expect(rows.children).toHaveLength(12);
    /* Each value read opposite its OWN label, below. `neuteredLabel` turns the
       boolean into Yes/No - false would print "No", and only `undefined` drops
       the row - and `insuranceLabel` prefers the company name over a bare
       "Insured", so both of those cells are a function of the DTO rather than a
       copy of it. */
    await expect(valueFor(canvas.getByText('Blood group'))).toBe('DEA 1.1 negative');
    await expect(valueFor(canvas.getByText('Owner'))).toBe('Sky Doe');

    /* The date is run through `formatDisplayDate`, so the exact layout belongs to
       the formatter and is not what this story is pinning. The year IS the data,
       and it is read out of the Date of birth row rather than matched loose
       against the canvas. */
    await expect(valueFor(canvas.getByText('Date of birth'))).toContain('2019');
    await expect(valueFor(canvas.getByText('Microchip'))).toBe('953010001234567');
    await expect(valueFor(canvas.getByText('Neutered'))).toBe('Yes');
    await expect(valueFor(canvas.getByText('Insurance'))).toBe('Petplan');
    await expect(valueFor(canvas.getByText('Weight (lbs)'))).toBe('24');

    /* Two severities, two tints. Read after the frame settles rather than in the
       same tick as the mount. */
    const critical = canvas.getByText('Anaphylaxis risk');
    const medium = canvas.getByText('Nervous around other dogs');
    await waitFor(() => {
      expect(getComputedStyle(critical).backgroundColor).not.toBe(
        getComputedStyle(medium).backgroundColor
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything the projection can carry. The alert pills wrap above the detail list, so a ' +
          'companion with several alerts pushes the rows down rather than clipping.',
      },
    },
  },
};

export const PublicCard: Story = {
  name: 'Public audience (redacted)',
  args: { card: PUBLIC_CARD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = detailRows(canvas.getByText('Microchip'));
    await expect(rows.children).toHaveLength(2);

    /* Named one by one rather than inferred from the count: a redaction bug that
       dropped the microchip row and kept the owner phone would also leave two. */
    await expect(canvas.queryByText('Owner')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Owner phone')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Owner email')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Insurance')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Blood group')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Passport')).not.toBeInTheDocument();

    // The header and the alert survive redaction - that is the point of the card.
    await expect(canvas.getByText('Kizie')).toBeInTheDocument();
    await expect(canvas.getByText('Anaphylaxis risk')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a stranger who scans the tag sees. The card keeps its full shell and header and ' +
          'simply has fewer rows in it, which is why this frame is worth holding next to the staff ' +
          'one rather than reading the DTO.',
      },
    },
  },
};

export const NoAlerts: Story = {
  name: 'No alerts',
  args: { card: { ...STAFF_CARD, alerts: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Anaphylaxis risk')).not.toBeInTheDocument();

    /* The pill row is gated on `alerts && alerts.length > 0`, so an empty array
       removes the whole flex-wrap container, not just its contents - the header
       and the detail list end up one 16px gap apart instead of two. Measured
       here, because an absent pill proves nothing about the gap that is left. */
    const header = canvas.getByText('Kizie').closest('.flex.items-center') as HTMLElement;
    const rows = detailRows(canvas.getByText('Microchip'));
    const gap = rows.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    await expect(Math.round(gap)).toBe(16);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Most companions have no alerts, so this is the common card. Worth checking that the ' +
          'header does not end up sitting on the detail list when the pill row is gone.',
      },
    },
  },
};

export const PhoneWidth: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10, so the old spelling renders the full panel width and quietly
  // proves nothing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The rows are `flex justify-between` with a 12px gap and no wrapping rule,
       so the longest value is the one that decides whether the card holds. The
       owner email must stay inside the card's padding box at 375. */
    const card = canvas.getByText('Kizie').closest('.rounded-2xl') as HTMLElement;
    const email = canvas.getByText('sky.doe@example.com');
    const cardRect = card.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(card).paddingRight);
    await expect(email.getBoundingClientRect().right).toBeLessThanOrEqual(
      cardRect.right - padding + 1
    );

    // Label and value share a row rather than stacking: same top edge.
    const label = canvas.getByText('Owner email');
    await expect(Math.round(label.getBoundingClientRect().top)).toBe(
      Math.round(email.getBoundingClientRect().top)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The public card is opened from a phone camera more than anywhere else, and a 320px-wide ' +
          'reading of it is the realistic one. `text-right` on the value keeps the long strings - ' +
          'email, chip number - aligned to the card edge instead of drifting under the label.',
      },
    },
  },
};
