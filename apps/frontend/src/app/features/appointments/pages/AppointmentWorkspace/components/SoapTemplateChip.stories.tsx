import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SoapTemplateChip, { type SoapTemplateOption } from './SoapTemplateChip';

const TEMPLATES: SoapTemplateOption[] = [
  { id: 'tpl-wellness', name: 'Wellness exam', subtitle: 'Clinic default · 4 sections' },
  { id: 'tpl-sick', name: 'Sick visit', subtitle: 'Presenting complaint first' },
  { id: 'tpl-recheck', name: 'Recheck', subtitle: 'Carries the previous plan forward' },
  { id: 'tpl-dental', name: 'Dental prophylaxis', subtitle: 'Chart + grading table' },
  {
    id: 'tpl-derm',
    name: 'Dermatology workup with cytology and follow-up plan',
    subtitle: 'Long name - the row has to truncate rather than widen the popover',
  },
];

/** The popover is `absolute top-full`, so the chip needs room under it. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[420px] items-start justify-start p-6">
    <Story />
  </div>
);

const meta = {
  title: 'Workspace/SoapTemplateChip',
  component: SoapTemplateChip,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The SOAP template selector at the top of the appointment workspace. Closed it is one ' +
          'pill reading `Template: <name>`; open it is a 330px popover that had never been drawn ' +
          'in Storybook, because it lives behind a `useState(open)` that only a click flips.\n\n' +
          'That gap is the whole reason this file exists. Four production bugs on this branch were ' +
          'all on interaction-gated surfaces - a popover whose `grid-template-columns` used a ' +
          'comma, so the browser dropped the declaration and six children stacked into one column; ' +
          'two calendar overlays with an orphaned grid child that doubled their height; dropdown ' +
          'rows painted with fill tokens instead of ink tokens. None of those are visible to tsc, ' +
          'eslint or jest, and none were reachable from a story that only rendered the trigger.\n\n' +
          'What the open panel puts on screen, verified against the source: a search field in a ' +
          'pill (`bg-neutral-100`, 13px `IoSearchOutline`) above a `max-h-64 overflow-y-auto` list, ' +
          'so a long template set scrolls inside the popover rather than growing it; rows separated ' +
          'by `border-t border-card-border` with `first:border-t-0`; the active row tinted ' +
          '`bg-primary-100/40`, bolded, and given a 14px `IoCheckmark` in `--blue-text`; and an ' +
          'optional "Manage templates" footer that is omitted entirely - not disabled - when no ' +
          '`onManage` handler is passed.\n\n' +
          'The stories below open the panel in a `play` function and assert it has real rows and a ' +
          'real search field. Asserting only that `aria-expanded` flipped would pass on an empty ' +
          'panel, which is exactly how a dropdown regression stays invisible.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    templates: TEMPLATES,
    onSelect: fn(),
    onManage: fn(),
  },
} satisfies Meta<typeof SoapTemplateChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the popover and hands back the panel element for further assertions. */
const openPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: /^Template:/ }));
  return canvas.getByLabelText('SOAP templates');
};

export const Closed: Story = {
  name: 'Closed chip',
  parameters: {
    docs: {
      description: {
        story:
          'The resting chip. `activeName` is absent, so it falls back to "Template: None" rather ' +
          'than rendering an empty slot after the colon.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Popover open',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    // Assert the panel actually has its search field and every row - not merely
    // that the trigger flipped aria-expanded, which an empty panel would satisfy.
    await expect(within(panel).getByLabelText('Search SOAP templates')).toBeInTheDocument();
    const list = within(panel).getByRole('list');
    await expect(within(list).getAllByRole('button')).toHaveLength(TEMPLATES.length);
    await expect(within(panel).getByRole('button', { name: /manage templates/i })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The surface no snapshot contained: search field, five rows with their grey subtitles, and ' +
          'the footer action. The last template name is deliberately long enough to prove the row ' +
          'truncates - `min-w-0 flex-1` on the text column plus `truncate` - instead of pushing the ' +
          '330px popover wider.',
      },
    },
  },
};

export const ActiveTemplate: Story = {
  name: 'Popover open with an applied template',
  args: { activeName: 'Recheck' },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const list = within(panel).getByRole('list');
    // Exactly one row is pressed, and it is the one whose name matches activeName.
    const active = within(list).getByRole('button', { pressed: true });
    await expect(active).toHaveTextContent('Recheck');
    await expect(within(list).getAllByRole('button')).toHaveLength(TEMPLATES.length);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three separate signals mark the applied template and all three only exist with the panel ' +
          'open: the `bg-primary-100/40` tint, `font-bold` on the name, and the trailing tick. The ' +
          'match is case-insensitive on the trimmed name, not on the id, so a renamed template ' +
          'silently stops matching - worth seeing.',
      },
    },
  },
};

export const FilteredBySearch: Story = {
  name: 'Search narrows the list',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    await userEvent.type(within(panel).getByLabelText('Search SOAP templates'), 'dent');
    const list = within(panel).getByRole('list');
    await expect(within(list).getAllByRole('button')).toHaveLength(1);
    await expect(within(list).getByText('Dental prophylaxis')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two interactions deep. The filter matches on `name` only - a subtitle mentioning the term ' +
          'will not surface its row - and the list keeps its `first:border-t-0` rule, so the single ' +
          'survivor renders without a stray top hairline.',
      },
    },
  },
};

export const NoSearchMatch: Story = {
  name: 'Search with no match',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    await userEvent.type(within(panel).getByLabelText('Search SOAP templates'), 'zzzz');
    const list = within(panel).getByRole('list');
    await expect(within(list).queryAllByRole('button')).toHaveLength(0);
    await expect(
      within(list).getByText('No SOAP templates match this search.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty branch is a single `<li>` of 12px `--text-secondary` copy, which collapses the ' +
          'popover to roughly the height of the search field. Only reachable by typing, so nothing ' +
          'had ever composited it with the footer button below.',
      },
    },
  },
};

export const WithoutManageAction: Story = {
  name: 'Popover open without the footer',
  args: { onManage: undefined },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement);
    const list = within(panel).getByRole('list');
    await expect(within(list).getAllByRole('button')).toHaveLength(TEMPLATES.length);
    await expect(within(panel).queryByRole('button', { name: /manage templates/i })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without `onManage` the footer is not rendered at all rather than rendered disabled, so ' +
          'the panel ends on the list border with no dead affordance.',
      },
    },
  },
};

export const Disabled: Story = {
  name: 'Disabled chip',
  args: { disabled: true, activeName: 'Wellness exam' },
  parameters: {
    docs: {
      description: {
        story:
          'A locked encounter. The chip keeps its label and drops to `opacity-50`; the popover is ' +
          'unreachable because the trigger is the only thing that sets `open`.',
      },
    },
  },
};
