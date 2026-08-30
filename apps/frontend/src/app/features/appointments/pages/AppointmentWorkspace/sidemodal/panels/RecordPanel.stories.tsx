import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type {
  AppointmentEncounter,
  ObservationRecord,
  Vitals,
} from '@/app/features/appointments/types/workspace';
import { buildEmptyEncounter } from '@/app/features/appointments/services/workspaceInitialData';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import RecordPanel from './RecordPanel';

const APPOINTMENT_ID = 'appt-workspace-1';
const ORG_ID = 'org-storybook';

/** Newest first, which is the order the store keeps them in. */
const VITALS: Vitals[] = [
  {
    id: 'vt-2',
    code: 'VT-002',
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
  {
    id: 'vt-1',
    code: 'VT-001',
    weightLbs: 60,
    recordedByName: 'Dr. Amara Weber',
    recordedAt: '2026-03-05T12:00:00.000Z',
  },
];

const OBSERVATIONS: ObservationRecord[] = [
  {
    id: 'ot-1',
    code: 'OT-001',
    toolKey: 'FGS',
    toolName: 'Feline grimace scale',
    scores: {
      'Ear position': 1,
      'Orbital tightening': 2,
      'Muzzle tension': 1,
    },
    total: 4,
    recordedByName: 'Dr. Amara Weber',
    recordedAt: '2026-03-12T12:00:00.000Z',
  },
];

/**
 * The panel reads the encounter straight out of the workspace store and returns
 * `null` when it is missing, so the seed is what makes the panel exist at all.
 *
 * Built from `buildEmptyEncounter` rather than a hand-written literal: the
 * encounter carries ~30 required fields and a literal here would need editing
 * every time one is added, which is exactly how a story starts silently
 * rendering a shape production never produces. The snapshot is restored on
 * unmount so neighbouring stories are unaffected.
 */
const seedEncounter =
  (patch: Partial<AppointmentEncounter> = {}) =>
  () => {
    const snapshot = useAppointmentWorkspaceStore.getState();
    useAppointmentWorkspaceStore.setState({
      encountersById: {
        [APPOINTMENT_ID]: { ...buildEmptyEncounter(APPOINTMENT_ID, 'OUTPATIENT'), ...patch },
      },
    });
    return () => {
      useAppointmentWorkspaceStore.setState(snapshot);
    };
  };

/** No entry at all for this appointment id, which is the pre-hydration state. */
const withoutEncounter = () => {
  const snapshot = useAppointmentWorkspaceStore.getState();
  useAppointmentWorkspaceStore.setState({ encountersById: {} });
  return () => {
    useAppointmentWorkspaceStore.setState(snapshot);
  };
};

/** The mounted tabpanel for a tab key, or null when that tab is not the active one. */
const panelFor = (canvasElement: HTMLElement, key: 'VITALS' | 'OBSERVATION') =>
  canvasElement.querySelector(`#record-panel-${key}`) as HTMLElement | null;

const meta = {
  title: 'Workspace/RecordPanel',
  component: RecordPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Record tab of the quick-actions drawer. It owns three things the two form stories ' +
          'next to it cannot show, because none of them exist inside a form.\n\n' +
          '**The encounter gate.** The panel subscribes to `encountersById[appointmentId]` and ' +
          'returns `null` when there is no entry, so before the workspace hydrates the drawer tab ' +
          'renders nothing at all - not an empty state, not a spinner, not even the tab strip. An ' +
          'encounter that exists with empty arrays is a different state entirely, and the two are ' +
          'easy to confuse when reading the file.\n\n' +
          '**The tab-to-panel wiring.** `TabToggle` builds `aria-controls` from a `panelId` ' +
          'callback passed in from here, while the `id` and `aria-labelledby` on the panel div are ' +
          'written by hand a few lines below. Nothing joins the two halves, so a rename on either ' +
          'side leaves a tab pointing at an element that does not exist and the failure is ' +
          'completely invisible on screen.\n\n' +
          '**The prop fan-out.** Each form is fed its own slice of the encounter (`vitals` / ' +
          '`observations`) and the panel renames two props on the way through - `authorId` becomes ' +
          '`filledBy` and `authorName` becomes `filledByName`. `ObservationToolForm` disables ' +
          'Start when `filledBy` is missing, so a broken rename shows up as a permanently disabled ' +
          'action rather than as a type error.\n\n' +
          'The inactive tab is unmounted rather than hidden, which means an in-progress vitals ' +
          'draft does not survive a trip to the Observation tab. That is drawn here too.\n\n' +
          'Nothing here needs the network. `VitalsForm` asks for its template list on mount and ' +
          'gathers the three requests with `Promise.allSettled`, so offline it resolves to an ' +
          'empty list; the observation submission is only fired by pressing Start, which no story ' +
          'here does.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    organisationId: ORG_ID,
    encounterId: 'enc-1',
    authorId: 'prac-amara',
    authorName: 'Dr. Amara Weber',
    companionId: 'companion-1',
  },
  decorators: [
    /* The quick-actions drawer is 530px wide with 16px of padding, and both
       forms paint their floating labels against `--screen`. On any other ground
       the label notch reads as a stripe through the field border. */
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedEncounter({ vitals: VITALS, observations: OBSERVATIONS }),
} satisfies Meta<typeof RecordPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VitalsTab: Story = {
  name: 'Vitals tab with recorded vitals',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const vitalsTab = canvas.getByRole('tab', { name: 'Vitals' });
    const observationTab = canvas.getByRole('tab', { name: 'Observation Tool' });
    await expect(canvas.getAllByRole('tab')).toHaveLength(2);
    await expect(vitalsTab).toHaveAttribute('aria-selected', 'true');
    await expect(observationTab).toHaveAttribute('aria-selected', 'false');

    /* The wiring check. `aria-controls` is generated by TabToggle from the
       `panelId` callback this panel hands it; the matching `id` and
       `aria-labelledby` are hand-written on the panel div. Renaming one side
       breaks the pairing with no visible symptom, so both directions are read. */
    await expect(vitalsTab).toHaveAttribute('id', 'tab-VITALS');
    await expect(vitalsTab).toHaveAttribute('aria-controls', 'record-panel-VITALS');
    const panel = panelFor(canvasElement, 'VITALS') as HTMLElement;
    await expect(panel).toBeInTheDocument();
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'tab-VITALS');

    // The inactive tab is unmounted, not hidden: exactly one panel exists.
    await expect(canvasElement.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    await expect(panelFor(canvasElement, 'OBSERVATION')).toBeNull();

    /* The fan-out. Both vitals reach the form and both live inside the panel,
       while the observations hanging off the same encounter do not - the panel
       hands each form its own slice rather than the whole encounter. */
    await expect(within(panel).getByText('VT-002')).toBeInTheDocument();
    await expect(within(panel).getByText('VT-001')).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(2);
    await expect(canvas.queryByText('OT-001')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Feline grimace scale')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tab the drawer opens on. Two equal-width tabs over the vitals list, with the ' +
          'active one carrying the blue underline that `-mb-px` pulls onto the strip border.',
      },
    },
  },
};

