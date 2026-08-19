import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { AppointmentEncounter, SideAction } from '@/app/features/appointments/types/workspace';
import { CALCULATOR_CATEGORIES } from '@/app/features/calculators/registry';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import QuickActionsModal from './QuickActionsModal';

const APPOINTMENT_ID = 'appt-workspace-1';
const ORG_ID = 'org-storybook';

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'prac-amara', name: 'Dr. Amara Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

/**
 * The encounter the Record panel reads.
 *
 * `RecordPanel` returns `null` outright when `encountersById[appointmentId]` is
 * missing, so without this seed the Record tab renders an empty panel and a story
 * asserting "the tab routed" would pass against nothing. Seeding the real store is
 * also what keeps the mount off the network - the panel never fetches, it only
 * reads.
 */
const ENCOUNTER: AppointmentEncounter = {
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  leadId: 'prac-amara',
  leadName: 'Dr. Amara Weber',
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [
    {
      id: 'vt-1',
      code: 'VT-001',
      weightLbs: 62.4,
      tempF: 101.6,
      heartRateBpm: 96,
      respRateBpm: 24,
      crtSec: '<2',
      mucousMembrane: 'Pink',
      painScore: 2,
      bcs: 5,
      recordedByName: 'Dr. Amara Weber',
      recordedAt: '2026-03-12T12:00:00.000Z',
    },
  ],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'IN_PROGRESS',
    DIAGNOSTICS: 'EMPTY',
    TREATMENT: 'EMPTY',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
};

const seedEncounter = () => {
  const snapshot = useAppointmentWorkspaceStore.getState();
  useAppointmentWorkspaceStore.setState({
    encountersById: { ...snapshot.encountersById, [APPOINTMENT_ID]: ENCOUNTER },
  });
  return () => {
    useAppointmentWorkspaceStore.setState({ encountersById: snapshot.encountersById });
  };
};

type QuickActionsProps = ComponentProps<typeof QuickActionsModal>;

/**
 * `activeAction` is a controlled prop owned by the workspace route, so a bare
 * render can never change tabs. The harness holds it locally the way the route
 * does. It is keyed on the arg in `render`, so changing the control still
 * remounts at the requested tab.
 */
const QuickActionsHarness = (args: QuickActionsProps) => {
  const [action, setAction] = useState<SideAction | null>(args.activeAction);
  return (
    <div className="min-h-[720px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Workspace content behind the drawer, so the scrim tint and 2px blur are visible.
      </p>
      <QuickActionsModal
        {...args}
        activeAction={action}
        onChangeAction={(next) => {
          setAction(next);
          args.onChangeAction(next);
        }}
      />
    </div>
  );
};

/** The panel, once the drawer is actually open. */
const openPanel = async (): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(document.querySelector('dialog[open]')).not.toBeNull();
  });
  return document.querySelector('dialog[open]') as HTMLElement;
};

/** The nav rail's round icon buttons, in render order. */
const navButtons = (panel: HTMLElement): HTMLButtonElement[] => {
  const nav = panel.querySelector('nav[aria-label="Quick actions"]') as HTMLElement;
  return [...nav.querySelectorAll('button')] as HTMLButtonElement[];
};

