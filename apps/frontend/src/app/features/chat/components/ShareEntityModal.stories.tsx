import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { Appointment, Organisation } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { ShareEntityModal } from './ShareEntityModal';

const companion = (id: string, name: string, species: string, breed?: string) =>
  ({
    id,
    name,
    species,
    breed,
    organisationId: 'org-sb',
    parentId: 'parent-1',
  }) as unknown as StoredCompanion;

const COMPANIONS: Record<string, StoredCompanion> = {
  'companion-1': companion('companion-1', 'Kiko', 'Dog', 'Border Collie'),
  'companion-2': companion('companion-2', 'Momo', 'Cat', 'British Shorthair'),
  // No breed: the subtitle is built from `[species, breed].filter(Boolean)`, so this
  // row must read "Rabbit" and not "Rabbit · ".
  'companion-3': companion('companion-3', 'Pip', 'Rabbit'),
};

const appointment = (id: string, name: string, startTime: string) =>
  ({
    id,
    organisationId: 'org-sb',
    patient: { id: `c-${id}`, name, species: 'Dog', parent: { id: 'p-1', name: 'Marta Alvarez' } },
    startTime: new Date(startTime),
    status: 'UPCOMING',
  }) as unknown as Appointment;

const APPOINTMENTS: Record<string, Appointment> = {
  'appt-1': appointment('appt-1', 'Kiko', '2026-03-26T09:15:00.000Z'),
  'appt-2': appointment('appt-2', 'Momo', '2026-03-27T13:40:00.000Z'),
};

/**
 * The organisation the seeded records belong to. The picker reads the per-org index,
 * not the flat by-id maps, so a story with no active org can only ever render the
 * empty state - which is exactly what every story in this file used to do.
 */
const SHARE_ORG_ID = 'org-sb';

/**
 * Seeds the two stores the picker reads, and the timezone the appointment subtitle is
 * formatted in.
 *
 * No loader is involved: `ShareEntityModal` subscribes to the stores directly and never
 * fetches, so seeding the real stores is the whole fixture - the component under review
 * is the real one and the mount touches no network.
 *
 * It has to seed BOTH halves. The by-id maps hold every record the tab has loaded across
 * organisations; `companionsIdsByOrgId` / `appointmentIdsByOrgId` say which of them the
 * active org owns, and the picker offers only the second so it cannot leak another
 * tenant's records. Seeding just the by-id maps - which is what this fixture did, from
 * before that tenancy fix landed - renders "Nothing to share here yet" in every story.
 * Nobody noticed because the component was also crashing on an unstable store snapshot,
 * so no play function in this file ever got far enough to assert a row.
 *
 * `formatDateInPreferredTimeZone` reads a localStorage token and falls back to
 * Europe/Berlin, so the token is cleared for the story and restored afterwards; 09:15Z is
 * 10:15 in Berlin on 26 March 2026.
 */
