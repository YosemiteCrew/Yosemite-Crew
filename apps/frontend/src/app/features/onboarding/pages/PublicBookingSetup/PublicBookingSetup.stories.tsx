import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { ServiceRevamp, SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import {
  bookingPageApi,
  type BookingPageConfig,
} from '@/app/features/onboarding/services/bookingPageApiService';
import PublicBookingSetup from './PublicBookingSetup';

const ORG_ID = 'org-storybook-avenger-park';
const SPECIALITY_ID = 'spec-general-practice';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
};

const service = (over: Partial<ServiceRevamp> = {}): ServiceRevamp => ({
  id: 'svc-1',
  code: 'GP-001',
  name: 'Wellness consultation',
  description: 'Nose-to-tail exam and a plan for the year.',
  type: 'CONSULTATION',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 72,
  currency: 'EUR',
  defaultDiscount: 0,
  maxDiscount: 10,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
  ...over,
});

const SERVICES: ServiceRevamp[] = [
  service(),
  service({
    id: 'svc-2',
    code: 'GP-014',
    name: 'Vaccination booster',
    grossAmount: 45,
    durationMinutes: 20,
  }),
  service({
    id: 'svc-3',
    code: 'DEN-002',
    name: 'Dental scale and polish',
    type: 'PROCEDURE',
    grossAmount: 310,
    durationMinutes: 90,
  }),
  // Present in the catalog, deliberately absent from the booking list.
  service({ id: 'svc-4', code: 'RAD-003', name: 'Full mouth radiograph', isBookable: false }),
  service({ id: 'svc-5', code: 'GP-099', name: 'Retired nail trim', status: 'ARCHIVED' }),
];

const config = (over: Partial<BookingPageConfig> = {}): BookingPageConfig => ({
  organisationId: ORG_ID,
  configured: false,
  slug: null,
  publicBookingEnabled: false,
  publicUrl: null,
  serviceIds: [],
  bookingWindowDays: 28,
  bufferMinutes: 10,
  autoConfirm: false,
  welcomeMessage: null,
  replyToEmail: null,
  ...over,
});

const SPECIALITY: SpecialityRevamp = {
  id: SPECIALITY_ID,
  name: 'General Practice',
  organisationId: ORG_ID,
  teamMemberIds: [],
};

/**
 * Seeds the two stores the page reads and restores them afterwards.
 *
 * `loadOrganisationCatalog` returns at its first line once the store already
 * holds a speciality for this organisation, so seeding one keeps the mount off
 * the network with no service stub - the page under review is the real one.
 */
const seed = (
  options: {
    services?: ServiceRevamp[];
    imageURL?: string;
    config?: BookingPageConfig;
  } = {}
) => {
  const previousOrg = useOrgStore.getState();
  const previousCatalog = useRevampCatalogStore.getState();
  const previousGetConfig = bookingPageApi.getConfig;
  const previousSaveConfig = bookingPageApi.saveConfig;

  // The page reads its address from the API and never derives one, so a story
  // has to supply the payload it would have received. Stubbing here keeps the
  // preview iframe off the network and makes the unpublished/published split an
  // explicit choice per story rather than a network accident.
  const stubbed = options.config ?? config();
  bookingPageApi.getConfig = async () => stubbed;
  bookingPageApi.saveConfig = async () => stubbed;

  useOrgStore.setState({
    orgsById: { [ORG_ID]: { ...ORG, imageURL: options.imageURL } },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useRevampCatalogStore.setState({
    services: options.services ?? SERVICES,
    specialities: [SPECIALITY],
    // The page fans out to `loadSpecialityCatalog` for each speciality. Marking
    // this one already loaded makes that call return at its first line, so the
    // preview iframe stays off the network with the seeded services intact.
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
  });

  return () => {
    useOrgStore.setState(previousOrg);
    useRevampCatalogStore.setState(previousCatalog);
    bookingPageApi.getConfig = previousGetConfig;
    bookingPageApi.saveConfig = previousSaveConfig;
  };
};

/** Step 2 is behind Continue, so every branding story starts by pressing it. */
const goToBranding = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(canvas.getByText('Your booking page')).toBeInTheDocument());
};

