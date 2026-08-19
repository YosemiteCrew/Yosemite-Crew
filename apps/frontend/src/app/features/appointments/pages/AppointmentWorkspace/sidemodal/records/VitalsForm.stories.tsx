import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { Vitals } from '@/app/features/appointments/types/workspace';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import VitalsForm from './VitalsForm';

const ORG_ID = 'org-storybook';

/**
 * Newest first, which is the order the store keeps them in and the order the
 * weight trend depends on.
 *
 * `VT-001` deliberately carries nothing but a weight: the breakdown grid always
 * renders all eight cells, so a sparse record is the only way to see the seven
 * `-` placeholders. `VT-002` carries `recordedById` and the placeholder name
 * `Clinician`, which is the shape a hydrated (server-loaded) vital arrives in.
 */
const VITALS: Vitals[] = [
  {
    id: 'vt-3',
    code: 'VT-003',
    weightLbs: 62.4,
    tempF: 101.6,
    heartRateBpm: 96,
    respRateBpm: 24,
    crtSec: '<2',
    mucousMembrane: 'Pink',
    painScore: 2,
    bcs: 5,
    notes: 'Settled once the second exam finished.',
    recordedByName: 'Dr. Amara Weber',
    recordedAt: '2026-03-12T12:00:00.000Z',
  },
  {
    id: 'vt-2',
    code: 'VT-002',
    weightLbs: 60,
    tempF: 102.1,
    heartRateBpm: 104,
    respRateBpm: 28,
    crtSec: '2',
    mucousMembrane: 'Pale',
    painScore: 4,
    bcs: 5,
    recordedByName: 'Clinician',
    recordedById: 'prac-jonah',
    recordedAt: '2026-03-05T12:00:00.000Z',
  },
  {
    id: 'vt-1',
    code: 'VT-001',
    weightLbs: 58.2,
    recordedByName: 'Clinician',
    recordedAt: '2026-02-19T12:00:00.000Z',
  },
];

/** Same three records, but the newest weight is below the previous one. */
const LOSING_WEIGHT: Vitals[] = [{ ...VITALS[0], weightLbs: 58.2 }, VITALS[1], VITALS[2]];

const JONAH: Team = {
  _id: 'team-jonah',
  practionerId: 'prac-jonah',
  organisationId: ORG_ID,
  name: 'Jonah Pike',
  role: 'TECHNICIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
};

/**
 * Seeds the roster the real way and restores it afterwards.
 *
 * `useTeamForPrimaryOrg` is a pure store read - the fetch lives in the separate
 * `useLoadTeam`, which this form never calls - so seeding `teamStore` plus the
 * primary org id is enough to exercise the id-to-name resolution with no network
 * and no service stub.
 */
const seedRoster = (members: Team[]) => () => {
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useTeamStore.setState({
    teamsById: Object.fromEntries(members.map((member) => [member._id, member])),
    teamIdsByOrgId: { [ORG_ID]: members.map((member) => member._id) },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(orgSnapshot);
    useTeamStore.setState(teamSnapshot);
  };
};

/** Opens one recorded vital's breakdown and returns its grid. */
const expandRow = async (canvasElement: HTMLElement, code: string) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: `View ${code}` }));
  // The toggle relabels, which is the only announced signal that the row opened.
  expect(await canvas.findByRole('button', { name: `Hide ${code}` })).toBeInTheDocument();
  const grid = canvasElement.querySelector('.grid.grid-cols-2') as HTMLElement | null;
  await expect(grid).toBeInTheDocument();
  return grid as HTMLElement;
};

/** Switches the form from the recorded list into the "New vitals" editor. */
const openEditor = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'New Vital' }));
  expect(await canvas.findByText('New vitals')).toBeInTheDocument();
  return canvas;
};

