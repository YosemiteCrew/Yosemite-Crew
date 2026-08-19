import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { ObservationRecord } from '@/app/features/appointments/types/workspace';
import ObservationToolForm from './ObservationToolForm';

/**
 * A scored Feline Grimace Scale submission. `scores` is an open
 * `Record<string, number | string>` written by the backend from the tool
 * definition, so the breakdown renders whatever keys arrive - there is no fixed
 * field list the way `VitalRow` has one.
 */
const FGS_RECORD: ObservationRecord = {
  id: 'ot-2',
  code: 'OT-002',
  toolKey: 'FGS',
  toolName: 'Feline grimace scale',
  scores: {
    'Ear position': 1,
    'Orbital tightening': 2,
    'Muzzle tension': 1,
    'Whiskers change': 0,
    'Head position': 1,
  },
  total: 5,
  recordedByName: 'Dr. Amara Weber',
  recordedAt: '2026-03-12T12:00:00.000Z',
};

/** No `total`, and one categorical value - both legal, both change the breakdown. */
const CSU_RECORD: ObservationRecord = {
  id: 'ot-1',
  code: 'OT-001',
  toolKey: 'CSU_CAP',
  toolName: 'Canine acute pain scale',
  scores: {
    'Psychological and behavioral': 2,
    'Response to palpation': 1,
    'Body tension': 'Mild',
  },
  recordedByName: 'Jonah Pike',
  recordedAt: '2026-03-05T12:00:00.000Z',
};

const OBSERVATIONS: ObservationRecord[] = [FGS_RECORD, CSU_RECORD];

/** Opens one recorded observation's breakdown and returns the breakdown block. */
const expandRow = async (canvasElement: HTMLElement, code: string) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: `View ${code}` }));
  expect(await canvas.findByRole('button', { name: `Hide ${code}` })).toBeInTheDocument();
  const row = canvas.getByText(code).closest('li') as HTMLElement;
  const panel = row.querySelector('.rounded-2xl.border') as HTMLElement | null;
  await expect(panel).toBeInTheDocument();
  return panel as HTMLElement;
};

/** The value cell sitting opposite a score label inside a breakdown. */
const valueFor = (panel: HTMLElement, label: string): string =>
  within(panel).getByText(label).nextElementSibling?.textContent ?? '';

const meta = {
  title: 'Workspace/ObservationToolForm',
  component: ObservationToolForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Observation Tool tab of the quick-actions Record panel: pick a scoring tool, read ' +
          'its licence-bearing intro, press Start, and review what has already been scored.\n\n' +
          'The surface that had never been drawn is the **expanded `ObservationRow`**. It is ' +
          'module-private, holds its own `useState`, and unlike the vitals breakdown next to it ' +
          'the block is not a fixed grid - it walks `Object.entries(entry.scores)` and emits one ' +
          '`flex justify-between` line per key. The keys come from the backend tool definition, ' +
          'so the number of lines, their labels and whether a value is a number or a word are ' +
          'all data, not layout. The `Total score` line above them is conditional on `total` ' +
          'being present, and the Colorado scale submissions in this story arrive without one.\n\n' +
          'The tool picker is also worth seeing move: `activeTool` drives both the heading and a ' +
          'long licence paragraph, so switching tools replaces most of the panel and shifts the ' +
          'Start button by a couple of lines.\n\n' +
          'Start is disabled unless the org, companion and clinician are all resolved, with the ' +
          'reason spelled out underneath - the component refuses to write a fabricated local row ' +
          'when it cannot reach the scoring endpoint. These stories never press it, because the ' +
          'submission itself is a real backend call.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: 'appt-workspace-1',
    organisationId: 'org-storybook',
    encounterId: 'enc-1',
    companionId: 'companion-1',
    filledBy: 'prac-amara',
    filledByName: 'Dr. Amara Weber',
    observations: OBSERVATIONS,
  },
  decorators: [
    /* The quick-actions drawer is 530px wide; the intro paragraph is the longest
       run of text in the panel and its line count is what pushes Start down. */
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ObservationToolForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolPicker: Story = {
  name: 'Tool picker and recorded list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two chips, the first one pressed, and the heading follows the pressed chip.
    const fgs = canvas.getByRole('button', { name: 'Feline grimace scale' });
    const csu = canvas.getByRole('button', { name: 'Canine acute pain scale' });
    await expect(fgs).toHaveAttribute('aria-pressed', 'true');
    await expect(csu).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('heading', { name: 'Feline grimace scale' })).toBeInTheDocument();
    await expect(canvas.getByText(/^The Feline Grimace Scale \(FGS\)/)).toBeInTheDocument();

    // Both recorded rows, closed.
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(2);
    await expect(canvas.getByText('OT-002')).toBeInTheDocument();
    await expect(canvas.getByText('OT-001')).toBeInTheDocument();
    await expect(canvas.getByText('Jonah Pike')).toBeInTheDocument();
    await expect(canvas.queryByText(/^Total score: /)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel at rest. Each recorded row stacks stamp, tool name and code on the left - ' +
          'three lines at `leading-[120%]`, which is why the row is taller than the vitals row ' +
          'next to it despite carrying the same controls.',
      },
    },
  },
};

