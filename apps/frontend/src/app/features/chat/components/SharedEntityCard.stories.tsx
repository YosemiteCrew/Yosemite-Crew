import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { SharedEntityCard } from './SharedEntityCard';

/**
 * The card is the only element in the message list whose geometry is decided by the
 * *snapshot*, so the frame is a fixed 380px - wide enough for the `xl:w-[340px]` arm
 * plus a margin, so the value row is measured rather than squeezed.
 */
const CardFrame = (Story: React.ComponentType) => (
  <div data-testid="card-frame" className="w-[380px] bg-[var(--screen-2)] p-5">
    <Story />
  </div>
);

const cardRoot = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('card-frame').firstElementChild as HTMLElement;

/**
 * Computed value of a CSS custom property, read the way the browser will paint it.
 *
 * Comparing a pill's `backgroundColor` (`rgb(240, 253, 244)`) against the raw token
 * text (`#f0fdf4`) never matches, so the token is resolved through a throwaway probe -
 * and the probe is mounted in the SAME subtree as the element under test on purpose.
 * The `--status-*` set is declared three times in `globals.css`: once at the root,
 * again for dark, and again inside the PIMS-scoped block. A probe parked on
 * `document.body` would resolve a different value than the pill beside it and the
 * assertion would fail for a reason that has nothing to do with the card.
 */
const resolveToken = (near: HTMLElement, token: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  near.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

/**
 * Seeds the org whose type drives the companion noun, and restores whatever was there.
 *
 * `useCompanionTerminologyText` reads `orgStore.primaryOrgId` and that org's `type`;
 * `HOSPITAL` resolves to "patient". The store persists to localStorage, so the previous
 * state is put back rather than left pointing at a fixture clinic for every later story.
 */
const seedOrgType = (type: Organisation['type']) => () => {
  const previous = useOrgStore.getState();
  useOrgStore.setState({
    primaryOrgId: 'org-sb-shared-entity',
    orgIds: ['org-sb-shared-entity'],
    orgsById: {
      'org-sb-shared-entity': {
        _id: 'org-sb-shared-entity',
        name: 'Storybook Referral Hospital',
        type,
      } as unknown as Organisation,
    },
  });
  return () => {
    useOrgStore.setState({
      primaryOrgId: previous.primaryOrgId,
      orgIds: previous.orgIds,
      orgsById: previous.orgsById,
    });
  };
};

const meta = {
  title: 'Chat/SharedEntityCard',
  component: SharedEntityCard,
  decorators: [CardFrame],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A PIMS record shared into a conversation, as it appears inside a message bubble.\n\n' +
          'Nothing in the app can draw this without a real shared message: `ChatMessage` renders ' +
          'it only when `message.sharedEntity` is set, and that field is stamped **server-side** ' +
          'by the `/v1/chat/pms/share` endpoint. There is no local path that produces one, so the ' +
          'card had never been rendered outside a live Stream channel with a completed share - ' +
          'which is also why nobody had seen the shapes below side by side.\n\n' +
          'It is two cards, not one. `showValueRow` is `Boolean(amount || deepLink)`, and it does ' +
          'two things at once: it decides whether the second row exists **and** whether the header ' +
          'carries the `border-b` hairline. Get it wrong in one place and you either get a rule ' +
          'under nothing or a two-row card with no seam. `PRESCRIPTION` and `DOCUMENT` have no ' +
          'entry in `DEEP_LINKS`, so they are the single-row form whenever the snapshot omits an ' +
          'amount; `COMPANION`, `APPOINTMENT`, `INVOICE` and `FORM` always have a link and so are ' +
          'always two rows.\n\n' +
          'Everything after `entityType` is optional and comes from an untyped ' +
          '`Record<string, unknown>` snapshot. `readString` accepts only non-blank strings, so a ' +
          'numeric `amount`, a `null` subtitle or a whitespace status all take the same path as ' +
          'an absent one. The status tone is a lookup with a silent fallback: an unmapped status ' +
          'still renders a pill, in the `--status-requested-*` (neutral) tokens rather than ' +
          'nothing, so a backend that starts sending a new status word degrades to grey instead ' +
          'of crashing.\n\n' +
          'The `COMPANION` label and its deep-link *label* are the only strings this component ' +
          "rewrites for the org's animal noun. The href never changes, and the snapshot text is " +
          'never passed through the rewrite at all - which is what leaves a "Pet parent: …" ' +
          'subtitle standing under a heading that just became "Patient record". All three are ' +
          'asserted below.\n\n' +
          '`mine` is in the props table because the component accepts it. It is never read - an ' +
          'outgoing shared card is identical to an incoming one, and only the bubble column ' +
          'around it moves.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    entity: {
      entityType: 'INVOICE',
      entityId: 'inv-2043',
      title: 'Invoice INV-2043',
      snapshot: {
        subtitle: 'Marta Alvarez · 12 Mar 2026',
        amount: '€248.50',
        status: 'PAID',
      },
    },
  },
} satisfies Meta<typeof SharedEntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invoice: Story = {
  name: 'Invoice (both rows, status pill)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = cardRoot(canvasElement);

    // The full shape: header rule + value row. Two element children, not one.
    await expect(card.children).toHaveLength(2);
    const [header, valueRow] = [...card.children] as HTMLElement[];
    await expect(getComputedStyle(header).borderBottomWidth).toBe('1px');

    await expect(canvas.getByText('Invoice INV-2043')).toBeInTheDocument();
    await expect(canvas.getByText('Marta Alvarez · 12 Mar 2026')).toBeInTheDocument();

    // The amount lives in the value row, not the header - a card that put it in the
    // header would still show the right text to a plain text query.
    await expect(within(valueRow).getByText('€248.50')).toBeInTheDocument();
    const link = within(valueRow).getByRole('link', { name: 'View in Finance' });
    await expect(link).toHaveAttribute('href', '/finance');

    // PAID maps to the completed tone. Resolved through a probe beside the pill so the
    // comparison holds in dark mode as well as light.
    const pill = canvas.getByText('PAID');
    const expected = resolveToken(card, '--status-completed-bg');
    await waitFor(() => {
      expect(getComputedStyle(pill).backgroundColor).toBe(expected);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The complete card: 34px blue-soft glyph, title, subtitle, a status pill, then the ' +
          'hairline and a value row carrying the tabular amount against a right-aligned deep ' +
          'link. `PAID` is one of the eight statuses with a tone, so the pill is the shared ' +
          '`--status-completed-*` set rather than a colour invented here.',
      },
    },
  },
};

