import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import PhoneMoreSheet from './PhoneMoreSheet';
import type { PhoneMoreLink, PhoneMoreSection } from './PhoneMoreSheet';
import { PHONE_MORE_LINKS, PHONE_MORE_SECTIONS } from './phoneShellConfig';

// The tiles, rows and status line are styled by the shell's stylesheet, which
// the app loads through PhoneShell rather than the sheet itself.
import './PhoneShell.css';

/**
 * The shell builds this list by running every configured area through the
 * permission gate; the stories reuse the same config so the labels and context
 * lines cannot drift from the app's.
 */
const toSections = (disabledKeys: readonly string[] = []): PhoneMoreSection[] =>
  PHONE_MORE_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    context: section.context,
    href: section.href,
    icon: section.icon,
    disabled: disabledKeys.includes(section.key),
  }));

const LINKS: PhoneMoreLink[] = PHONE_MORE_LINKS.map((link) => ({
  key: link.key,
  label: link.label,
  href: link.href,
  icon: link.icon,
}));

const meta = {
  title: 'Layout/PhoneMoreSheet',
  component: PhoneMoreSheet,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    // Both the sheet skin (Sheet.css) and the tile grid (PhoneShell.css) sit
    // inside `max-width: 767px` media queries, so the canvas and the Chromatic
    // snapshot have to be phone width or this renders as unstyled lists.
    chromatic: { viewports: [375] },
    docs: {
      description: {
        component:
          'The sheet behind the More tab on phones: a two-column grid of the six secondary areas ' +
          '(each with a context line), then the always-available Settings and Developer portal rows, ' +
          'sign out, and the system status line. This is the only place a phone can sign out — the ' +
          'avatar menu that holds it on desktop is hidden below 768px. Built on the shared ' +
          '`BottomSheet`, so it inherits the grabber, focus trap and Escape-to-close behaviour.',
      },
    },
  },
  args: {
    open: true,
    sections: toSections(),
    links: LINKS,
    onClose: fn(),
    onNavigate: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof PhoneMoreSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An owner who can reach everything: all six tiles live, both links present. */
export const Default: Story = {
  name: 'All areas available',
};

/**
 * The permission case. Areas the membership cannot reach are rendered disabled
 * rather than removed, so the sheet keeps a stable six-tile grid and the user
 * can see what exists but is not theirs.
 */
export const WithDisabledAreas: Story = {
  name: 'Some areas locked',
  args: {
    sections: toSections(['finance', 'inventory', 'integrations']),
  },
};

/**
 * A member whose only extra link is Settings — the developer portal row is
 * dropped entirely for non-developer accounts, unlike the section tiles.
 */
export const WithoutDeveloperPortal: Story = {
  name: 'No developer portal',
  args: {
    links: LINKS.filter((link) => link.key !== 'developer-portal'),
  },
};

/**
 * While closed the sheet renders nothing at all — no hidden dialog, no
 * backdrop — so a parked More sheet cannot swallow taps on the page behind it.
 */
export const Closed: Story = {
  name: 'Closed (renders nothing)',
  args: { open: false },
};
