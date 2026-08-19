import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type {
  CompanionCardDTO,
  IssueShareTokenResultDTO,
  Organisation,
  ShareTokenResponseDTO,
} from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import ShareCompanionCardModal from './ShareCompanionCardModal';

const ORG_ID = 'org-storybook-card';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+49 30 5555 0142',
  taxId: 'DE-TAX-000000',
};

const CARD: CompanionCardDTO = {
  audience: 'STAFF',
  identity: {
    id: 'companion-poppy-812',
    name: 'Poppy',
    type: 'dog',
    breed: 'Border Terrier',
    colour: 'Grizzle',
    photoUrl: undefined,
    microchipNumber: '981020034512789',
  },
  passportNumber: 'DE-PP-441207',
  dateOfBirth: '2020-03-14T00:00:00.000Z',
  alerts: [
    { title: 'Cephalosporin allergy', severity: 'critical' },
    { title: 'Fear of clippers', severity: 'low' },
  ],
  ownerContact: {
    firstName: 'Sam',
    lastName: 'Okonjo',
    phoneNumber: '+49 151 5550 118',
    email: 'sam@example.test',
  },
  medical: {
    allergy: 'Cephalosporins',
    bloodGroup: 'DEA 1.1 negative',
    currentWeight: 25,
    isNeutered: true,
  },
  insurance: { isInsured: true, companyName: 'Petplan DE' },
  latestVisit: { status: 'Completed', occurredAt: '2026-08-02T09:15:00.000Z' },
};

const token = (over: Partial<ShareTokenResponseDTO> = {}): ShareTokenResponseDTO => ({
  id: 'share-1',
  audience: 'PUBLIC',
  showOwnerPhone: false,
  expiresAt: '2026-12-31T00:00:00.000Z',
  revokedAt: null,
  lastViewedAt: '2026-08-18T11:02:00.000Z',
  viewCount: 12,
  createdAt: '2026-08-10T08:00:00.000Z',
  ...over,
});

/**
 * The issued-link payload.
 *
 * The literal below is deliberately the words EXAMPLE_NOT_A_CREDENTIAL rather
 * than anything token-shaped: `IssueShareTokenResultDTO.token` is the one field
 * in this DTO that carries a real secret in production, and a plausible-looking
 * random string in a committed file trips the repository's secret scanner.
 */
const ISSUED: IssueShareTokenResultDTO = {
  token: 'EXAMPLE_NOT_A_CREDENTIAL',
  qrPayload: 'https://app.example.test/public/companion-card/EXAMPLE_NOT_A_CREDENTIAL',
  share: token({ id: 'share-new', viewCount: 0, lastViewedAt: null }),
};

type Handlers = {
  list?: () => Promise<{ tokens: ShareTokenResponseDTO[] }>;
  issue?: () => Promise<IssueShareTokenResultDTO>;
  revoke?: () => Promise<ShareTokenResponseDTO>;
};

/**
 * Swaps the shared axios instance's *adapter* rather than mocking the service
 * module, which is the seam axios documents for this and the convention the other
 * modal stories in this repo already follow (there is no MSW or `sb.mock` wiring
 * here). `beforeEach` returns the restore, so the real adapter is back before the
 * next story runs.
 *
 * The org store is seeded in the same hook because `companionCard.service` calls
 * `requireOrgId()`, which THROWS when no primary org is set - without the seed
 * every request would reject before reaching the adapter and each story would be
 * silently exercising the catch branch instead of the one it names.
 */
const stubApi = (handlers: Handlers) => () => {
  const previousAdapter = api.defaults.adapter;
  const orgSnapshot = useOrgStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: ORG },
    status: 'loaded',
  });

  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    let data: unknown;
    if (method === 'delete') {
      data = await (handlers.revoke ?? (() => Promise.resolve(token())))();
    } else if (method === 'post') {
      data = await (handlers.issue ?? (() => Promise.resolve(ISSUED)))();
    } else if (url.endsWith('/shares')) {
      data = await (handlers.list ?? (() => Promise.resolve({ tokens: [] })))();
    } else {
      data = {};
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  api.defaults.adapter = adapter;

  return () => {
    api.defaults.adapter = previousAdapter;
    useOrgStore.setState(orgSnapshot);
  };
};

const NEVER = <T,>(): Promise<T> => new Promise<T>(() => {});

/** The portalled panel, or a thrown error naming what actually happened. */
const openDialog = (): HTMLElement => {
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) throw new Error('No open dialog is mounted on document.body.');
  return dialog as HTMLElement;
};