const meta = {
  title: 'Onboarding/PublicBookingSetup',
  component: PublicBookingSetup,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The two-pane online-booking setup card. Step 1 is what a reviewer sees by default; ' +
          'step 2 - the whole **Branding & review** pane - only exists after Continue.\n\n' +
          'Step 2 is where the booking address lives, and its three states are the thing to ' +
          'review. The page never derives an address: it renders whatever `publicUrl` the API ' +
          'sent, and the API sends null until the practice is genuinely reachable. So an ' +
          'unpublished practice sees its reserved slug and a plain statement that there is no ' +
          'link to share, with no Copy button, and only a live page gets a copyable URL. The ' +
          'logo Replace action is still an unwired notify().\n\n' +
          'Selection is derived, not mirrored: every bookable service starts selected because ' +
          '`selected` falls back to the full id set until the user toggles something, so there is ' +
          'no effect syncing a checkbox list to the catalog.\n\n' +
          '"Copied" has no story on purpose - `copyText` needs a real `navigator.clipboard.write` ' +
          'grant, and it degrades to leaving the label at "Copy" when the write is blocked, which ' +
          'is what a sandboxed preview iframe does.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => seed(),
} satisfies Meta<typeof PublicBookingSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServicesStep: Story = {
  name: 'Step 1 - services & availability',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('of 2 · Services & availability')).toBeInTheDocument();
    await expect(canvas.queryByText(/FIELDS ASSUMED/)).not.toBeInTheDocument();

    // Three of the five catalog rows: archived and non-bookable are filtered out.
    const rows = canvas.getAllByRole('button', { pressed: true });
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent('Wellness consultation');
    await expect(rows[0]).toHaveTextContent('30 min · any practitioner');
    await expect(rows[0]).toHaveTextContent('€72.00');
    await expect(canvas.queryByText('Full mouth radiograph')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Retired nail trim')).not.toBeInTheDocument();

    // The selects carry the number the API stores, not the label.
    await expect(canvas.getByRole('combobox', { name: 'Bookable window' })).toHaveValue('28');
    await expect(canvas.getByRole('combobox', { name: 'Buffer between visits' })).toHaveValue('10');
    await expect(canvas.getByRole('switch', { name: 'Requests need confirmation' })).toBeChecked();

    // The two selects share one `grid-cols-1 sm:grid-cols-2` row: two tracks and
    // two children here, and the same grid is what drops to one column on a
    // phone - the only responsive rule on this pane.
    const selectRow = canvasElement.querySelector('[class*="sm:grid-cols-2"]') as HTMLElement;
    await expect(selectRow.children).toHaveLength(2);
    await expect(getComputedStyle(selectRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
      2
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The entry pane. Every bookable service arrives already selected, which is the point of ' +
          'the derived-selection design - the clinic opts services out rather than in.',
      },
    },
  },
};

export const ServicesStepToggle: Story = {
  name: 'Step 1 - opting a service out',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dental = canvas.getByRole('button', { pressed: true, name: /Dental scale and polish/ });

    await userEvent.click(dental);

    await waitFor(() => expect(dental).toHaveAttribute('aria-pressed', 'false'));
    await expect(canvas.getAllByRole('button', { pressed: true })).toHaveLength(2);
    // The first toggle materialises the override set from the derived default,
    // so the other two must survive it rather than resetting to empty.
    await expect(
      canvas.getByRole('button', { pressed: true, name: /Wellness consultation/ })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first toggle is the interesting one: until it happens `selected` is the derived ' +
          'full id set, and the click has to materialise that set into `selectionOverride` before ' +
          'removing one id from it. Get that copy wrong and opting one service out silently opts ' +
          'every other service out too, which is why the other two rows are counted here.',
      },
    },
  },
};