export const ToolSwitch: Story = {
  name: 'Switching tool rewrites the panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const csu = canvas.getByRole('button', { name: 'Canine acute pain scale' });

    await userEvent.click(csu);
    await expect(csu).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Feline grimace scale' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* The heading and the whole licence paragraph are replaced, not just the
       chip tint. Asserting the new intro's opening words, and that the previous
       one is gone, so a picker that flipped its pressed state without swapping
       content would fail here. */
    expect(
      await canvas.findByRole('heading', { name: 'Canine acute pain scale' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/^The Colorado State University Canine Acute Pain Scale/)
    ).toBeInTheDocument();
    await expect(canvas.queryByText(/^The Feline Grimace Scale \(FGS\)/)).not.toBeInTheDocument();

    // The pressed chip inverts to the brand skin; polled, because the chip
    // carries `transition-colors` and a single read can catch it mid-swap.
    await waitFor(() => {
      const pressed = getComputedStyle(csu);
      const idle = getComputedStyle(canvas.getByRole('button', { name: 'Feline grimace scale' }));
      expect(pressed.backgroundColor).not.toBe(idle.backgroundColor);
    });

    // The recorded list is not filtered by the selected tool.
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selecting a tool swaps the heading and the intro. The two intros differ by several ' +
          'lines, so the Start button and the recorded list move vertically when the tool ' +
          'changes - the panel does not reserve a fixed block for the copy.',
      },
    },
  },
};

export const RowExpandedWithTotal: Story = {
  name: 'Row breakdown with a total',
  play: async ({ canvasElement }) => {
    const panel = await expandRow(canvasElement, 'OT-002');

    // One total line plus one line per score key - six paragraphs, built from data.
    await expect(panel.querySelectorAll('p')).toHaveLength(6);
    await expect(within(panel).getByText('Total score: 5')).toBeInTheDocument();

    await expect(valueFor(panel, 'Ear position')).toBe('1');
    await expect(valueFor(panel, 'Orbital tightening')).toBe('2');
    await expect(valueFor(panel, 'Muzzle tension')).toBe('1');
    await expect(valueFor(panel, 'Whiskers change')).toBe('0');
    await expect(valueFor(panel, 'Head position')).toBe('1');

    // Each line is a label/value pair pushed to opposite edges.
    const line = within(panel).getByText('Ear position').parentElement as HTMLElement;
    await expect(getComputedStyle(line).display).toBe('flex');
    await expect(getComputedStyle(line).justifyContent).toBe('space-between');

    // The second row stays closed - each ObservationRow owns its own flag.
    await expect(within(canvasElement).getByRole('button', { name: 'View OT-001' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A Feline Grimace Scale submission: five action units, each 0-2, and the total the ' +
          'backend computed. Note the zero - `Whiskers change: 0` is a real score, not a missing ' +
          'value, and the breakdown gives it no different treatment from a 2.',
      },
    },
  },
};

export const RowExpandedWithoutTotal: Story = {
  name: 'Row breakdown with no total',
  play: async ({ canvasElement }) => {
    const panel = await expandRow(canvasElement, 'OT-001');

    // Three lines and no total: `total` is optional and this record has none.
    await expect(panel.querySelectorAll('p')).toHaveLength(3);
    await expect(within(panel).queryByText(/^Total score: /)).not.toBeInTheDocument();

    await expect(valueFor(panel, 'Psychological and behavioral')).toBe('2');
    await expect(valueFor(panel, 'Response to palpation')).toBe('1');
    // `scores` values are `number | string`, so a categorical grade renders as-is.
    await expect(valueFor(panel, 'Body tension')).toBe('Mild');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without a total the breakdown opens straight onto the first score line, so the block ' +
          'loses the one bold row that anchored it. "Psychological and behavioral" is also the ' +
          'longest label either tool produces - it is the line that shows how a long label and ' +
          'its value share the width.',
      },
    },
  },
};