const meta = {
  title: 'Workspace/VitalsForm',
  component: VitalsForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Vitals tab of the quick-actions Record panel. Two surfaces inside it had never ' +
          'been drawn, and both are behind a click.\n\n' +
          'The first is the **expanded `VitalRow` breakdown**. `VitalRow` holds its own ' +
          '`useState`, is module-private, and renders a `grid-cols-2` block of eight fixed ' +
          'cells - weight, temp, heart rate, resp. rate, CRT, MM, pain and BCS - each with its ' +
          'unit baked into the string. It always renders all eight whatever the record holds, so ' +
          'a vital saved with only a weight draws seven `-` placeholders. Nothing about that is ' +
          'visible from the collapsed row, which shows only the stamp, the code and the recorder.\n\n' +
          'The second is the **"New vitals" editor**, which replaces the list entirely rather ' +
          'than appearing under it (`if (!creating) return` early). Its numeric grid renders five ' +
          'inputs, not eight: BCS, pain score and mucous membrane are pulled out of the grid by ' +
          "`OBSERVATION_GRID_KEYS` and re-rendered below as segmented pickers on the app's real " +
          'ranges (1..9, 0..10, three membrane colours) rather than the narrower windows the ' +
          'design shows. They are still validated as required fields, which is only observable ' +
          'by pressing Save on an empty draft.\n\n' +
          'The weight trend chip lives in the editor too, not in the list, and needs **two** ' +
          'records carrying a weight before it renders at all.\n\n' +
          'Nothing here needs the network: the vitals arrive as a prop, the recorder roster is a ' +
          'plain store read, and `listVitalsTemplates` funnels three requests through ' +
          '`Promise.allSettled`, so offline it resolves to an empty template list instead of ' +
          'rejecting. The template search therefore reaches its own no-match state here.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: 'appt-workspace-1',
    organisationId: ORG_ID,
    encounterId: 'enc-1',
    authorId: 'prac-amara',
    authorName: 'Dr. Amara Weber',
    vitals: VITALS,
  },
  decorators: [
    /* The drawer this lives in is 530px wide, and `VitalsField`'s floating label
       paints its own notch with `background: var(--screen)`. On any other ground
       the notch reads as a stripe through the border, so the wrapper sets both
       the drawer width and the drawer's surface colour. */
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VitalsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecordedList: Story = {
  name: 'Recorded vitals (collapsed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = canvasElement.querySelectorAll('li');
    await expect(rows).toHaveLength(3);
    await expect(canvas.getByText('VT-003')).toBeInTheDocument();
    await expect(canvas.getByText('VT-002')).toBeInTheDocument();
    await expect(canvas.getByText('VT-001')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Amara Weber')).toBeInTheDocument();

    /* The stamp is `formatStampDate`, which prints "Today" for today and a
       "Mon D" short date otherwise. Asserting the shape rather than a literal,
       because the formatter renders in the preferred time zone and a literal
       would flip a day either side of UTC. */
    await expect(canvas.getAllByText(/^[A-Z][a-z]{2} \d{1,2}$/)).toHaveLength(3);

    // No breakdown until a row is opened - all three start closed independently.
    await expect(canvas.queryByText(/^Weight: /)).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('.grid.grid-cols-2')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list. Each row is stamp / code on the left, recorder chip and the round ' +
          'dark eye toggle on the right. The stamp is tinted `--pill-success-text`, which is the ' +
          'only colour in the row and is doing the work of a "recent" cue.',
      },
    },
  },
};

export const RowExpanded: Story = {
  name: 'Row breakdown (expanded)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = await expandRow(canvasElement, 'VT-003');

    /* Eight cells against a two-track template. Neither side is enforced: the
       cells are eight loose spans and the template is a utility class, so a
       template that ever collapses to one track silently stacks them into a
       column and nothing fails. Read both. */
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(8);

    await expect(canvas.getByText('Weight: 62.4 lbs')).toBeInTheDocument();
    await expect(canvas.getByText('Temp: 101.6 °F')).toBeInTheDocument();
    await expect(canvas.getByText('Heart rate: 96 bpm')).toBeInTheDocument();
    await expect(canvas.getByText('Resp. rate: 24 bpm')).toBeInTheDocument();
    await expect(canvas.getByText('CRT: <2')).toBeInTheDocument();
    await expect(canvas.getByText('MM: Pink')).toBeInTheDocument();
    await expect(canvas.getByText('Pain: 2 / 10')).toBeInTheDocument();
    await expect(canvas.getByText('BCS: 5 / 9')).toBeInTheDocument();

    // The other two rows stay shut: each VitalRow owns its own open flag.
    await expect(canvasElement.querySelectorAll('.grid.grid-cols-2')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full breakdown for a complete record. The units are part of the cell text rather ' +
          'than separate nodes, so "Pain: 2 / 10" and "BCS: 5 / 9" carry their scale inline - ' +
          "the same denominators the editor's segmented pickers offer.",
      },
    },
  },
};