const seedStores =
  (
    companions: Record<string, StoredCompanion> = COMPANIONS,
    appointments: Record<string, Appointment> = APPOINTMENTS
  ) =>
  () => {
    const previousCompanions = useCompanionStore.getState().companionsById;
    const previousCompanionIndex = useCompanionStore.getState().companionsIdsByOrgId;
    const previousAppointments = useAppointmentStore.getState().appointmentsById;
    const previousAppointmentIndex = useAppointmentStore.getState().appointmentIdsByOrgId;
    const tzKey = 'yc_preferred_timezone';
    const previousTz = window.localStorage.getItem(tzKey);
    window.localStorage.removeItem(tzKey);

    // The Companion tab is NOT labelled with the literal "Companions": the component
    // renders `rewrite('Companions')` (ShareEntityModal.tsx:113), and
    // `getCompanionTerminologyForOrg` resolves that from the org store, falling back to
    // the `yc_companion_terminology_pending` key when no org is selected. Both inputs are
    // module-global AND both are persisted to localStorage (`org-store` partializes
    // `primaryOrgId`/`orgIds`/`orgsById`), so they outlive not just a story but a page
    // reload: one hospital org left behind by any story anywhere in this Storybook makes
    // every tab here read "Patients" from then on. That is precisely how the empty story
    // failed - `getByRole('button', { name: 'Companions' })` found nothing, because the
    // control said "Patients". Reproduced against the built Storybook by setting the
    // pending key to PATIENT: the tab flips and the play function throws that exact error.
    // Pinned at the meta so the file supplies its own premise rather than inheriting one,
    // which keeps every exact-label assertion below honest instead of accidentally true.
    // The hospital story overrides this from its own beforeEach, which runs after it.
    const { primaryOrgId, orgIds, orgsById } = useOrgStore.getState();
    const previousOrg = { primaryOrgId, orgIds, orgsById };
    const termKey = 'yc_companion_terminology_pending';
    const previousTerm = window.localStorage.getItem(termKey);
    window.localStorage.removeItem(termKey);
    // An org id is required for the picker to offer anything, but `orgsById` stays empty
    // so `getCompanionTerminologyForOrg` still falls through to the org-type default and
    // the tab keeps reading "Companions". The hospital story overrides both from its own
    // beforeEach, which runs after this.
    useOrgStore.setState({ primaryOrgId: SHARE_ORG_ID, orgIds: [], orgsById: {} });

    useCompanionStore.setState({
      companionsById: companions,
      companionsIdsByOrgId: { [SHARE_ORG_ID]: Object.keys(companions) },
    });
    useAppointmentStore.setState({
      appointmentsById: appointments,
      appointmentIdsByOrgId: { [SHARE_ORG_ID]: Object.keys(appointments) },
    });

    return () => {
      useCompanionStore.setState({
        companionsById: previousCompanions,
        companionsIdsByOrgId: previousCompanionIndex,
      });
      useAppointmentStore.setState({
        appointmentsById: previousAppointments,
        appointmentIdsByOrgId: previousAppointmentIndex,
      });
      useOrgStore.setState(previousOrg);
      if (previousTerm !== null) window.localStorage.setItem(termKey, previousTerm);
      if (previousTz !== null) window.localStorage.setItem(tzKey, previousTz);
    };
  };

/**
 * Swaps the shared axios instance's *adapter* rather than mocking `chatService`.
 *
 * The service module is imported directly by the component and this project has no
 * MSW or `sb.mock` wiring, so the adapter - the seam axios documents for exactly this -
 * is the only stub that does not require new build config. The captured configs are
 * handed back so a story can assert what was actually posted, not merely that something
 * was.
 */
const stubShare = (handler: (config: InternalAxiosRequestConfig) => Promise<unknown>) => {
  const posted: InternalAxiosRequestConfig[] = [];
  const install = () => {
    const previous = api.defaults.adapter;
    const adapter: AxiosAdapter = async (config) => {
      posted.push(config);
      return {
        data: await handler(config),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;
    return () => {
      posted.length = 0;
      api.defaults.adapter = previous;
    };
  };
  return { install, posted };
};

const NEVER = () => new Promise<never>(() => {});

const share = stubShare(async () => ({ id: 'share-1' }));
const shareHangs = stubShare(NEVER);
const shareFails = stubShare(() => Promise.reject(new Error('share endpoint unavailable')));

/** Rows are `<li>` inside the picker's single `<ul>`. */
const rows = (canvasElement: HTMLElement): HTMLElement[] =>
  within(canvasElement).getAllByRole('listitem');

const meta = {
  title: 'Chat/ShareEntityModal',
  component: ShareEntityModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The share-from-PIMS picker: choose a companion or an appointment and post it into the ' +
          'open conversation as a card.\n\n' +
          '`ChatContainer` mounts it behind `{shareChannelId && ...}`, so it has no closed form ' +
          'and nothing had ever drawn it. Everything inside it is gated a second time on store ' +
          'contents, which in the app arrive from whatever the user happened to load before ' +
          'opening chat - so the empty list, the 50-item cap and the in-flight row were all ' +
          'unreachable without the right browsing history.\n\n' +
          'It is two lists behind one search field, and they are not symmetrical. The companion ' +
          'tab builds its subtitle from `[species, breed]`, so a companion with no breed shows ' +
          'one word rather than a dangling separator; the appointment tab formats `startTime` ' +
          'through the preferred timezone and shows nothing when the appointment has no start. ' +
          'Both are capped at 50 rows **after** filtering, and the search matches title *or* ' +
          'subtitle - typing a breed is a legitimate way to find a pet.\n\n' +
          'The per-row press is the state worth reviewing: `sharing` holds the id of the row ' +
          'being posted, so exactly one row relabels its `--cta` pill to `Sharing…` and disables ' +
          'itself while the others stay live. On success the modal closes; on failure it is ' +
          'silent by design - the error is logged and surfaced by the service layer - so the ' +
          'only visible outcome is the row coming back. That is a state a reviewer should look ' +
          'at deliberately, because "nothing happened" is what a broken share looks like too.\n\n' +
          'Only the **Companions** tab label is rewritten to the org’s animal noun, and only ' +
          'the label - the tab key stays `COMPANION`. "Appointments" is left alone. Both are ' +
          'asserted in the hospital story below.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    channelId: 'channel-sb',
    onClose: fn(),
  },
  beforeEach: seedStores(),
} satisfies Meta<typeof ShareEntityModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Companions: Story = {
  name: 'Companion tab',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Three rows, each with its own subtitle - a list that rendered the names but lost
    // the species line would still pass a "three rows" check on its own.
    await expect(rows(canvasElement)).toHaveLength(3);
    await expect(canvas.getByText('Dog · Border Collie')).toBeInTheDocument();
    await expect(canvas.getByText('Cat · British Shorthair')).toBeInTheDocument();
    // No breed, so the separator is absent rather than trailing.
    await expect(canvas.getByText('Rabbit')).toBeInTheDocument();
    await expect(canvas.getAllByText('Share')).toHaveLength(3);

    // The selected tab is the `--blue-soft` pill. Polled: the tab carries
    // `transition-colors`, so a single synchronous read can catch an interpolated value.
    const selected = canvas.getByRole('button', { name: 'Companions' });
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--blue-soft)';
    selected.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    await waitFor(() => {
      expect(getComputedStyle(selected).backgroundColor).toBe(expected);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the picker opens: the companion tab selected, the full companion list, and an ' +
          'empty search field. The rows are the same avatar-plus-two-lines shape as the ' +
          'conversation list, which is deliberate - the point of the picker is that it looks ' +
          'like chat rather than like a PIMS table.',
      },
    },
  },
};

