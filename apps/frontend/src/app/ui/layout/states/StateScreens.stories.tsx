import type { Meta, StoryObj } from '@storybook/react';
import FilteredEmptyState from './FilteredEmptyState';
import NotFoundState from './NotFoundState';
import PermissionDeniedState from './PermissionDeniedState';

/**
 * The app-wide global state screens from the "Chrome & States" design: a
 * `--screen` card (hairline, radius-20, layered shadow) centered on the page,
 * with an icon disc / Newsreader 404, a title, muted body copy and pill
 * actions. Light + dark resolve through the shared token layer.
 */
const meta = {
  title: 'Layout/States',
  component: FilteredEmptyState,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'subtle' },
    // PermissionDeniedState calls next/navigation's useRouter at render, which
    // needs the App Router mock the nextjs-vite framework provides.
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof FilteredEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 404 — Newsreader numeral, "Go to Dashboard" + "Search ⌘K" actions. */
export const NotFound: Story = {
  render: () => (
    <div className="yc-state-wrap">
      <NotFoundState />
    </div>
  ),
};

/** Permission denied — warn-toned lock disc, request-access + back actions. */
export const PermissionDenied: Story = {
  render: () => (
    <div className="yc-state-wrap">
      <PermissionDeniedState
        resource="Finance"
        detail="invoices and payouts"
        role="Vet technician"
      />
    </div>
  ),
};

/** Filtered-empty — blue filter disc, "Clear all filters" action. */
export const FilteredEmpty: Story = {
  render: () => (
    <div className="yc-state-wrap">
      <FilteredEmptyState onClearFilters={() => {}} />
    </div>
  ),
};