export const RowExpandedSparse: Story = {
  name: 'Row breakdown with missing values',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = await expandRow(canvasElement, 'VT-001');

    // Still eight cells and two tracks - the grid is not built from the record.
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(8);

    await expect(canvas.getByText('Weight: 58.2 lbs')).toBeInTheDocument();
    await expect(canvas.getByText('Temp: - °F')).toBeInTheDocument();
    await expect(canvas.getByText('Heart rate: - bpm')).toBeInTheDocument();
    await expect(canvas.getByText('Resp. rate: - bpm')).toBeInTheDocument();
    await expect(canvas.getByText('CRT: -')).toBeInTheDocument();
    await expect(canvas.getByText('MM: -')).toBeInTheDocument();
    await expect(canvas.getByText('Pain: - / 10')).toBeInTheDocument();
    await expect(canvas.getByText('BCS: - / 9')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A weight-only record, which is what a quick weigh-in leaves behind. Seven of the eight ' +
          'cells fall back to `-` and the unit stays, so the row reads "Pain: - / 10". Worth ' +
          'reviewing: at a glance a `-` with a unit is easy to misread as a zero reading rather ' +
          'than an unrecorded one.',
      },
    },
  },
};

export const RowsExpandIndependently: Story = {
  name: 'Two rows open at once',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandRow(canvasElement, 'VT-003');
    await expandRow(canvasElement, 'VT-002');

    await expect(canvasElement.querySelectorAll('.grid.grid-cols-2')).toHaveLength(2);
    // Both breakdowns are real, not one node reused: their values differ.
    await expect(canvas.getByText('Heart rate: 96 bpm')).toBeInTheDocument();
    await expect(canvas.getByText('Heart rate: 104 bpm')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Hide VT-003' }));
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('.grid.grid-cols-2')).toHaveLength(1);
    });
    await expect(canvas.getByText('Heart rate: 104 bpm')).toBeInTheDocument();
    await expect(canvas.queryByText('Heart rate: 96 bpm')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The list is not an accordion. Each row holds its own `open` state, so opening a second ' +
          'row leaves the first one open and closing it leaves the second alone. That is a real ' +
          'layout case - two eight-cell blocks stacked inside a 530px drawer - and it is the ' +
          'state a clinician comparing two readings actually ends up in.',
      },
    },
  },
};