export const Appointments: Story = {
  name: 'Appointment tab',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Appointments' }));

    // The tab swaps the list entirely rather than filtering it.
    await expect(rows(canvasElement)).toHaveLength(2);
    await expect(canvas.getByText('Mar 26, 10:15 AM')).toBeInTheDocument();
    await expect(canvas.getByText('Mar 27, 2:40 PM')).toBeInTheDocument();
    // Companion-only subtitles are gone, and the shared name "Kiko" now belongs to the
    // appointment row - so the assertion is on the subtitle, not on the name.
    await expect(canvas.queryByText('Dog · Border Collie')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second tab. Rows are titled by the patient name and subtitled with the formatted ' +
          'start time, so two appointments for the same pet are told apart only by that second ' +
          'line - which is why it is rendered at the same weight as the companion subtitle ' +
          'rather than as a faint aside.',
      },
    },
  },
};

export const Search: Story = {
  name: 'Search matches subtitle too',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "collie" appears in no title - only in Kiko's breed line. Matching titles alone
    // would return nothing here, and the picker would look broken to anyone who searches
    // the way a vet talks.
    await userEvent.type(canvas.getByLabelText('Search records'), 'collie');
    await waitFor(() => {
      expect(rows(canvasElement)).toHaveLength(1);
    });
    await expect(canvas.getByText('Kiko')).toBeInTheDocument();
    await expect(canvas.queryByText('Momo')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The filter is case-insensitive and runs over title **and** subtitle, which for ' +
          'companions means species and breed and for appointments means the date line. Filtering ' +
          'happens before the 50-row cap, so a search can reach records the unfiltered list never ' +
          'showed.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Nothing loaded yet',
  beforeEach: seedStores({}, {}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Exactly one list item, and it is the placeholder - not "at least the placeholder",
    // which would also be true of a list that rendered the line plus stale rows.
    const items = rows(canvasElement);
    await expect(items).toHaveLength(1);
    await expect(items[0].textContent).toBe('Nothing to share here yet');
    // The placeholder is a list item, so it inherits the list padding - but it is not a
    // row: there is nothing to press inside the list at all.
    await expect(within(items[0]).queryAllByRole('button')).toHaveLength(0);
    // ...and it is centred in its cell rather than sitting left like a row would.
    await expect(getComputedStyle(items[0]).textAlign).toBe('center');
    // Both entity-type controls are still offered; the emptiness is per-tab, not a dead
    // modal. They are plain `<button>`s in a flex row - no `role="tab"`, no
    // `aria-selected` - so `role: 'button'` is the right query, and the exact NAME is the
    // only thing distinguishing them. "Companions" is the ORG'S companion noun rather
    // than a fixed string (the component renders `rewrite('Companions')`); it is exact
    // here only because the meta fixture pins the terminology to its default. Before that
    // pin this line asserted a label the component never promised and failed with
    // "Unable to find an accessible element with the role \"button\" and name
    // \"Companions\"" whenever an org or a pending choice survived from another story.
    // "Appointments" is the literal, never rewritten - so the pair also pins the fact
    // that the rewrite is scoped to one tab.
    await expect(canvas.getByRole('button', { name: 'Companions' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Appointments' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a user sees if they open the picker before visiting Companions or Appointments - ' +
          'the stores are populated by those pages, not by chat. The line is centred in the same ' +
          '`px-3 py-6` cell the search placeholder uses, so the card does not collapse to a ' +
          'sliver.',
      },
    },
  },
};

export const CapAtFifty: Story = {
  name: 'Capped at 50 rows',
  beforeEach: seedStores(
    Object.fromEntries(
      Array.from({ length: 62 }, (_, index) => [
        `companion-${index}`,
        companion(`companion-${index}`, `Patient ${String(index).padStart(2, '0')}`, 'Dog'),
      ])
    ),
    {}
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Exactly the cap, not "some rows".
    await expect(rows(canvasElement)).toHaveLength(50);
    await expect(canvas.getByText('Patient 00')).toBeInTheDocument();
    await expect(canvas.getByText('Patient 49')).toBeInTheDocument();
    await expect(canvas.queryByText('Patient 50')).not.toBeInTheDocument();

    // The cap is not what keeps the card short - the list is its own `max-h-80` scroller,
    // and 50 rows overflow it. Both have to hold, or the modal grows past the viewport.
    const list = canvas.getAllByRole('list')[0];
    await expect(getComputedStyle(list).maxHeight).toBe('320px');
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A clinic with a real caseload loaded. `MAX_ITEMS` truncates silently - there is no ' +
          '"showing 50 of 62" line - so the search field is the only way to reach the rest, and ' +
          'this story is the only place that fact is visible.',
      },
    },
  },
};