const meta = {
  title: 'CompanionCard/ShareCompanionCardModal',
  component: ShareCompanionCardModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole share sheet, which had never been drawn anywhere - it returns `null` ' +
          'unless `open`, deliberately, so the companion card is not duplicated into the page ' +
          'DOM behind the overlay. There is no closed state to screenshot: closed means the ' +
          'component renders nothing at all, not even the dialog element the shared `Modal` ' +
          'usually leaves mounted.\n\n' +
          'Behind that gate is a second one. The body is a ternary on `issued`, and `issued` is ' +
          'only ever set by a successful POST, so the QR code, the wrapped payload URL and the ' +
          '"Copy link" button could not be seen without issuing a real share token against a ' +
          'real organisation. The primary button and the QR block never appear together - ' +
          'creating a link REPLACES the button.\n\n' +
          'A third surface hangs off the GET: any live tokens are listed under "Active share ' +
          'links" with a view count and a Revoke button, filtered client-side by `isLive`, ' +
          'which drops anything revoked or past its expiry so an expired link is never offered ' +
          'as an active share.\n\n' +
          'Every story below swaps the axios adapter rather than the service module, and seeds ' +
          'the org store because the service reads the primary org id and throws without one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    card: CARD,
    companionId: 'companion-poppy-812',
    companionName: 'Poppy Okonjo',
    onClose: fn(),
  },
  globals: { viewport: { value: 'laptop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[520px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: stubApi({}),
} satisfies Meta<typeof ShareCompanionCardModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (renders nothing)',
  args: { open: false },
  play: async () => {
    /* Not "the dialog has no `open` attribute" - there is no dialog. The early
       `if (!open) return null` runs before `CenterModal`, so unlike every other
       PIMS overlay this one leaves no portalled node behind at all. */
    await expect(document.querySelector('dialog')).toBeNull();
    await expect(document.body.textContent).not.toContain('Create shareable card link');

    /* And the identifiers are the reason the guard exists, so they are what the
       story checks: with the card mounted-but-hidden, the microchip and passport
       numbers would sit in the page DOM behind the scrim, readable by anything
       walking the document. */
    await expect(document.body.textContent).not.toContain('981020034512789');
    await expect(document.body.textContent).not.toContain('DE-PP-441207');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Included because the absence is the design: keeping the card mounted would put a ' +
          'second copy of every identifier - microchip, passport, owner phone - into the page ' +
          'DOM behind the scrim.',
      },
    },
  },
};

export const Sheet: Story = {
  name: 'Share sheet (no links yet)',
  play: async () => {
    const dialog = await waitFor(openDialog);
    const panel = within(dialog);

    // The title takes the FIRST word of the companion name, not the whole name.
    await expect(
      panel.getByRole('heading', { level: 2, name: "Share Poppy's card" })
    ).toBeVisible();

    // The card itself, which is the thing being shared - identifiers and alerts.
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
    await expect(panel.getByText('Border Terrier / Canine')).toBeInTheDocument();
    await expect(panel.getByText('Cephalosporin allergy')).toBeInTheDocument();
    await expect(panel.getByText('981020034512789')).toBeInTheDocument();
    await expect(panel.getByText('Petplan DE')).toBeInTheDocument();
    await expect(panel.getByText('Sam Okonjo')).toBeInTheDocument();

    // The primary action, and nothing from the issued branch.
    await expect(
      panel.getByRole('button', { name: 'Create shareable card link' })
    ).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    await expect(panel.queryByText('Active share links')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first-run state: a companion that has never been shared. The card renders on a ' +
          'white ground inside the panel, and the whole body scrolls at `max-h-[70vh]` so a ' +
          'card with every optional field filled in does not push the action off screen.',
      },
    },
  },
};

export const LinkIssued: Story = {
  name: 'Link issued (QR + payload)',
  play: async () => {
    const dialog = await waitFor(openDialog);
    const panel = within(dialog);
    await userEvent.click(panel.getByRole('button', { name: 'Create shareable card link' }));

    const payload = await panel.findByText(ISSUED.qrPayload);
    await expect(panel.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();

    /* The swap, not an addition: the primary that created the link is gone, so
       there is no way to issue a second link without closing and reopening the
       sheet (which also clears this one - `handleClose` resets `issued`). */
    await expect(
      panel.queryByRole('button', { name: 'Create shareable card link' })
    ).not.toBeInTheDocument();

    // A real QR, sized 160 by the caller.
    const block = payload.closest('div');
    if (!block) throw new Error('The issued-link block did not render.');
    const qr = block.querySelector('svg');
    if (!qr) throw new Error('No QR code was rendered next to the payload.');
    await expect(qr.getBoundingClientRect().width).toBe(160);

    /* `break-all` is doing real work here and is easy to lose: the payload is a
       single unbroken URL, so without it the line cannot wrap and the 500px panel
       grows a horizontal scrollbar. Asserting the computed value catches a
       refactor that drops the class far more reliably than looking at a
       screenshot of a short fixture URL. */
    await waitFor(() => {
      expect(getComputedStyle(payload).wordBreak).toBe('break-all');
    });
    await expect(payload.getBoundingClientRect().width).toBeLessThanOrEqual(
      dialog.getBoundingClientRect().width
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The issued state. QR, the full URL underneath it as selectable text, and a ' +
          'secondary "Copy link" - three ways to move the same link, because the person ' +
          'receiving it is usually holding a phone in front of the screen.',
      },
    },
  },
};

