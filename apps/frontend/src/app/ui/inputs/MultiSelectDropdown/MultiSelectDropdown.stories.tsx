import { type ReactNode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import MultiSelectDropdown from './index';

const SERVICES: Array<string | { label: string; value: string; badge?: string }> = [
  { label: 'Consultation - 30 min', value: 'consult-30' },
  { label: 'Vaccination - core', value: 'vacc-core', badge: 'Package' },
  { label: 'Dental scale and polish', value: 'dental-scale' },
  { label: 'Radiography - two views', value: 'radiography-2' },
  { label: 'Blood panel - senior wellness', value: 'blood-senior', badge: 'Lab' },
  { label: 'Nail clip', value: 'nail-clip' },
];

type HarnessProps = {
  placeholder: string;
  value: string[];
  options?: Array<string | { label: string; value: string; badge?: string }>;
  error?: string;
  searchable?: boolean;
  portal?: boolean;
  icon?: ReactNode;
  onChange: (value: string[]) => void;
};

/**
 * The control is fully controlled: it never holds its own selection, so with a
 * bare `fn()` for `onChange` a click would tick nothing and the panel could
 * never be seen in its selected state. The harness holds `value` the way the
 * real forms do, and still reports every change to the action logger.
 */
const Harness = ({ placeholder, value, onChange, ...rest }: HarnessProps) => {
  const [current, setCurrent] = useState(value);
  return (
    <div className="min-h-[420px] w-[380px] p-6">
      <MultiSelectDropdown
        placeholder={placeholder}
        value={current}
        onChange={(next) => {
          onChange(next);
          setCurrent(next);
        }}
        {...rest}
      />
    </div>
  );
};

/** The panel carries `data-portal-dropdown`, which is also how the dismiss logic finds it. */
const findPanel = () =>
  waitFor(() => {
    const panel = document.querySelector<HTMLElement>('[data-portal-dropdown]');
    if (!panel) throw new Error('Multi-select panel is not mounted');
    return panel;
  });

const openPanel = async (canvasElement: HTMLElement, triggerName: string) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: triggerName }));
  return findPanel();
};

const meta = {
  title: 'Inputs/MultiSelectDropdown',
  component: Harness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The multi-select used across the appointment and inventory forms: a 44px trigger that ' +
          'joins every chosen label into one comma-separated line, and a panel of toggle rows.\n\n' +
          'The panel is `createPortal`ed to `document.body` and only mounts once `open` **and** a ' +
          'measured `portalStyle` both exist, so it was unreachable from every static story - the ' +
          'same class of gap that let four production bugs ship on this branch, among them ' +
          'dropdown panels whose text used fill tokens where it needed ink tokens. That failure ' +
          'mode is live here: each row sets `text-text-secondary!` and flips to ' +
          '`text-text-primary!` on hover and while active, over a `bg-card-hover` wash, and none ' +
          'of those three inks had ever been composited against that fill.\n\n' +
          'The rows are plain `<button>`s carrying `aria-pressed`, not `role="option"`, and the ' +
          'panel is a `<div>` with no listbox role of its own - so anything looking for a real ' +
          'listbox finds nothing. The stories assert against the buttons, which is what is ' +
          'actually there.\n\n' +
          'Two structural details only the open panel shows. The trigger swaps its border to ' +
          '`border-[var(--blue)]! border-b-0! rounded-t-[12px]!` while open, so the trigger and ' +
          'the panel are meant to read as one welded shape - but the panel is positioned from a ' +
          'rect in a portal and rounds only its bottom corners, so the seam between them exists ' +
          'only at that measured offset. And when `searchable` is on, the open trigger renders an ' +
          '`<input>` **inside** the `<button>` rather than replacing it; that nesting is only ' +
          'visible, and only checkable by the a11y addon, with the panel open.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    placeholder: 'Services',
    value: [],
    options: SERVICES,
    onChange: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Resting (nothing selected)',
  parameters: {
    docs: {
      description: {
        story:
          'With no selection the trigger shows an empty value line - the placeholder lives in the ' +
          'label above it, not inside the field - so the control reads as an empty input rather ' +
          'than a hinted one.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Panel open',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, 'Services');
    // Assert the panel has its rows. Checking only that the trigger flipped
    // aria-expanded passes on an empty panel, which is how a real regression
    // stayed invisible.
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    await expect(within(panel).getByText('Dental scale and polish')).toBeInTheDocument();
    // Two rows carry a badge pill beside the label.
    await expect(within(panel).getByText('Package')).toBeInTheDocument();
    await expect(within(panel).getByText('Lab')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. Six unselected rows on `--screen`, two of them carrying a ' +
          '`bg-primary-100` badge that is `shrink-0` against a `truncate` label - so a long label ' +
          'gives up width rather than pushing its badge out of the panel.',
      },
    },
  },
};