export const RecorderResolvedFromRoster: Story = {
  name: 'Recorder resolved from the team roster',
  beforeEach: seedRoster([JONAH]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* VT-002 stores the placeholder name "Clinician" plus a practitioner id.
       `resolveRecorderName` treats "Clinician" as "no real name" and looks the id
       up in the roster, so the chip must read the person, not the placeholder. */
    expect(await canvas.findByText('Jonah Pike')).toBeInTheDocument();

    // VT-001 has no recorder id at all, so it keeps the placeholder.
    await expect(canvas.getByText('Clinician')).toBeInTheDocument();
    // VT-003 stored a real name and never consults the roster.
    await expect(canvas.getByText('Dr. Amara Weber')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "A vital loaded from the server often carries only the recorder's practitioner id and " +
          'the literal string "Clinician". The form maps every roster member by both ' +
          '`practionerId` and `_id` and swaps the placeholder for the real name. With an empty ' +
          'roster the same three rows read "Clinician" twice, which is what the other stories ' +
          'here show - so this is the difference the roster makes, not a different component.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No vitals recorded',
  args: { vitals: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No vitals recorded yet.')).toBeInTheDocument();
    // The empty copy replaces the list, but the entry point stays.
    await expect(canvas.getByRole('button', { name: 'New Vital' })).toBeInTheDocument();
    // The whole <ul> is conditional, so there is no empty list wrapper either.
    await expect(canvasElement.querySelectorAll('ul')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(0);
    // And it is the list branch, not the editor: `creating` is still false.
    await expect(canvas.queryByText('New vitals')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('searchbox', { name: 'Search vitals templates' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A first visit, before anything has been weighed. The copy is one centred ' +
          '`text-body-4` line where the bordered list would be, so the panel loses its card edge ' +
          'entirely and the New Vital pill sits directly under a line of text. Worth comparing ' +
          'against the Observation Tool tab, which renders no empty-state copy at all.',
      },
    },
  },
};

export const NewVitalsEditor: Story = {
  name: 'New vitals editor',
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);

    // The list is gone, not pushed down: `creating` swaps the whole return.
    await expect(canvas.queryByText('VT-003')).not.toBeInTheDocument();

    /* Five inputs across two tracks, not eight. The schema resolves eight vital
       fields and `OBSERVATION_GRID_KEYS` removes three of them from the grid, so
       a change to either side silently re-flows this block. */
    const grid = canvasElement.querySelector('.grid.grid-cols-2') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(5);
    for (const label of ['Weight', 'Temperature', 'Heart rate', 'Respiratory rate', 'CRT']) {
      await expect(canvas.getByRole('textbox', { name: label })).toBeInTheDocument();
    }
    // The three pulled out of the grid must not also exist as text fields.
    await expect(canvas.queryByRole('textbox', { name: 'BCS' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Pain score' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('textbox', { name: 'Mucous membrane' })
    ).not.toBeInTheDocument();

    // They are segmented pickers instead, on the app's full ranges.
    await expect(canvas.getByText('Observation tools')).toBeInTheDocument();
    const bcs = canvas.getByRole('group', { name: 'Body condition score' });
    await expect(within(bcs).getAllByRole('button')).toHaveLength(9);
    await expect(within(bcs).getByRole('button', { name: 'Body condition score 9' })).toBeEnabled();
    const pain = canvas.getByRole('group', { name: 'Pain score' });
    await expect(within(pain).getAllByRole('button')).toHaveLength(11);
    await expect(within(pain).getByRole('button', { name: 'Pain score 0' })).toBeInTheDocument();
    const mucous = canvas.getByRole('group', { name: 'Mucous membranes' });
    await expect(within(mucous).getAllByRole('button')).toHaveLength(3);
    await expect(within(mucous).getByText('Cyanotic')).toBeInTheDocument();

    await expect(canvas.getByRole('textbox', { name: 'Vitals notes' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save vitals' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The editor at rest. The two square tracks are 26px cells and the membrane track is ' +
          'pills, all right-aligned against their labels and free to wrap - a 9-cell BCS row and ' +
          'an 11-cell pain row inside a 530px drawer is the tightest thing on this surface.',
      },
    },
  },
};

export const SelectedObservationScores: Story = {
  name: 'Segmented pickers, selected',
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);
    const bcs = within(canvas.getByRole('group', { name: 'Body condition score' }));
    const chosen = bcs.getByRole('button', { name: 'Body condition score 7' });
    const other = bcs.getByRole('button', { name: 'Body condition score 3' });

    await expect(chosen).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chosen);
    await expect(chosen).toHaveAttribute('aria-pressed', 'true');

    /* The selected cell inverts to the filled dark skin. Polled rather than read
       once: `segmentClass` carries `transition-colors`, so a single synchronous
       read can land on an interpolated colour part-way through the swap. */
    await waitFor(() => {
      const selected = getComputedStyle(chosen);
      const unselected = getComputedStyle(other);
      expect(selected.backgroundColor).not.toBe(unselected.backgroundColor);
      expect(selected.color).not.toBe(unselected.color);
    });

    // Selection is single-value, so picking another one releases the first.
    await userEvent.click(other);
    await expect(chosen).toHaveAttribute('aria-pressed', 'false');
    await expect(other).toHaveAttribute('aria-pressed', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selection is announced through `aria-pressed` on plain buttons inside a bare ' +
          '`fieldset`, not through radio semantics, so the pressed state is the only signal a ' +
          'screen reader gets. The visual difference is a full inversion to `bg-neutral-900`, ' +
          'which is why the contrast pair is worth reading here rather than assumed.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Save with an empty draft',
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save vitals' }));

    expect(
      await canvas.findByText('Please fix the highlighted vitals fields.')
    ).toBeInTheDocument();

    // Four in the grid ...
    await expect(canvas.getByText('Weight is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Temperature is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Heart rate is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Respiratory rate is required.')).toBeInTheDocument();
    // ... and two under the segmented pickers, which is the surprise.
    await expect(canvas.getByText('Pain score is required.')).toBeInTheDocument();
    await expect(canvas.getByText('BCS is required.')).toBeInTheDocument();

    // CRT has no bounds entry, so it is the one rendered field that is optional.
    await expect(canvas.queryByText('CRT is required.')).not.toBeInTheDocument();

    // Typing clears that field's error without touching the others.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Weight' }), '62.4');
    await waitFor(() => {
      expect(canvas.queryByText('Weight is required.')).not.toBeInTheDocument();
    });
    await expect(canvas.getByText('Temperature is required.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Validation runs over the fields the active template renders, which includes the three ' +
          'that were moved out of the grid - so pain score and BCS block the save even though ' +
          'they look like optional pickers. Their messages appear under the picker row rather ' +
          'than under an input, which is the layout worth checking: six error lines appear at ' +
          'once and push the notes field and the footer down.',
      },
    },
  },
};

export const WeightGain: Story = {
  name: 'Weight trend (gain)',
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);
    // Trend compares the two most recent records carrying a weight: 62.4 vs 60.
    /* The whole string, not a prefix: `formatStampDate` renders the "since" date
       in the preferred time zone, so the day is matched by shape rather than
       pinned to a literal that would flip either side of UTC. */
    const label = canvas.getByText(/^\+2\.4 lbs since [A-Z][a-z]{2} \d{1,2}$/);

    /* The chip is a tinted arrow plus that one line, and the arrow carries its
       own `--success` colour rather than inheriting the chip's `--ink-muted`.
       Comparing the two computed colours is what shows the tint is really being
       applied; polled, because the chip mounts with the editor. */
    const chip = label.parentElement as HTMLElement;
    const icon = chip.querySelector('span') as HTMLElement;
    await expect(icon.querySelectorAll('svg')).toHaveLength(1);
    await waitFor(() => {
      expect(getComputedStyle(icon).color).not.toBe(getComputedStyle(label).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The trend chip only exists inside the editor, and only once two records carry a ' +
          'weight - so it is invisible on a first visit and appears on the second. The delta is ' +
          'rounded to one decimal and always signed on a gain.',
      },
    },
  },
};

export const WeightLoss: Story = {
  name: 'Weight trend (loss)',
  args: { vitals: LOSING_WEIGHT },
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);
    // No `+` on a loss, and the same "since <short date>" tail as the gain.
    const label = canvas.getByText(/^-1\.8 lbs since [A-Z][a-z]{2} \d{1,2}$/);

    /* The identical tint check the gain story runs, which is the point of the
       pair: the arrow flips but nothing about the colour does, so a loss reads
       as reassuringly green as a gain. */
    const chip = label.parentElement as HTMLElement;
    const icon = chip.querySelector('span') as HTMLElement;
    await expect(icon.querySelectorAll('svg')).toHaveLength(1);
    await waitFor(() => {
      expect(getComputedStyle(icon).color).not.toBe(getComputedStyle(label).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A loss swaps the glyph to `IoTrendingDownOutline` and drops the `+`, but the chip ' +
          'keeps the same `--success` tint on the icon in both directions. Weight loss between ' +
          'visits is not good news, so the two directions reading identically apart from the ' +
          'arrow is the thing to look at here.',
      },
    },
  },
};

export const TemplateSearchNoMatches: Story = {
  name: 'Template search with no matches',
  play: async ({ canvasElement }) => {
    const canvas = await openEditor(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search vitals templates' }),
      'oncology'
    );
    const notice = await canvas.findByText('No vitals templates match this search.');

    /* The claim in the prose is that the notice COVERS the inputs rather than
       pushing them down, so it is measured: `absolute` positioning, and the
       five-input grid underneath still has all five children at its original
       two tracks. A notice that had been rendered in flow would leave both
       intact too, which is why the overlap itself is read as well. */
    await expect(getComputedStyle(notice).position).toBe('absolute');
    const grid = canvasElement.querySelector('.grid.grid-cols-2') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(5);
    await expect(notice.getBoundingClientRect().bottom).toBeGreaterThan(
      grid.getBoundingClientRect().top
    );

    /* The matches list and this notice are mutually exclusive branches of the
       same block, so the search wrapper must hold the notice and no <ul>. */
    const searchBlock = notice.parentElement as HTMLElement;
    await expect(searchBlock.querySelectorAll('ul')).toHaveLength(0);
    await expect(searchBlock.querySelectorAll('p')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The no-match notice is absolutely positioned over the grid below it, on `--neutral-0` ' +
          'with the dropdown shadow, so it covers the first row of inputs rather than pushing ' +
          'them down. Reachable offline because `listWorkspaceTemplates` gathers its three ' +
          'requests with `Promise.allSettled` and resolves to an empty list instead of erroring.',
      },
    },
  },
};

export const PhoneRowExpanded: Story = {
  name: 'Phone: row breakdown stays two columns',
  // The meta decorator is `w-[498px] max-w-full`, so it collapses to the phone
  // width here rather than forcing a horizontal scroll. No second wrapper needed.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = await expandRow(canvasElement, 'VT-003');

    /* `grid-cols-2` has no responsive variant here, so the breakdown keeps two
       tracks at 375 where the drawer is full-screen. Asserted rather than
       assumed: this is the width where "Resp. rate: 24 bpm" is closest to
       wrapping inside its cell. */
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(8);
    await expect(canvas.getByText('Resp. rate: 24 bpm')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 the quick-actions drawer goes full-screen, so this is the real phone width for ' +
          'the breakdown. The grid does not collapse to one column, which keeps the eight ' +
          'readings in the same shape as on desktop but leaves each cell about 150px wide.',
      },
    },
  },
};