export const VitalsTabEmpty: Story = {
  name: 'Vitals tab, nothing recorded',
  beforeEach: seedEncounter(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* An encounter with empty arrays is NOT the missing-encounter case: the tab
       strip and the panel are both still here. That distinction is the whole
       reason this story sits next to the no-encounter one. */
    await expect(canvas.getAllByRole('tab')).toHaveLength(2);
    await expect(panelFor(canvasElement, 'VITALS')).toBeInTheDocument();

    const panel = panelFor(canvasElement, 'VITALS') as HTMLElement;
    await expect(within(panel).getByText('No vitals recorded yet.')).toBeInTheDocument();
    await expect(within(panel).getByRole('button', { name: 'New Vital' })).toBeInTheDocument();
    // The whole <ul> is conditional, so there is no empty list wrapper either.
    await expect(canvasElement.querySelectorAll('ul')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A hydrated encounter with nothing recorded yet. The tab strip stays, the panel stays, ' +
          'and the empty copy comes from `VitalsForm`. Compare with the no-encounter story below, ' +
          'which draws none of this.',
      },
    },
  },
};

export const ObservationTab: Story = {
  name: 'Observation tab via initialTab',
  args: { initialTab: 'OBSERVATION' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `initialTab` seeds the useState, so this is the first paint, not a click.
    const observationTab = canvas.getByRole('tab', { name: 'Observation Tool' });
    await expect(observationTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tab', { name: 'Vitals' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    await expect(observationTab).toHaveAttribute('aria-controls', 'record-panel-OBSERVATION');
    const panel = panelFor(canvasElement, 'OBSERVATION') as HTMLElement;
    await expect(panel).toBeInTheDocument();
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'tab-OBSERVATION');
    await expect(panelFor(canvasElement, 'VITALS')).toBeNull();

    // The observations slice arrives, the vitals slice does not.
    await expect(within(panel).getByText('OT-001')).toBeInTheDocument();
    await expect(canvas.queryByText('VT-002')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'New Vital' })).not.toBeInTheDocument();

    /* Start is the proof that `authorId` -> `filledBy` and `companionId` survive
       the hop through this panel. `ObservationToolForm` disables the button and
       prints a reason when any of org / companion / clinician is missing, so a
       dropped or misnamed prop shows up here as a dead action rather than as a
       compile error. */
    await expect(within(panel).getByRole('button', { name: 'Start' })).toBeEnabled();
    await expect(
      canvas.queryByText('Recording is available once the encounter and clinician are loaded.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opened straight onto the Observation Tool tab, which is how the drawer arrives when a ' +
          'quick action targets scoring. `initialTab` only seeds the initial state, so a later ' +
          'change to the prop does not move the tab.',
      },
    },
  },
};

