import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { DraftLine } from '@/app/features/finance/pages/Estimates/Sections/estimateDraft';
import EstimateLineRow from './EstimateLineRow';

const BLOODS: DraftLine = {
  key: 'line-bloods',
  description: 'Pre-anaesthetic bloods',
  quantity: '3',
  unitPrice: '19.99',
  taxRate: '20',
};

const BLANK: DraftLine = {
  key: 'line-blank',
  description: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '0',
};

/**
 * `line` is a prop, so the bare row never moves on its own. The hook lives in a
 * named component rather than in `render`, which `react-hooks/rules-of-hooks`
 * rejects.
 */
const ControlledLineRow = (args: ComponentProps<typeof EstimateLineRow>) => {
  const [line, setLine] = useState(args.line);
  return (
    <EstimateLineRow
      {...args}
      line={line}
      onChange={(key, patch) => {
        setLine((current) => ({ ...current, ...patch }));
        args.onChange(key, patch);
      }}
    />
  );
};

const meta = {
  title: 'Finance/EstimateLineRow',
  component: EstimateLineRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One editable estimate line: description, quantity, unit price, tax percent, the ' +
          'running pre-tax total and a Remove control.\n\n' +
          'The labels are the part worth reviewing. Each numeric field carries a real ' +
          '`<label>` that is visible on a phone and screen-reader-only from `sm` up, where the ' +
          "editor's column headers name the fields instead. A placeholder alone would leave " +
          'the boxes unidentifiable the moment a value is typed into them, and three unlabelled ' +
          'spinbuttons in a row is exactly what an audit flags.\n\n' +
          'The total is `computeLineTotal(quantity, unitPrice)` with no tax in it, matching ' +
          '`EstimateItem.lineTotal` as the backend writes it. The row is fully controlled - ' +
          '`onChange` receives the line key and a patch - so a story that types into it needs ' +
          'local state to move.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    line: BLOODS,
    index: 0,
    currency: 'GBP',
    canRemove: true,
    onChange: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[720px] rounded-2xl border border-card-border bg-neutral-0 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EstimateLineRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'A filled line',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Line 1 description')).toHaveValue('Pre-anaesthetic bloods');
    await expect(canvas.getByLabelText('Line 1 quantity')).toHaveValue(3);
    await expect(canvas.getByLabelText('Line 1 unit price')).toHaveValue(19.99);
    await expect(canvas.getByLabelText('Line 1 tax percent')).toHaveValue(20);
    // 3 x 19.99, before tax, to the penny.
    await expect(canvas.getByText('£59.97')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();

    // Above `sm` the numeric labels are screen-reader-only: present, not painted.
    const label = canvas.getByText('Line 1 quantity');
    await expect(getComputedStyle(label).position).toBe('absolute');
  },
};

export const Blank: Story = {
  name: 'A blank line',
  args: { line: BLANK, index: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The index feeds every label, so the third row is "Line 3".
    await expect(canvas.getByLabelText('Line 3 description')).toHaveValue('');
    await expect(canvas.getByLabelText('Line 3 unit price')).toHaveAttribute(
      'placeholder',
      'Price'
    );
    await expect(canvas.getByText('£0.00')).toBeInTheDocument();
  },
};

export const CannotRemove: Story = {
  name: 'The only line cannot be removed',
  args: { canRemove: false },
  play: async ({ args, canvasElement }) => {
    const remove = within(canvasElement).getByRole('button', { name: 'Remove line 1' });
    await expect(remove).toBeDisabled();
    await userEvent.click(remove);
    await expect(args.onRemove).not.toHaveBeenCalled();
  },
};

export const Typing: Story = {
  name: 'Typing patches the line and moves the total',
  render: (args) => <ControlledLineRow {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const quantity = canvas.getByLabelText('Line 1 quantity');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');

    /* The handler is given the line KEY and a partial patch, never the whole
       line or the event - the editor merges it into its own draft. */
    await expect(args.onChange).toHaveBeenLastCalledWith('line-bloods', { quantity: '4' });
    await expect(canvas.getByText('£79.96')).toBeInTheDocument();
  },
};

export const RemoveFires: Story = {
  name: 'Remove hands back the key',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove line 1' }));
    await expect(args.onRemove).toHaveBeenCalledWith('line-bloods');
  },
};

export const Phone: Story = {
  name: 'Phone: labels visible, description full width',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Below `sm` the labels are painted, because there is no header row to name the boxes.
    const label = canvas.getByText('Line 1 quantity');
    await expect(getComputedStyle(label).position).not.toBe('absolute');
    // The description spans the row; the numeric fields wrap beneath it.
    const description = canvas.getByLabelText('Line 1 description');
    const quantity = canvas.getByLabelText('Line 1 quantity');
    await expect(quantity.getBoundingClientRect().top).toBeGreaterThan(
      description.getBoundingClientRect().bottom - 1
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