export const Sharing: Story = {
  name: 'Share in flight',
  beforeEach: shareHangs.install,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button', { name: /Kiko/ });
    await userEvent.click(row);

    // `sharing` stores the row id rather than a boolean, so only this row changes.
    expect(await within(row).findByText('Sharing…')).toBeInTheDocument();
    await expect(row).toBeDisabled();
    await expect(canvas.getAllByText('Share')).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: /Momo/ })).toBeEnabled();
    // The modal must stay open while the POST is open - closing early would leave the
    // user unable to tell whether the card was posted.
    await expect(args.onClose).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held on a POST that never settles. Two things are worth checking against the resting ' +
          'list: the pill is the same `--cta` pill with a different label rather than a spinner, ' +
          'so the row does not change width; and `disabled:opacity-60` fades the whole row, ' +
          'avatar included, not just the pill.',
      },
    },
  },
};

export const ShareFails: Story = {
  name: 'Share failed (silent)',
  beforeEach: shareFails.install,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button', { name: /Momo/ });
    await userEvent.click(row);

    // The catch swallows the error and `finally` clears `sharing`, so the row comes back
    // to rest and the modal stays open. There is no in-modal error surface at all.
    await waitFor(() => {
      expect(row).toBeEnabled();
    });
    await expect(within(row).getByText('Share')).toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure path, which looks almost exactly like never having pressed the row. The ' +
          'component deliberately renders nothing for the error - it is logged and surfaced by ' +
          'the service layer - so the reviewer question this story exists to raise is whether a ' +
          'failed share is distinguishable from a mis-click. Compare it with the ' +
          'NetworkDirectoryModal, which does draw a `role="alert"` band for the same class of ' +
          'failure.',
      },
    },
  },
};

export const SharesAndCloses: Story = {
  name: 'Successful share',
  beforeEach: share.install,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Pip/ }));

    await waitFor(() => {
      expect(args.onClose).toHaveBeenCalled();
    });

    // Assert the payload, not just that a request left: the endpoint stores the snapshot
    // verbatim and the CARD in the thread is rendered from it, so a dropped subtitle here
    // is a permanently subtitle-less card in every conversation it was shared into.
    const request = share.posted.at(-1);
    await expect(request?.url).toBe('/v1/chat/pms/share');
    await expect(JSON.parse(String(request?.data))).toEqual({
      channelId: 'channel-sb',
      entityType: 'COMPANION',
      entityId: 'companion-3',
      title: 'Pip',
      snapshot: { subtitle: 'Rabbit' },
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The happy path, end to end: press a row, the POST resolves, the modal closes. The ' +
          'snapshot posted with it is what the shared card in the thread will render forever ' +
          'after, so it is asserted field by field rather than by counting requests.',
      },
    },
  },
};