export const WithSelection: Story = {
  name: 'Two selected (panel open)',
  args: { value: ['vacc-core', 'nail-clip'] },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, 'Services: Vaccination - core, Nail clip');
    // The check mark is the only mark of selection, and it rides on aria-pressed.
    await expect(within(panel).getAllByRole('button', { pressed: true })).toHaveLength(2);
    await expect(within(panel).getAllByRole('button', { pressed: false })).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selected rows are marked by a 14px `--text-brand` check on the right and nothing else ' +
          '- no fill, no weight change - so selection has to read on that one glyph. The trigger ' +
          'meanwhile joins both labels with a comma into a single `truncate` line, which is where ' +
          'a three- or four-item selection stops being readable.',
      },
    },
  },
};

export const Searching: Story = {
  name: 'Filtering the panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openPanel(canvasElement, 'Services');
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    // The search field is the input the open trigger swaps in; it is focused on open.
    await userEvent.type(canvas.getByLabelText('Search Services'), 'den');
    await waitFor(async () => {
      await expect(within(panel).getAllByRole('button')).toHaveLength(1);
    });
    await expect(within(panel).getByText('Dental scale and polish')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing narrows the list by a case-insensitive substring match on the label. The panel ' +
          'shrinks to its content, so the welded trigger-plus-panel shape has to survive going ' +
          'from six rows to one.',
      },
    },
  },
};

export const NoMatches: Story = {
  name: 'Search with no matches',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openPanel(canvasElement, 'Services');
    await userEvent.type(canvas.getByLabelText('Search Services'), 'zzz');
    await expect(await within(panel).findByText('No matches found')).toBeInTheDocument();
    await expect(within(panel).queryAllByRole('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty panel is not blank: the same `<div>` renders a centred "No matches found" ' +
          'line. This is the exact state an assertion on `aria-expanded` alone would have called ' +
          'healthy, which is why the other stories count rows instead.',
      },
    },
  },
};

export const NoOptions: Story = {
  name: 'No options available',
  args: { options: [] },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, 'Services');
    // A different copy from the no-matches case: nothing was ever loaded.
    await expect(within(panel).getByText('No options available')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nothing loaded at all, which is a different message from an unmatched search - the ' +
          'panel distinguishes "your query found nothing" from "there is nothing here". Both ' +
          'render at the same `text-caption-1` size in `--text-primary`.',
      },
    },
  },
};

export const NotSearchable: Story = {
  name: 'Not searchable (panel open)',
  args: { searchable: false, value: ['consult-30'] },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, 'Services: Consultation - 30 min');
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    // Without the search branch the trigger keeps its value span while open.
    await expect(within(canvasElement).queryByLabelText('Search Services')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other trigger branch. With `searchable` off the open trigger keeps its truncated ' +
          'value line instead of swapping in an input, so the selected label stays readable while ' +
          'the panel is open - and the invalid input-inside-button nesting never happens.',
      },
    },
  },
};

export const Inline: Story = {
  name: 'Inline panel (portal off)',
  args: { portal: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Services' }));
    // The non-portal branch renders inside the canvas, absolutely positioned
    // under the trigger, and takes its width from the wrapper rather than from a
    // measured rect.
    const panel = await canvas.findByText('Nail clip');
    await expect(panel).toBeInTheDocument();
    await expect(document.querySelector('body > [data-portal-dropdown]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second rendering branch, used where the field is not inside a clipping or ' +
          'transformed ancestor. Same panel markup, but `top-full left-0 w-full` inside the ' +
          'field wrapper instead of a fixed rect - so this is the version that can be clipped by ' +
          'an overflow-hidden card, and the one to compare the seam against.',
      },
    },
  },
};

export const WithError: Story = {
  name: 'Error (nothing selected)',
  args: { error: 'Pick at least one service' },
  parameters: {
    docs: {
      description: {
        story:
          'The error border is conditional on there being **no** selection - ' +
          '`!hasSelection && error` - so a field that has been answered keeps the neutral ' +
          'hairline even while the message is still mounted. The message itself always renders ' +
          'when `error` is set.',
      },
    },
  },
};

export const ErrorWithSelection: Story = {
  name: 'Error once answered',
  args: { error: 'Pick at least one service', value: ['nail-clip'] },
  parameters: {
    docs: {
      description: {
        story:
          'The same `error` string with a selection present. The border has already returned to ' +
          '`--hairline` while the red line below is unchanged, so the two halves of the error ' +
          'state disagree. Only rendering both variants side by side makes that visible.',
      },
    },
  },
};
