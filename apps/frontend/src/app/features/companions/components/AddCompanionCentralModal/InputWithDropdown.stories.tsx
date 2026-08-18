import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import InputWithDropdown from './InputWithDropdown';
import type { SearchOption } from './addCompanionCentralModalHelpers';

const OPTIONS: SearchOption[] = [
  { value: 'parent-1', label: 'Maya Whitfield' },
  { value: 'parent-2', label: 'Marcus Alvarez' },
  { value: 'parent-3', label: 'Priya Raman' },
  { value: 'parent-4', label: 'Tom Reyes' },
  { value: 'parent-5', label: 'Yuki Tanaka' },
];

/**
 * The component is controlled: the panel only opens once `filtered.length` CHANGES
 * after a keystroke, so a story with a fixed `value` can never open it. This wrapper
 * holds the value the way the real modal does.
 */
const Stateful = ({
  initial = '',
  options = OPTIONS,
  error,
  onSelect,
}: {
  initial?: string;
  options?: SearchOption[];
  error?: string;
  onSelect?: (opt: SearchOption) => void;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <div className="w-[340px]">
      <InputWithDropdown
        value={value}
        inlabel="Pet parent"
        inname="parent"
        onChange={setValue}
        onSelect={(opt) => {
          setValue(opt.label);
          onSelect?.(opt);
        }}
        options={options}
        error={error}
      />
    </div>
  );
};

/** The panel is `position: fixed` under the input, so it needs room below. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[340px] items-start justify-center pt-6">
    <Story />
  </div>
);

const meta = {
  title: 'Companions/InputWithDropdown',
  component: Stateful,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The pet-parent search field in the add-companion modal: a text input whose keystrokes ' +
          'filter a list, with the results panel `createPortal`ed to `document.body` so no ' +
          '`overflow: hidden` ancestor can clip it.\n\n' +
          'It had no story, and the panel is doubly hidden: it exists only after typing, AND only ' +
          'once the filtered count *changes*, so a story that merely sets a `value` prop can never ' +
          'draw it. That is why this file wraps the component in real state rather than passing ' +
          'fixed args.\n\n' +
          'Two details the open panel is here to keep honest. The input swaps to a square bottom ' +
          'edge with no bottom border while open, so the field and the panel read as one shape - ' +
          'that only looks right if both are drawn together. And the options are plain `<button>`s ' +
          'rather than `role="option"`, which is worth seeing: a probe on this branch reported these ' +
          'panels as "expanded with 0 options" purely because it queried for the role.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
  },
} satisfies Meta<typeof Stateful>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Empty field',
  parameters: {
    docs: { description: { story: 'The resting state: rounded on all four corners, no panel.' } },
  },
};

export const Open: Story = {
  name: 'Panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Pet parent'), 'ma');
    const panel = document.querySelector('[data-iwd-panel]');
    await expect(panel).toBeInTheDocument();
    // Options are plain buttons, not role="option" - assert the content, not the role.
    await expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing "ma" narrows five parents to Maya Whitfield and Marcus Alvarez. The input has ' +
          'squared its bottom corners and dropped its bottom border so it joins the panel.',
      },
    },
  },
};

export const SingleMatch: Story = {
  name: 'One match',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Pet parent'), 'yuki');
    const panel = document.querySelector('[data-iwd-panel]');
    await expect(panel).toBeInTheDocument();
    await expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A single result. The panel has a 72px minimum height, so it keeps its shape rather than ' +
          'collapsing to one row of text.',
      },
    },
  },
};

export const NoMatches: Story = {
  name: 'No matches (panel closes)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Pet parent'), 'zzz');
    // Filtering to nothing must close the panel, not leave an empty box hanging.
    await expect(document.querySelector('[data-iwd-panel]')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing something that matches nothing closes the panel outright. An empty open panel ' +
          'would be the failure here, and it is the exact shape that a trigger-only assertion misses.',
      },
    },
  },
};

export const WithError: Story = {
  name: 'Validation error',
  args: { error: 'Select an existing parent or add a new one.' },
  parameters: {
    docs: {
      description: {
        story: 'The error border and message, which the open state must not paint over.',
      },
    },
  },
};
