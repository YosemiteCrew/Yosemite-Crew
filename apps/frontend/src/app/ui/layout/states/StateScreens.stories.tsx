import type { Meta, StoryObj } from '@storybook/react';
import FilteredEmptyState from './FilteredEmptyState';
import NotFoundState from './NotFoundState';
import PermissionDeniedState from './PermissionDeniedState';
import Fallback from '../../overlays/Fallback';

/**
 * The app-wide global state screens from the "Chrome & States" design: a
 * `--screen` card (hairline, radius-20, layered shadow) centered on the page,
 * with an icon disc / Newsreader 404, a title, muted body copy and pill
 * actions. Light + dark resolve through the shared token layer.
 *
 * `PermissionDeniedState` ships two variants:
 * - `page` (default) — the centered card, for a whole route. Reached by passing
 *   `deniedResource` to `PermissionGate`.
 * - `inline` — a compact notice for a section or panel, where the full card
 *   would overwhelm the layout. This is what `<Fallback />` now renders.
 *
 * A permission boundary is an *expected* state, not a failure, so neither
 * variant uses error styling.
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

/**
 * Permission denied, page variant — warn-toned lock disc, request-access +
 * back actions. Rendered when a route-level `PermissionGate` is given
 * `deniedResource`.
 */
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

/**
 * Permission denied, inline variant — the compact section notice. Names the
 * caller's real role and the missing resource, and offers a way forward,
 * instead of the bare red "Not authorized" line this replaced.
 */
export const PermissionDeniedInline: Story = {
  render: () => (
    <div style={{ maxWidth: 560, padding: 24, display: 'grid', gap: 12 }}>
      <PermissionDeniedState
        variant="inline"
        resource="billing and subscription"
        detail="billing and subscription"
        role="Receptionist"
      />
      <PermissionDeniedState
        variant="inline"
        resource="the team roster"
        detail="the team roster"
        role="Assistant"
      />
    </div>
  ),
};

/**
 * `<Fallback />` — the section-level denial used by `PermissionGate`'s
 * `fallback` prop at ~16 call sites. Now a thin wrapper over the inline
 * variant; previously a bare red "Not authorized" line.
 */
export const SectionFallback: Story = {
  render: () => (
    <div style={{ maxWidth: 560, padding: 24, display: 'grid', gap: 12 }}>
      <Fallback resource="practice analytics" />
      <Fallback resource="documents" />
      <Fallback />
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

/**
 * Filtered-empty without a clear handler — the action is hidden rather than
 * rendering a dead button.
 */
export const FilteredEmptyNoAction: Story = {
  render: () => (
    <div className="yc-state-wrap">
      <FilteredEmptyState
        title="No invoices in this range"
        message="Adjust the date range or clear the status filter to see more."
      />
    </div>
  ),
};
