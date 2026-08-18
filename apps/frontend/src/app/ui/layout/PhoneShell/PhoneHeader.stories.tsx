import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import PhoneHeader from './PhoneHeader';
import { useOrgStore } from '@/app/stores/orgStore';

// PhoneHeader is styled by the shell's stylesheet, which the app loads through
// PhoneShell rather than the header itself.
import './PhoneShell.css';

const ORG_ID = 'org-storybook';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
};

/**
 * Seeds the org store the way the app's bootstrap does, and puts it back
 * afterwards so neighbouring stories are unaffected.
 */
const withOrg = (org: Organisation | null) => () => {
  const snapshot = useOrgStore.getState();

  useOrgStore.setState(
    org
      ? { orgsById: { [ORG_ID]: org }, orgIds: [ORG_ID], primaryOrgId: ORG_ID, status: 'loaded' }
      : { orgsById: {}, orgIds: [], primaryOrgId: null, status: 'loaded' }
  );

  return () => {
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'Layout/PhoneHeader',
  component: PhoneHeader,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    // Every rule in PhoneShell.css sits inside a `max-width: 767px` media
    // query, so both the canvas and the Chromatic snapshot have to be phone
    // width or the header renders as bare, unstyled elements.
    chromatic: { viewports: [375] },
    // The org chip pushes a route on tap, so the App Router mock has to be on.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The fixed 54px header on phones (< 768px), which replaces the desktop user header. It ' +
          'holds the organisation switcher on the left and the search and notifications controls on ' +
          'the right, over a blurred `--glass-93` band with a `--hairline` bottom edge. It reads the ' +
          'primary organisation straight from the org store; these stories seed that store rather ' +
          'than calling the API. `Layout/PhoneShell` shows the same header in place with the tab bar ' +
          'and FAB around it.\n\n' +
          'The header embeds `NotificationsBell` with `variant="phone"`, and that variant hides a ' +
          'whole second surface no story had ever drawn: **the notifications bottom sheet**. It is ' +
          'not a dropdown re-skinned. The phone branch `createPortal`s a `yc-noti-sheet-root` to ' +
          '`document.body` holding a full-screen backdrop button plus a `<dialog open aria-modal>` ' +
          'with a grabber pill above the panel and a home-indicator bar below it - three chrome ' +
          'elements the desktop dropdown does not have at all. It exists only while the internal ' +
          '`open` state is true, and no prop reaches that state, so the sheet was unreachable from ' +
          'any static render.\n\n' +
          'The sheet also lands outside `canvasElement`, which is its own trap: a story that queried ' +
          'the canvas would find nothing and could still be written to pass. The stories below query ' +
          '`document.body` and assert the panel body, not merely that the bell flipped ' +
          '`aria-expanded`.\n\n' +
          'What the panel shows today is the empty state, and deliberately so: `useNotifications` is ' +
          'a presenter over a feed that does not exist yet and reports `items: []` rather than ' +
          'fabricating rows, so `NotificationsPanel` renders its "All caught up" disc, title and ' +
          'copy - and the sheet has no head row and no footer in that branch. When a durable feed ' +
          'lands, the unread/earlier sections appear inside this same sheet and these stories are ' +
          'where that change becomes visible.',
      },
    },
  },
} satisfies Meta<typeof PhoneHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The normal signed-in header: org avatar, short name, caret, search, bell. */
export const WithOrganisation: Story = {
  name: 'With organisation',
  beforeEach: withOrg(ORG),
};

/**
 * A long organisation name. The chip is capped at 62vw and ellipsises, so the
 * name can never push the search and bell buttons off the right edge.
 */
export const LongOrganisationName: Story = {
  name: 'Long organisation name',
  beforeEach: withOrg({
    ...ORG,
    name: 'Sunrise Veterinary Hospital and Emergency Referral Centre',
  }),
};

/**
 * No primary organisation yet — before bootstrap resolves, or for an account
 * that belongs to none. The switcher is replaced by the brand mark rather than
 * an empty chip.
 */
export const NoOrganisation: Story = {
  name: 'No organisation (brand mark)',
  beforeEach: withOrg(null),
};

/**
 * Opens the notifications sheet from the bell and returns the portalled dialog.
 * The sheet is outside `canvasElement`, so it has to be found on `document.body`.
 */
const openNotifications = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }));
  return within(document.body).findByRole('dialog', { name: 'Notifications' });
};

/**
 * The bottom sheet behind the bell. Everything below the header - backdrop,
 * grabber, dialog, home indicator - is mounted only by this interaction.
 */
export const NotificationsSheet: Story = {
  name: 'Notifications sheet open',
  beforeEach: withOrg(ORG),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = await openNotifications(canvasElement);

    // Assert the sheet has its panel content. Checking aria-expanded on the bell
    // would pass on an empty sheet, which is exactly how a gated panel rots.
    await expect(within(sheet).getByText('All caught up')).toBeInTheDocument();
    await expect(
      within(sheet).getByText('New bookings, lab results and messages will land here.')
    ).toBeInTheDocument();
    // The backdrop is a real button, not a decorative div - it is how the sheet
    // is dismissed by touch.
    await expect(
      within(document.body).getByRole('button', { name: 'Close notifications' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  },
};

/**
 * Dismissing by tapping the backdrop, which is the phone branch's only outside
 * click path: the desktop dropdown uses a document `mousedown` listener, the
 * sheet deliberately does not.
 */
export const NotificationsSheetDismissed: Story = {
  name: 'Notifications sheet dismissed by backdrop',
  beforeEach: withOrg(ORG),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openNotifications(canvasElement);

    await userEvent.click(
      within(document.body).getByRole('button', { name: 'Close notifications' })
    );

    await expect(
      within(document.body).queryByRole('dialog', { name: 'Notifications' })
    ).not.toBeInTheDocument();
    // The header itself is untouched underneath - the org chip and search stay put.
    await expect(canvas.getByRole('button', { name: 'Switch organization' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  },
};

/**
 * The sheet over the brand-mark header. Worth its own story because the sheet is
 * portalled to `document.body` rather than nested in the header, so nothing about
 * the header's own layout constrains it - and that independence is only provable
 * by drawing it over a different header.
 */
export const NotificationsSheetWithoutOrganisation: Story = {
  name: 'Notifications sheet without an organisation',
  beforeEach: withOrg(null),
  play: async ({ canvasElement }) => {
    const sheet = await openNotifications(canvasElement);
    await expect(within(sheet).getByText('All caught up')).toBeInTheDocument();
  },
};