export const HospitalTerminology: Story = {
  name: 'Tab label at a hospital org',
  beforeEach: () => {
    const previous = useOrgStore.getState();
    // The seeded records have to follow the org across. The picker offers only what the
    // ACTIVE org's index lists, so switching `primaryOrgId` without re-pointing the
    // index empties the list and this story would assert a tab label over a picker with
    // nothing in it - true, but for the wrong reason.
    const previousCompanionIndex = useCompanionStore.getState().companionsIdsByOrgId;
    const previousAppointmentIndex = useAppointmentStore.getState().appointmentIdsByOrgId;
    useCompanionStore.setState({
      companionsIdsByOrgId: { 'org-sb-share-hospital': Object.keys(COMPANIONS) },
    });
    useAppointmentStore.setState({
      appointmentIdsByOrgId: { 'org-sb-share-hospital': Object.keys(APPOINTMENTS) },
    });
    useOrgStore.setState({
      primaryOrgId: 'org-sb-share-hospital',
      orgIds: ['org-sb-share-hospital'],
      orgsById: {
        'org-sb-share-hospital': {
          _id: 'org-sb-share-hospital',
          name: 'Storybook Referral Hospital',
          type: 'HOSPITAL',
        } as unknown as Organisation,
      },
    });
    return () => {
      useCompanionStore.setState({ companionsIdsByOrgId: previousCompanionIndex });
      useAppointmentStore.setState({ appointmentIdsByOrgId: previousAppointmentIndex });
      useOrgStore.setState({
        primaryOrgId: previous.primaryOrgId,
        orgIds: previous.orgIds,
        orgsById: previous.orgsById,
      });
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the companion tab tracks the org noun.
    await expect(canvas.getByRole('button', { name: 'Patients' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Companions' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Appointments' })).toBeInTheDocument();
    // The tab is still the selected one after the rewrite - the label changes, the state
    // key ('COMPANION') does not.
    await expect(rows(canvasElement)).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same picker at an org whose type is `HOSPITAL`. The tab reads "Patients" while the ' +
          'tab key stays `COMPANION`, which is the whole point of keeping the rewrite in the ' +
          'label rather than in the state - a rewritten key would silently select neither tab.',
      },
    },
  },
};

export const Dismissal: Story = {
  name: 'Dismissal (backdrop and close)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The scrim is a real full-bleed button behind the card, not a click handler on the
    // dialog - so it has an accessible name and is reachable by keyboard.
    await userEvent.click(canvas.getByRole('button', { name: 'Close picker' }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(args.onClose).toHaveBeenCalledTimes(2);
    // Neither path unmounts anything on its own: the modal is controlled entirely by the
    // parent's `shareChannelId`, so it is still on screen here. Asserted on the `open`
    // ATTRIBUTE, not on the title text - a `<dialog>` that lost `open` stays mounted and
    // keeps its text, so a text query cannot tell a live modal from a dismissed one.
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    await expect(rows(canvasElement)).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both ways out. The backdrop is an `absolute inset-0` transparent button *inside* the ' +
          'dialog and the card sits above it on `z-10`; get that stacking wrong and the card ' +
          'itself becomes unclickable while looking perfectly fine.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: card fills the width',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByText('Share to chat').closest('div[class*="max-w-"]') as HTMLElement;
    // Guards the Storybook 10 viewport trap directly: an inert pin renders the story at
    // the full preview width, and this assertion is the one that would catch it.
    const viewportWidth = document.documentElement.clientWidth;
    await expect(viewportWidth).toBeLessThanOrEqual(430);
    // The dialog's `p-4` is the only inset. The 470px design width is a cap, not a fixed
    // size, so at phone widths the card is the screen.
    await expect(card.getBoundingClientRect().width).toBeCloseTo(viewportWidth - 32, 0);
    // `pt-24` holds the card clear of the status bar and the channel header behind it.
    await expect(card.getBoundingClientRect().top).toBeCloseTo(96, 0);
    await expect(rows(canvasElement)).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the picker is effectively a full-width sheet pinned 96px down. The rows keep ' +
          'their 36px avatars and the `Share` pill stays on the row rather than wrapping, which ' +
          'is the thing to check - the pill is `shrink-0` and the text column is the only part ' +
          'allowed to give way.',
      },
    },
  },
};