export const BrandingStep: Story = {
  name: 'Step 2 - branding & review',
  play: async ({ canvasElement }) => {
    await goToBranding(canvasElement);
    const canvas = within(canvasElement);

    await expect(canvas.getByText('of 2 · Branding & review')).toBeInTheDocument();
    // Step 1 is unmounted, not hidden.
    await expect(canvas.queryByText('What can pet parents book?')).not.toBeInTheDocument();

    // Logo row: no upload on this org, and Replace is an unwired notify().
    await expect(canvas.getByText('No logo uploaded')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Replace' })).toBeInTheDocument();

    await expect(canvas.getByRole('textbox', { name: 'Welcome message' })).toHaveValue(
      'Book a visit for your companion at Avenger Park Veterinary.'
    );
    const replyTo = canvas.getByRole('textbox', { name: 'Confirmation email reply-to' });
    await expect(replyTo).toHaveValue('');
    await expect(replyTo).toHaveAttribute('placeholder', 'frontdesk@your-clinic.vet');

    // Preview card mirrors the org, the initial and the welcome copy.
    await expect(canvas.getByText('Preview')).toBeInTheDocument();
    await expect(canvas.getByText('Avenger Park Veterinary')).toBeInTheDocument();
    await expect(canvas.getByText('Choose a service')).toBeInTheDocument();

    // Unpublished: no address has been allocated yet, and nothing offers to copy
    // one. This is the state that used to render a dead book.yosemitecrew.com URL.
    await expect(canvas.getByText('Reserved when you save')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    await expect(canvasElement.textContent).not.toContain('book.yosemitecrew.com');

    // Fields left, preview right, side by side from `md` up - two children on
    // one row, which is what the phone story below reverses.
    const row = canvasElement.querySelector('[class*="md:flex-row"]') as HTMLElement;
    await expect(row.children).toHaveLength(2);
    await expect(getComputedStyle(row).flexDirection).toBe('row');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pane the audit found undrawn. Two `A` initial chips are rendered from the same ' +
          'derived initial - one in the logo row, one in the preview - so a change to the ' +
          'fallback has to be checked in both places.',
      },
    },
  },
};

export const BrandingWithLogo: Story = {
  name: 'Step 2 - org already has a logo',
  beforeEach: () => seed({ imageURL: '/images/placeholder.png' }),
  play: async ({ canvasElement }) => {
    await goToBranding(canvasElement);
    const canvas = within(canvasElement);
    // Only the copy changes: the row still shows the initial chip, never the image.
    await expect(canvas.getByText('Current logo')).toBeInTheDocument();
    await expect(canvas.queryByText('No logo uploaded')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`hasLogo` only swaps the label. The uploaded image is never rendered here, so a clinic ' +
          'with a logo sees the same monogram chip as one without - worth confirming with design ' +
          'before this ships.',
      },
    },
  },
};

export const BrandingPreviewIsLive: Story = {
  name: 'Step 2 - preview follows the welcome field',
  play: async ({ canvasElement }) => {
    await goToBranding(canvasElement);
    const canvas = within(canvasElement);
    const welcome = canvas.getByRole('textbox', { name: 'Welcome message' });

    await userEvent.clear(welcome);
    await userEvent.type(welcome, 'Same-day slots for poorly pets.');

    const previewCopy = await canvas.findByText('Same-day slots for poorly pets.');
    await expect(previewCopy).toHaveClass('line-clamp-3');
    await expect(welcome).toHaveValue('Same-day slots for poorly pets.');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The preview is not a static mock: it re-renders from the same state as the field. It ' +
          'clamps at three lines, so a long welcome message is silently truncated in the preview ' +
          'while the field keeps it in full.',
      },
    },
  },
};