const meta = {
  title: 'Workspace/QuickActionsModal',
  component: QuickActionsModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The right-docked quick-actions drawer: a rail of seven round icon tabs over one ' +
          'lazily-loaded panel. It had no story, and three things about it are invisible from ' +
          'the source alone.\n\n' +
          'First, **the drawer is always mounted**. `Modal` renders its children whether or not ' +
          'it is open and only drops the `open` attribute (adding `inert`), so a closed ' +
          'quick-actions drawer still has its whole nav rail parked in `document.body`. Any ' +
          'assertion written against the nav text rather than against `dialog[open]` passes with ' +
          'the drawer shut.\n\n' +
          'Second, **every panel is a separate `next/dynamic` chunk**. Opening a tab for the ' +
          'first time renders `PanelSkeleton` - a pulsing `min-h-50` block - and only then the ' +
          'panel, so the tab switch is a two-frame transition rather than an instant swap.\n\n' +
          'Third, **the rail is seven items in a 530px drawer**, and six of them come from one ' +
          '`NavButton` while MSD is hand-rolled around a branded `next/image` glyph. The MSD tile ' +
          'is the only one that tints its background when active (`bg-primary-100`) instead of ' +
          'only its border and ink, which is exactly the kind of drift a rail like this collects.\n\n' +
          'The Record and Calculators panels are pure store reads, so they mount here for real. ' +
          'Tasks, Documents, Chat, Activity and MSD each fetch on mount and are covered by their ' +
          'own stories where they can be reached without a service stub.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    appointmentId: APPOINTMENT_ID,
    organisationId: ORG_ID,
    encounterId: 'enc-1',
    authorId: 'prac-amara',
    activeAction: 'RECORD',
    onChangeAction: fn(),
    onClose: fn(),
  },
  render: (args) => <QuickActionsHarness key={String(args.activeAction)} {...args} />,
  beforeEach: seedEncounter,
} satisfies Meta<typeof QuickActionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (still mounted)',
  args: { activeAction: null },
  play: async () => {
    // No open dialog ...
    await expect(document.querySelector('dialog[open]')).toBeNull();
    // ... but the drawer itself, and its whole nav rail, are in the DOM.
    const parked = document.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;
    await expect(parked).not.toBeNull();
    await expect(parked).toHaveAttribute('inert');

    const dialog = parked as HTMLElement;

    /* Every assertion below this line is a raw DOM query, on purpose. The UA
       stylesheet carries `dialog:not([open]) { display: none }` and the app's
       `.yc-modal-dialog` reset overrides position/inset/margin/border but never
       `display`, so a closed drawer's subtree is display:none. Testing Library's
       role and text queries skip anything display:none, which means every
       `getByRole` here would throw and - far worse - every `queryByRole(...)
       .not.toBeInTheDocument()` would pass no matter what the rail contained.
       `querySelectorAll` does not consult the accessibility tree, so it reports
       what is actually mounted, which is the only thing this story claims. */
    await expect(navButtons(dialog).map((button) => button.textContent)).toEqual([
      'Record',
      'Tasks',
      'Documents',
      'Chat',
      'Activity',
      'MSD',
      'Calculators',
    ]);
    await expect(dialog.querySelector('h2')?.textContent).toBe('Quick actions');

    // Nothing is pressed and no panel is mounted while there is no active action.
    await expect(dialog.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    await expect(dialog.querySelectorAll('[aria-pressed="false"]')).toHaveLength(7);
    await expect(dialog.querySelector('[role="tablist"]')).toBeNull();
    await expect(dialog.querySelector('[role="tabpanel"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The closed drawer, which is not an unmounted one. `showModal` only controls the ' +
          '`open` attribute, the slide transform and `inert`; the header and the seven-tab rail ' +
          'stay in `document.body` the whole time. Absence has to be asserted against ' +
          '`dialog[open]` here, never against the nav copy.\n\n' +
          'Two consequences a reviewer should look at. The exit transition is never seen: ' +
          '`open` is dropped in the same render as `translate-x-[120%]`, and a `<dialog>` ' +
          'without `open` is `display: none` per the UA stylesheet, so the 300ms slide-out ' +
          'plays on an already-hidden element. And because the subtree is display:none rather ' +
          'than unmounted, the seven tab buttons stay in the DOM with `aria-pressed="false"` - ' +
          'out of the accessibility tree today only by virtue of that `display`, not by ' +
          'anything the component does.',
      },
    },
  },
};

