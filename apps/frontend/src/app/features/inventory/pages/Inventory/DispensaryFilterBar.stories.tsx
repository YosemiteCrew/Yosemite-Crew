import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { DispensaryFilterBar } from './index';
import type { DispensaryStatus } from './types';

/**
 * `dispensarySearch` and `dispensaryStatusFilter` are owned by the Inventory page as plain
 * `useState`, so the bar is a pure controlled row - the harness reproduces that ownership
 * rather than passing static props, which is what lets a `play` click a chip or type into
 * the search box and see the bar reflect it back.
 */
const Harness = () => {
  const [dispensarySearch, setDispensarySearch] = useState('');
  const [dispensaryStatusFilter, setDispensaryStatusFilter] = useState<DispensaryStatus | 'ALL'>(
    'ALL'
  );

  return (
    <div className="min-h-[160px] bg-[var(--screen)] p-6">
      <DispensaryFilterBar
        dispensarySearch={dispensarySearch}
        dispensaryStatusFilter={dispensaryStatusFilter}
        setDispensaryStatusFilter={setDispensaryStatusFilter}
        setDispensarySearch={setDispensarySearch}
      />
    </div>
  );
};

const meta = {
  title: 'Inventory/DispensaryFilterBar',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The status chip row (All / Pending / Dispensed / Not dispensed) and search input above ' +
          "the Dispensary tab's record list. Simpler than its sibling `InventoryFilterBar` - no " +
          'portal, no measured positioning - but it shares the same `chipClass` selected/unselected ' +
          'styling, so a regression here (for example the `aria-pressed` state losing its visual ' +
          'pair) would look identical to a passing screenshot at rest.\n\n' +
          'Each status option carries its own `status()` colour set (warning/success/danger), but ' +
          'the row deliberately ignores it: `chipClass(active)` renders every chip with the same ' +
          'generic selected/unselected pair regardless of which status it represents, so there is ' +
          'no colour-per-status behaviour to assert here.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting state',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const all = canvas.getByRole('button', { name: 'All' });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['Pending', 'Dispensed', 'Not dispensed']) {
      await expect(canvas.getByRole('button', { name: label })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    }
    await expect(canvas.getByLabelText('Search dispensary')).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          '"All" selected and the search box empty, matching the Dispensary tab on first load.',
      },
    },
  },
};

export const StatusFilterSelection: Story = {
  name: 'Choosing a status filter',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const all = canvas.getByRole('button', { name: 'All' });
    const dispensed = canvas.getByRole('button', { name: 'Dispensed' });

    /* The chip is `transition-colors`, so both the weight and the settled fill are
       polled - a single read lands mid-transition and compares two interpolated
       colours rather than the two end states (same pattern as InventoryFilterBar's
       visibility pills). */
    await expect(getComputedStyle(all).fontWeight).not.toBe(getComputedStyle(dispensed).fontWeight);

    await userEvent.click(dispensed);

    await waitFor(() => {
      expect(dispensed).toHaveAttribute('aria-pressed', 'true');
      expect(all).toHaveAttribute('aria-pressed', 'false');
      expect(getComputedStyle(dispensed).fontWeight).toBe('700');
      expect(getComputedStyle(dispensed).backgroundColor).not.toBe(
        getComputedStyle(all).backgroundColor
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selecting a status chip is exclusive - the previously active chip drops both its ' +
          '`aria-pressed` state and its selected fill/weight as the new one takes them.',
      },
    },
  },
};

export const SearchInput: Story = {
  name: 'Typing a search term',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByLabelText('Search dispensary');

    await userEvent.type(search, 'amoxicillin');
    await waitFor(() => {
      expect(search).toHaveValue('amoxicillin');
    });

    /* A dropped `onChange` still leaves the freshly-typed value sitting in the
       DOM - the browser sets it on keystroke independently of React - so the
       assertion above alone cannot tell "wired to state" from "never wired at
       all". Forcing an unrelated re-render (clicking a status chip) is the
       tell: React reasserts a *controlled* input's value on every commit, so
       a value that only ever lived in the DOM gets stamped back to the empty
       string the state actually holds, while a value that made it into state
       survives. */
    await userEvent.click(canvas.getByRole('button', { name: 'Pending' }));
    await waitFor(() => {
      expect(search).toHaveValue('amoxicillin');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The search input is controlled from the same state the page filters records by, so a ' +
          'value that fails to round-trip through `onChange` would leave the field looking typeable ' +
          'while silently dropping every keystroke - visible only once something else forces a ' +
          "re-render and the input's stale DOM value gets overwritten by the real (empty) state.",
      },
    },
  },
};