export const ServicesStepEmpty: Story = {
  name: 'Step 1 - nothing is bookable yet',
  beforeEach: () => seed({ services: [service({ isBookable: false })] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'No bookable services yet. Add services and mark them bookable in Organization → Specialities.'
      )
    ).toBeInTheDocument();
    // No rows at all - not unselected rows. The catalog holds one service; it is
    // simply not bookable, and the copy is the only thing standing in for it.
    await expect(canvas.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    await expect(canvas.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    await expect(canvas.queryByText('Wellness consultation')).not.toBeInTheDocument();

    // Everything below the list is untouched by the empty state, and Continue is
    // live: an empty booking page can be carried straight through to step 2.
    await expect(canvas.getByRole('combobox', { name: 'Bookable window' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a clinic sees before any service is marked bookable. The empty state is a single ' +
          'line of copy pointing at Organization → Specialities, and nothing stops Continue: the ' +
          'branding pane and the save button are reachable with zero services attached, so the ' +
          'guard that should exist here does not.',
      },
    },
  },
};

export const BrandingOnPhone: Story = {
  name: 'Step 2 on a phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders at full panel width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await goToBranding(canvasElement);
    const canvas = within(canvasElement);

    const row = canvasElement.querySelector('[class*="md:flex-row"]') as HTMLElement;
    await expect(getComputedStyle(row).flexDirection).toBe('column');
    await expect(row.children).toHaveLength(2);

    // The preview drops BELOW the fields rather than beside them - it is second
    // in source order, so stacking puts it after the reply-to field and pushes
    // the public URL block off a 375x812 screen entirely.
    const [fields, preview] = Array.from(row.children) as HTMLElement[];
    await expect(preview.getBoundingClientRect().top).toBeGreaterThan(
      fields.getBoundingClientRect().top
    );
    await expect(within(preview).getByText('Preview')).toBeInTheDocument();
    await expect(within(preview).getByText('Avenger Park Veterinary')).toBeInTheDocument();
    await expect(canvas.getByText('Reserved when you save')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Step 2 at 375px. The `md:w-60` preview loses its fixed width and goes full-bleed under ' +
          'the three fields, which is the one place the preview stops reading as a phone-sized ' +
          'mock of the public page and starts reading as another card in the form.',
      },
    },
  },
};

export const BrandingPublished: Story = {
  name: 'Step 2 - published practice',
  beforeEach: () =>
    seed({
      config: config({
        slug: 'avenger-park-veterinary',
        publicBookingEnabled: true,
        publicUrl: 'https://dev.yosemitecrew.com/book/avenger-park-veterinary',
        welcomeMessage: 'Book a visit for your companion at Avenger Park Veterinary.',
      }),
    }),
  play: async ({ canvasElement }) => {
    await goToBranding(canvasElement);
    const canvas = within(canvasElement);

    // The one state where an address is offered for copying: the API said the
    // page is live, so the link is safe to paste onto a website.
    await expect(
      canvas.getByText('https://dev.yosemitecrew.com/book/avenger-park-veterinary')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    await expect(canvas.getByText(/Safe to share on your website/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The published state, and the only one with a Copy button. Compare it with the default ' +
          'step 2 story: the difference between them is entirely driven by `publicUrl` coming ' +
          'back non-null from the API, never by anything the page computes.',
      },
    },
  },
};

export const BrandingOpenWithoutAddress: Story = {
  name: 'Step 2 - open, but no address configured',
  beforeEach: () =>
    seed({
      config: config({
        configured: true,
        slug: 'avenger-park-veterinary',
        publicBookingEnabled: true,
        // Reachable, but this environment has no PUBLIC_BOOKING_BASE_URL, so the
        // API can offer no link.
        publicUrl: null,
      }),
    }),
  play: async ({ canvas }) => {
    await goToBranding(document.body);

    await expect(await canvas.findByText(/Your booking page is open/)).toBeInTheDocument();
    await expect(canvas.getByText(/No public web address is configured/)).toBeInTheDocument();

    // The bug this story exists to prevent coming back.
    await expect(canvas.queryByText(/is closed/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/not live/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state that shipped wrong. Whether the page is REACHABLE is `publicBookingEnabled`; ' +
          'whether a LINK can be shown additionally needs an address configured for the ' +
          'environment. The first version branched only on the link, so a practice whose page was ' +
          'live and taking bookings was told it "is not live yet" - the same species of untruth ' +
          'this screen was rewritten to remove, pointing the other way.',
      },
    },
  },
};