export const SwitchingTabs: Story = {
  name: 'Switching tabs discards the open editor',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const vitalsTab = canvas.getByRole('tab', { name: 'Vitals' });
    const observationTab = canvas.getByRole('tab', { name: 'Observation Tool' });

    // Put the vitals form into a state that only exists in its local reducer.
    await userEvent.click(canvas.getByRole('button', { name: 'New Vital' }));
    expect(await canvas.findByText('New vitals')).toBeInTheDocument();

    await userEvent.click(observationTab);
    await expect(observationTab).toHaveAttribute('aria-selected', 'true');
    await expect(vitalsTab).toHaveAttribute('aria-selected', 'false');
    const observationPanel = panelFor(canvasElement, 'OBSERVATION') as HTMLElement;
    await expect(observationPanel).toBeInTheDocument();
    await expect(observationPanel).toHaveAttribute('aria-labelledby', 'tab-OBSERVATION');
    await expect(panelFor(canvasElement, 'VITALS')).toBeNull();
    await expect(canvasElement.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);

    /* The underline is the only visual signal that the tab moved, and it is a
       border colour rather than a background, so it is easy to lose to a token
       rename. Polled: TabToggle carries `transition-colors duration-150` and a
       single read on the click tick lands mid-interpolation. */
    await waitFor(() => {
      expect(getComputedStyle(observationTab).borderBottomColor).not.toBe(
        getComputedStyle(vitalsTab).borderBottomColor
      );
    });

    await userEvent.click(vitalsTab);
    await expect(vitalsTab).toHaveAttribute('aria-selected', 'true');

    /* Back on the vitals list, not back in the editor. `creating` lives in a
       `useReducer` inside VitalsForm with nothing persisting it, so unmounting
       the panel throws away an unsaved draft - a clinician who opens the editor,
       glances at the Observation tab and comes back loses what they typed. */
    await expect(await canvas.findByRole('button', { name: 'New Vital' })).toBeInTheDocument();
    await expect(canvas.queryByText('New vitals')).not.toBeInTheDocument();
    await expect(canvas.getByText('VT-002')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tab switch replaces the panel rather than hiding it, so each form is mounted fresh ' +
          'every time its tab is chosen. Worth a decision: the discarded vitals draft is silent, ' +
          'with no confirmation and no restored values.',
      },
    },
  },
};

export const NoEncounter: Story = {
  name: 'No encounter in the store',
  beforeEach: withoutEncounter,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `if (!encounter) return null` runs before the tab strip, so this renders
       nothing whatsoever - no tabs, no panel, no controls. Counting buttons as
       well as querying by role, because a header or a strip that survived the
       guard would be the actual regression here and a single role query could
       miss it. */
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('tab')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('[role="tabpanel"]')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('button')).toHaveLength(0);
    await expect(canvas.queryByText('No vitals recorded yet.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the Record tab looks like before the workspace hydrates, or for an appointment ' +
          'whose encounter never loaded: an empty drawer body. There is no loading state and no ' +
          'explanation, which is the state to weigh up - a slow hydrate is indistinguishable from ' +
          'a failed one.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: tab strip geometry',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tablist = canvas.getByRole('tablist');
    const [vitalsTab, observationTab] = canvas.getAllByRole('tab');

    /* Both tabs are `flex-1` with `px-6`, so the split must stay even even though
       "Observation Tool" is nearly three times the length of "Vitals". At 375 the
       drawer is full-screen and this is the width where an intrinsic-width tab
       would first show up as a lopsided strip. */
    const vitalsBox = vitalsTab.getBoundingClientRect();
    const observationBox = observationTab.getBoundingClientRect();
    await expect(Math.abs(vitalsBox.width - observationBox.width)).toBeLessThanOrEqual(1);

    // One row, not two: the labels wrap inside their own button before the
    // second tab is pushed under the first.
    await expect(Math.abs(vitalsBox.top - observationBox.top)).toBeLessThanOrEqual(1);

    // And the strip itself does not scroll sideways inside the drawer.
    await expect(tablist.scrollWidth).toBeLessThanOrEqual(tablist.clientWidth + 1);

    // The panel below is still the wired one at this width.
    await expect(panelFor(canvasElement, 'VITALS')).toBeInTheDocument();
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the quick-actions drawer goes full-screen, so this is the real phone width for ' +
          'the tab strip. The two labels are very different lengths and the tabs are still forced ' +
          'to an even split, which leaves "Observation Tool" close to wrapping inside its own ' +
          'button.',
      },
    },
  },
};
