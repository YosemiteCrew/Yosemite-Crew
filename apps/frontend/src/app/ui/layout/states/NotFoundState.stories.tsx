import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import NotFoundState from './NotFoundState';

/**
 * The default search action writes to the universal-search store, which is a
 * module singleton. Closing it on both sides of every story keeps a click in
 * one story from leaving the palette flagged open for the next.
 */
const withClosedSearch = () => {
  useUniversalSearchStore.getState().close();
  return () => useUniversalSearchStore.getState().close();
};

const meta = {
  title: 'Layout/NotFoundState',
  component: NotFoundState,
  parameters: {
    layout: 'fullscreen',
    // The primary action is a next/link, which wants the App Router mock mounted.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The 404 card: a Newsreader numeral instead of an icon disc, a title that does not ' +
          'blame the reader, and two ways forward. "Go to Dashboard" is a real link (`Primary` ' +
          'with `href`), so it works before any script runs; "Search" opens the universal search ' +
          'palette through its store unless the caller supplies its own `onSearch`. Both targets ' +
          'are props because a developer-portal 404 wants a different home than a clinic one.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withClosedSearch,
} satisfies Meta<typeof NotFoundState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Dashboard home',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('404')).toBeInTheDocument();
    await expect(canvas.getByText('This page wandered off')).toBeInTheDocument();
    await expect(
      canvas.getByText('The link may be old, or the record was moved to another organization.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );

    // The search pill has no handler of its own: it flips the palette store,
    // and the palette (mounted by the shell, not here) is what reads it.
    await expect(useUniversalSearchStore.getState().isOpen).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Search ⌘K' }));
    await expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The defaults: home is `/dashboard` and search opens the ⌘K palette. The play function ' +
          'reads the store rather than looking for the palette, because the palette is not part ' +
          'of this component.',
      },
    },
  },
};

export const CustomHome: Story = {
  name: 'Custom home route',
  args: {
    homeHref: '/appointments',
    homeLabel: 'Go to appointments',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Go to appointments' })).toHaveAttribute(
      'href',
      '/appointments'
    );
    await expect(canvas.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A role whose default screen is the appointments board gets sent there instead. The ' +
          'label travels with the route so the pill never promises the wrong page.',
      },
    },
  },
};

export const CustomSearch: Story = {
  name: 'Custom search handler',
  args: {
    onSearch: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Search ⌘K' }));
    await expect(args.onSearch).toHaveBeenCalledTimes(1);
    // The caller took over the action, so the palette store is left alone.
    await expect(useUniversalSearchStore.getState().isOpen).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `onSearch` supplied the store is never touched. This is the seam a surface without ' +
          'the universal palette (the public site, the developer portal) uses to wire its own search.',
      },
    },
  },
};