export const IssuingInFlight: Story = {
  name: 'Creating a link (in flight)',
  beforeEach: stubApi({ issue: () => NEVER<IssueShareTokenResultDTO>() }),
  play: async () => {
    const dialog = await waitFor(openDialog);
    const panel = within(dialog);
    await userEvent.click(panel.getByRole('button', { name: 'Create shareable card link' }));

    /* The label swaps to "Creating..." and that is the ENTIRE feedback - the
       button is not disabled, so a second click fires a second POST and issues a
       second share token. That is worth seeing rather than inferring. */
    const busyButton = await panel.findByRole('button', { name: 'Creating...' });
    await expect(busyButton).toBeEnabled();
    await expect(panel.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();

    /* One button, not a button plus a spinner: nothing else on the sheet changes
       while the POST is out, so the label swap is the whole of the in-flight
       state. */
    await expect(panel.queryByRole('button', { name: 'Create shareable card link' })).toBeNull();
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The window between the click and the token, which on a cold API is measured in ' +
          'seconds. `busy` drives the label only; nothing blocks the control.',
      },
    },
  },
};

export const ActiveLinks: Story = {
  name: 'Existing share links',
  beforeEach: stubApi({
    list: () =>
      Promise.resolve({
        tokens: [
          token({ id: 'share-public', audience: 'PUBLIC', viewCount: 12 }),
          token({ id: 'share-referral', audience: 'REFERRAL_CLINIC', viewCount: 3 }),
          // Filtered out by `isLive` before it ever reaches the list.
          token({ id: 'share-revoked', revokedAt: '2026-08-15T10:00:00.000Z' }),
          token({ id: 'share-expired', expiresAt: '2025-01-01T00:00:00.000Z' }),
        ],
      }),
  }),
  play: async () => {
    const dialog = await waitFor(openDialog);
    const panel = within(dialog);

    const heading = await panel.findByText('Active share links');
    await expect(heading).toBeInTheDocument();

    /* Two of the four tokens survive `isLive`. The audience drives the label, so
       a referral link and a public link are distinguishable only by that word -
       there is no badge, no expiry and no created date on the row. */
    await expect(panel.getByText('Public link - 12 views')).toBeInTheDocument();
    await expect(panel.getByText('Referral link - 3 views')).toBeInTheDocument();
    await expect(panel.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2);

    // The revoked and expired tokens are dropped client-side, mirroring what the
    // public resolver would do with them anyway.
    await expect(panel.queryByText('Public link - 0 views')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Rows sit below the primary action, each a hairline-bordered pill with the label on ' +
          'the left and Revoke on the right. Revoking is immediate and unconfirmed - there is ' +
          'no "are you sure" between the button and the DELETE.',
      },
    },
  },
};

export const ListUnavailable: Story = {
  name: 'Share list unavailable',
  beforeEach: stubApi({ list: () => Promise.reject(new Error('service unavailable')) }),
  play: async () => {
    const dialog = await waitFor(openDialog);
    const panel = within(dialog);

    /* The GET failing is treated as "no links", not as an error: the catch sets an
       empty array and the section simply does not render. So a clinic whose
       sharing service is down sees a sheet that looks exactly like a companion
       that has never been shared - and can happily issue a second link. */
    const primary = await panel.findByRole('button', { name: 'Create shareable card link' });
    await expect(primary).toBeInTheDocument();
    await expect(panel.queryByText('Active share links')).not.toBeInTheDocument();
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();

    /* And the card above it is fully populated, which is the point: the failure is
       invisible precisely because everything a reader looks at still rendered. */
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
    await expect(panel.getByText('981020034512789')).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Deliberately non-fatal - the card is read-only data the page already has, and only ' +
          'the link list needs the sharing service. The cost is that "no links" and "cannot ' +
          'reach the service" are the same picture.',
      },
    },
  },
};