export const RecordPanel: Story = {
  name: 'Record tab',
  play: async () => {
    const panel = await openPanel();
    const inPanel = within(panel);

    await expect(inPanel.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();

    // Seven tabs, in order, exactly one pressed.
    const buttons = navButtons(panel);
    await expect(buttons).toHaveLength(7);
    await expect(buttons.map((button) => button.textContent)).toEqual([
      'Record',
      'Tasks',
      'Documents',
      'Chat',
      'Activity',
      'MSD',
      'Calculators',
    ]);
    await expect(panel.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    await expect(inPanel.getByRole('button', { name: 'Record' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    /* The panel is a `next/dynamic` chunk, so it arrives a frame after the rail.
       Asserting the real Record panel drew - its two tabs and the seeded vital -
       rather than that some node appeared where the skeleton was. */
    expect(await inPanel.findByRole('tab', { name: 'Vitals' })).toBeInTheDocument();
    await expect(inPanel.getByRole('tab', { name: 'Observation Tool' })).toBeInTheDocument();
    await expect(inPanel.getByText('VT-001')).toBeInTheDocument();
    await expect(inPanel.getByText('Dr. Amara Weber')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as the workspace first opens it. Header, the rail with a 1px rule under ' +
          'it, then the panel in a `min-h-0 flex-1 overflow-y-auto scrollbar-hidden` column - so ' +
          'the panel scrolls inside the drawer while the header and rail stay put.',
      },
    },
  },
};

export const ActiveTabStyling: Story = {
  name: 'Active tab styling',
  play: async () => {
    const panel = await openPanel();
    const inPanel = within(panel);
    const active = inPanel.getByRole('button', { name: 'Record' });
    const idle = inPanel.getByRole('button', { name: 'Tasks' });

    // The circle is the first span inside the button; the label is the second.
    const activeCircle = active.querySelector('span') as HTMLElement;
    const idleCircle = idle.querySelector('span') as HTMLElement;

    /* Polled rather than read once: the circle carries `transition-colors
       duration-150`, so a synchronous read taken in the same frame as the mount
       can catch an interpolated border colour and compare equal by accident. */
    await waitFor(() => {
      expect(getComputedStyle(activeCircle).borderColor).not.toBe(
        getComputedStyle(idleCircle).borderColor
      );
      expect(getComputedStyle(activeCircle).color).not.toBe(getComputedStyle(idleCircle).color);
    });

    const activeLabel = active.querySelectorAll('span')[1] as HTMLElement;
    const idleLabel = idle.querySelectorAll('span')[1] as HTMLElement;

    /* PINNED TO CURRENT BEHAVIOUR - the active label does not actually go bold.
       The component asks for it: `QuickActionsModal.tsx` renders the active
       label as `text-caption-2 font-bold`. But `.text-caption-2` is declared
       OUTSIDE `@layer` in `globals.css` with `font-weight: 500 !important`, and
       an unlayered `!important` declaration beats every Tailwind utility, so
       `font-bold` never lands and both labels compute to 500. That is a
       stylesheet defect the component is a victim of, not a component defect -
       tracked as issue #2297.

       The class assertions are here so the contradiction is in the failure
       output rather than hidden behind a soft assertion: the markup says
       `font-bold`, the computed weight says 500. When #2297 is fixed the two
       weights will diverge, this block will fail loudly, and it should then be
       restored to `expect(active).not.toBe(idle)`. */
    await expect(activeLabel).toHaveClass('text-caption-2');
    await expect(activeLabel).toHaveClass('font-bold');
    await expect(idleLabel).not.toHaveClass('font-bold');
    await waitFor(() => {
      expect(getComputedStyle(activeLabel).fontWeight).toBe('500');
      expect(getComputedStyle(idleLabel).fontWeight).toBe('500');
    });

    /* The distinction the active label does deliver is colour: `text-blue-text`
       against the idle `text-neutral-700`. `.text-caption-2` sets no `color`, so
       this is the one half of the active treatment that survives #2297, and it
       is what the tab actually reads as today. Polled because the tile animates
       with `transition-colors`. */
    await waitFor(() => {
      expect(getComputedStyle(activeLabel).color).not.toBe(getComputedStyle(idleLabel).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The active tab asks for three changes at once - `--text-brand` border, `--blue-text` ' +
          'ink and a bold label - and none of them is a background fill. Only two of the three ' +
          'arrive: the `font-bold` on the label is dead, because `.text-caption-2` is declared ' +
          'outside `@layer` with `font-weight: 500 !important` and unlayered `!important` beats ' +
          'any utility (issue #2297). The play function is pinned to that, and asserts the ' +
          '`font-bold` class is present so the contradiction is visible rather than papered ' +
          'over. The MSD tile breaks the no-fill pattern by filling with `bg-primary-100` when ' +
          'active, which is visible by switching to it in the story below.',
      },
    },
  },
};

export const SwitchToCalculators: Story = {
  name: 'Switching tab loads another chunk',
  play: async ({ args }) => {
    const panel = await openPanel();
    const inPanel = within(panel);
    expect(await inPanel.findByRole('tab', { name: 'Vitals' })).toBeInTheDocument();

    await userEvent.click(inPanel.getByRole('button', { name: 'Calculators' }));
    await expect(args.onChangeAction).toHaveBeenCalledWith('CALCULATORS');

    // The previous panel is unmounted, not hidden - only one panel exists at a time.
    await waitFor(() => {
      expect(inPanel.queryByRole('tab', { name: 'Vitals' })).not.toBeInTheDocument();
    });

    /* Assert the calculators panel really drew: the category track carries one
       segment per registry category, so a truncated or empty track fails here
       rather than passing on "something rendered". */
    const track = await inPanel.findByRole('group', { name: 'Calculator category' });
    await expect(within(track).getAllByRole('button')).toHaveLength(CALCULATOR_CATEGORIES.length);
    await expect(
      within(track).getByRole('button', { name: CALCULATOR_CATEGORIES[0] })
    ).toBeInTheDocument();

    // Pressed state moved with it.
    await expect(inPanel.getByRole('button', { name: 'Calculators' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(inPanel.getByRole('button', { name: 'Record' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* Counted over the nav rail, not over the whole drawer. `aria-pressed` is
       not a rail-only attribute: the calculators panel's category track is a
       `SegmentedPill`, and every segment in it carries `aria-pressed`, so a
       drawer-wide count reads two here - the Calculators tab plus the selected
       category - and would keep climbing as panels add toggles. Exactly one
       pressed *tab* is what this story claims, so the query is scoped to the
       seven rail buttons. */
    await expect(
      navButtons(panel).filter((button) => button.getAttribute('aria-pressed') === 'true')
    ).toHaveLength(1);

    // And the track that supplied the second one keeps exactly one segment pressed.
    await expect(track.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tabs are exclusive `activeAction === X` branches, so switching unmounts the previous ' +
          'panel entirely and any unsaved draft in it goes with it. The category track scrolls ' +
          'horizontally inside the 530px drawer rather than wrapping, which is the reason the ' +
          'registry can carry more categories than fit.',
      },
    },
  },
};

export const MsdTabActive: Story = {
  name: 'MSD tile active',
  args: { activeAction: 'MSD' },
  play: async () => {
    const panel = await openPanel();
    const inPanel = within(panel);
    const msd = inPanel.getByRole('button', { name: 'MSD' });
    const record = inPanel.getByRole('button', { name: 'Record' });

    await expect(msd).toHaveAttribute('aria-pressed', 'true');

    /* MSD is the only tile that fills. Every `NavButton` keeps a transparent
       circle and changes border + ink only, so comparing backgrounds against an
       idle sibling is what shows the divergence. */
    const msdCircle = msd.querySelector('span') as HTMLElement;
    const recordCircle = record.querySelector('span') as HTMLElement;
    await waitFor(() => {
      expect(getComputedStyle(msdCircle).backgroundColor).not.toBe(
        getComputedStyle(recordCircle).backgroundColor
      );
    });

    // The branded glyph is decorative, so it must not add a name to the tile.
    const glyph = msd.querySelector('img') as HTMLImageElement;
    await expect(glyph).toHaveAttribute('alt', '');
    await expect(msd).toHaveTextContent('MSD');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The MSD tab, whose tile is hand-rolled rather than a `NavButton`: it swaps a ' +
          '`next/image` of the Merck glyph for the icon and fills the circle with ' +
          '`bg-primary-100` when active. The six `NavButton` tiles set no background at all, so ' +
          'their circles stay transparent in both states and change only border and ink - the ' +
          'MSD tile is also the only one carrying an explicit idle fill (`bg-neutral-0`). The ' +
          'panel below it fetches on mount, so this story is about the rail, not the panel.',
      },
    },
  },
};

export const PhoneFullScreen: Story = {
  name: 'Phone: drawer goes full-screen',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    const panel = await openPanel();
    const inPanel = within(panel);

    /* "Full-screen" is the claim in the component's own docs, so measure it
       rather than trust the story name: the panel must span the viewport exactly,
       not merely be wide. Polled because `useIsPhone` is false through SSR and
       the first client render - the class swap is a post-mount effect, so a read
       taken immediately still sees the desktop drawer. */
    await waitFor(() => {
      const width = panel.getBoundingClientRect().width;
      expect(Math.abs(width - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });

    // All seven tabs survive the 375px rail; none is dropped at this width.
    const buttons = navButtons(panel);
    await expect(buttons).toHaveLength(7);
    await expect(inPanel.getByRole('button', { name: 'Calculators' })).toBeInTheDocument();

    /* The rail is `flex justify-between` and flex does not wrap by default, so
       the seven tiles stay on one line. Read rather than assumed - adding
       `flex-wrap` to that nav would drop the last tiles onto a second row and
       change the drawer's whole header height. */
    const first = buttons[0].getBoundingClientRect();
    const last = buttons[6].getBoundingClientRect();
    await expect(Math.abs(first.top - last.top)).toBeLessThan(1);

    expect(await inPanel.findByRole('tab', { name: 'Vitals' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Under 768px the shared `Modal` re-forms a drawer into a full-screen panel, so the ' +
          'quick actions take the whole phone. Seven 44px circles plus their labels across 375px ' +
          'minus the rail padding is the tightest this component ever gets - the labels are ' +
          '`text-caption-2` and "Calculators" is the one that sets the column width.',
      },
    },
  },
};