export const AppointmentNoAmount: Story = {
  name: 'Appointment (link only, no amount)',
  args: {
    entity: {
      entityType: 'APPOINTMENT',
      entityId: 'appt-88',
      title: 'Kiko · Post-op recheck',
      snapshot: { subtitle: 'Thu, 26 Mar, 10:15', status: 'UPCOMING' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = cardRoot(canvasElement);
    await expect(card.children).toHaveLength(2);

    const valueRow = card.children[1] as HTMLElement;
    // With no amount the left cell is an EMPTY span, deliberately: it is what holds the
    // `justify-between` open so the link stays hard right. Drop it and the link slides
    // to the left edge and the row stops matching the invoice above it.
    const spacer = valueRow.firstElementChild as HTMLElement;
    await expect(spacer.tagName).toBe('SPAN');
    await expect(spacer.textContent).toBe('');
    await expect(
      within(valueRow).getByRole('link', { name: 'View in Appointments' })
    ).toHaveAttribute('href', '/appointments');

    const pill = canvas.getByText('UPCOMING');
    const expected = resolveToken(card, '--status-upcoming-bg');
    await waitFor(() => {
      expect(getComputedStyle(pill).backgroundColor).toBe(expected);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common case - almost no shared record carries money. The value row survives on the ' +
          'deep link alone, and the empty left span is the thing to look at: it is the only ' +
          'reason this row and the invoice row line their links up at the same x.',
      },
    },
  },
};

export const PrescriptionSingleRow: Story = {
  name: 'Prescription (single row, no rule)',
  args: {
    entity: {
      entityType: 'PRESCRIPTION',
      entityId: 'rx-19',
      title: 'Meloxicam 1.5 mg/ml',
      snapshot: { subtitle: '0.4 ml once daily, 5 days' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = cardRoot(canvasElement);

    // No amount and no DEEP_LINKS entry, so `showValueRow` is false: one child, and the
    // header must lose its bottom rule with it. A hairline over nothing is the bug this
    // story exists to catch.
    await expect(card.children).toHaveLength(1);
    await expect(getComputedStyle(card.children[0] as HTMLElement).borderBottomWidth).toBe('0px');

    await expect(canvas.getByText('Meloxicam 1.5 mg/ml')).toBeInTheDocument();
    await expect(canvas.getByText('0.4 ml once daily, 5 days')).toBeInTheDocument();
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Prescriptions and documents have no route to deep-link into, so they collapse to the ' +
          'header alone. The card is roughly half the height of the invoice, which is worth ' +
          'seeing: the two forms sit in the same message column and a fixed-height bubble would ' +
          'strand one of them.',
      },
    },
  },
};

export const UnknownType: Story = {
  name: 'Unknown type and unmapped status',
  args: {
    entity: {
      entityType: 'LAB_RESULT',
      entityId: 'lab-7',
      title: null,
      snapshot: { subtitle: 'Haematology panel', status: 'Awaiting review', amount: '   ' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = cardRoot(canvasElement);

    // No title -> the generic label is the heading. `LAB_RESULT` is in neither ICONS nor
    // LABELS, so both fall back rather than rendering an empty heading.
    await expect(canvas.getByText('Shared item')).toBeInTheDocument();
    await expect(canvas.getByText('Haematology panel')).toBeInTheDocument();

    // A whitespace-only amount is not an amount: `readString` trims and rejects it, so
    // there is no deep link either and the card is single-row.
    await expect(card.children).toHaveLength(1);

    // The status word is unmapped, so the pill paints in the neutral requested tokens
    // instead of disappearing.
    const pill = canvas.getByText('Awaiting review');
    const expected = resolveToken(card, '--status-requested-bg');
    await waitFor(() => {
      expect(getComputedStyle(pill).backgroundColor).toBe(expected);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the card does with a payload it does not know: an entity type with no icon, no ' +
          'label and no route, a status outside the tone table, and an amount that is only ' +
          'spaces. Every one of those degrades rather than throwing - the reason to draw it is ' +
          'to confirm the degraded card still reads as a card and not as a broken row.',
      },
    },
  },
};

export const HospitalTerminology: Story = {
  name: 'Companion record at a hospital org',
  beforeEach: seedOrgType('HOSPITAL'),
  args: {
    entity: {
      entityType: 'COMPANION',
      entityId: 'companion-12',
      title: null,
      snapshot: { subtitle: 'Pet parent: Marta Alvarez' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // COMPANION is the one label that tracks the org's animal noun.
    await expect(canvas.getByText('Patient record')).toBeInTheDocument();
    await expect(canvas.queryByText('Companion record')).not.toBeInTheDocument();

    // The snapshot subtitle is NOT passed through `rewrite` - only the label and the
    // deep-link label are - so server text lands verbatim in the same render whose
    // heading was just rewritten. Worth pinning: the obvious "fix" of rewriting the
    // whole card would turn this owner into a "patient parent", and the protected-term
    // exemption that would have caught it lives in `SessionInitializer`, which is not
    // mounted here.
    await expect(canvas.getByText('Pet parent: Marta Alvarez')).toBeInTheDocument();

    // The LABEL is rewritten; the HREF is not. A rewritten route would 404.
    const link = canvas.getByRole('link', { name: 'View in Patients' });
    await expect(link).toHaveAttribute('href', '/companions');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same card at an org whose type is `HOSPITAL`, which resolves the companion noun to ' +
          '"patient". Three things have to be true at once and only one of them is obvious: the ' +
          'label rewrites, the deep-link label rewrites with it, and the href does not. The ' +
          'subtitle is the fourth: it comes from the server snapshot and this component never ' +
          'passes it through `rewrite`, so "Pet parent" stands unchanged one line under a heading ' +
          'that just became "Patient record". The document-wide rewrite in `SessionInitializer` ' +
          'is what protects that phrase in the running app, and it is not mounted here - which is ' +
          'exactly why rewriting the whole card inside the component would be a silent way to ' +
          'produce a "patient parent".',
      },
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title and subtitle',
  args: {
    entity: {
      entityType: 'FORM',
      entityId: 'form-3',
      title: 'Pre-anaesthetic consent and owner acknowledgement of surgical risk',
      snapshot: {
        subtitle: 'Bartholomew Wigglesworth-Christiansen · awaiting signature since 3 March',
        status: 'REQUESTED',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText(
      'Pre-anaesthetic consent and owner acknowledgement of surgical risk'
    );
    // Both text runs are single-line `truncate`. The pill and the glyph are `shrink-0`,
    // so the title is the only thing that may give way - if it does not, the pill is
    // pushed out of the card.
    await expect(getComputedStyle(title).textOverflow).toBe('ellipsis');
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    await expect(canvas.getByText('REQUESTED')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Form titles are authored by the clinic and routinely run past the card width. The ' +
          'header is a three-part row - fixed glyph, flexible text column, fixed pill - and the ' +
          'text column is the only `min-w-0` element in it, which is what lets the ellipsis ' +
          'happen at all.',
      },
    },
  },
};