export const RecordingBlocked: Story = {
  name: 'Start disabled without encounter context',
  args: { filledBy: undefined, filledByName: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const start = canvas.getByRole('button', { name: 'Start' });
    await expect(start).toBeDisabled();
    await expect(
      canvas.getByText('Recording is available once the encounter and clinician are loaded.')
    ).toBeInTheDocument();
    // Blocking the write does not hide what is already recorded.
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opened before the encounter and clinician resolve. The panel disables Start and names ' +
          'the reason underneath rather than letting the click write a locally-scored row the ' +
          'backend never saw. The reason line is centred under the button and adds a second row ' +
          'to the action block, which is why the list below it shifts down.',
      },
    },
  },
};

export const RecordingAvailable: Story = {
  name: 'Start enabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const start = canvas.getByRole('button', { name: 'Start' });
    await expect(start).toBeEnabled();
    // The label is the resting one, not the in-flight 'Recording…'.
    await expect(start).toHaveTextContent('Start');

    /* The action block is the enabled pill and nothing else: the reason line and
       the error line are both siblings inside it, so counting the block's
       paragraphs is what proves it collapsed rather than merely that one
       specific string went missing. */
    const actionBlock = start.parentElement as HTMLElement;
    await expect(actionBlock.querySelectorAll('p')).toHaveLength(0);
    await expect(
      canvas.queryByText('Recording is available once the encounter and clinician are loaded.')
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    // The panel around it is unchanged - same tool, same intro, same two rows.
    await expect(canvas.getByRole('heading', { name: 'Feline grimace scale' })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'With org, companion and clinician all present the reason line disappears and the ' +
          'action block collapses to the single pill. Pressing Start posts a real scoring ' +
          'submission, so no story here clicks it.',
      },
    },
  },
};

export const NoObservations: Story = {
  name: 'Nothing scored yet',
  args: { observations: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The list is not an empty list - the whole <ul> is conditional.
    await expect(canvasElement.querySelectorAll('ul')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(0);
    await expect(canvas.getByRole('heading', { name: 'Feline grimace scale' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Start' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'First visit. Unlike the Vitals tab, which prints "No vitals recorded yet.", this tab ' +
          'renders no empty-state copy at all - the recorded list simply does not exist, and the ' +
          'panel ends at the Start button. Worth deciding whether that silence is intended.',
      },
    },
  },
};

export const PhoneRowExpanded: Story = {
  name: 'Phone: row breakdown',
  // The meta decorator is `w-[498px] max-w-full`, so it collapses to the phone
  // width here rather than forcing a horizontal scroll. No second wrapper needed.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const panel = await expandRow(canvasElement, 'OT-002');
    await expect(panel.querySelectorAll('p')).toHaveLength(6);

    /* Each line is `flex justify-between gap-3` with no wrap, so at 375 a long
       label and its value stay on one row and the label truncates against the
       gap rather than pushing the value off. Read here because this is the width
       where it first matters. */
    const line = within(panel).getByText('Orbital tightening').parentElement as HTMLElement;
    await expect(getComputedStyle(line).display).toBe('flex');
    await expect(getComputedStyle(line).justifyContent).toBe('space-between');
    await expect(valueFor(panel, 'Orbital tightening')).toBe('2');
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 the quick-actions drawer is full-screen, so this is the phone form of the ' +
          'breakdown. The collapsed row above it is the tighter case: stamp, tool name and code ' +
          'on the left against a recorder chip and a 38px button on the right, all in one ' +
          '`justify-between` row with no wrapping.',
      },
    },
  },
};
