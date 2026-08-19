import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import HamburgerMenuButton from './HamburgerMenuButton';
import MobileMenu from './MobileMenu';
import './Header.css';

const links = ['Product', 'Pricing', 'Developers', 'Community', 'Company'];

const MenuLinks = () => (
  <>
    {links.map((label) => (
      <a
        key={label}
        href="#top"
        style={{
          padding: '11px 4px',
          textDecoration: 'none',
          color: 'var(--ink-body)',
          fontSize: 15,
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </a>
    ))}
  </>
);

const meta = {
  title: 'Layout/Header/MobileMenu',
  component: MobileMenu,
  // Both are `lg:hidden`: on the default desktop canvas they render into a
  // display:none box - in the DOM, zero pixels on screen. Pin to mobile.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'padded',
    surface: 'marketing',
    docs: {
      description: {
        component:
          'Public-header drawer, hidden from `lg` up. Closed it is not merely transparent: `hidden` ' +
          'and `inert` are both set, so it is out of the tab order and invisible to assistive tech ' +
          'rather than a stack of focusable links sitting under the page. Passing `onClose` also binds ' +
          'Escape. Give it the same `id` the hamburger points at with `controlsId`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isOpen: true,
    id: 'yc-mobile-menu',
    children: <MenuLinks />,
  },
  argTypes: {
    children: { control: false },
    onClose: { action: 'closed' },
  },
} satisfies Meta<typeof MobileMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: { isOpen: false },
  parameters: {
    docs: {
      description: {
        story:
          'Renders nothing visible - the drawer is `hidden` and `inert`. The story is here so the ' +
          'closed state is snapshotted too: a regression that leaves the links focusable while ' +
          'invisible would not show up in the open story.',
      },
    },
  },
};

const HeaderPair = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
      <HamburgerMenuButton
        menuOpen={open}
        onClick={() => setOpen((v) => !v)}
        controlsId="yc-mobile-menu"
      />
      <MobileMenu id="yc-mobile-menu" isOpen={open} onClose={() => setOpen(false)}>
        <MenuLinks />
      </MobileMenu>
    </div>
  );
};

export const WithToggle: Story = {
  name: 'Wired to the hamburger',
  render: () => <HeaderPair />,
  parameters: {
    docs: {
      description: {
        story:
          'The pair as the header assembles them, including the Escape binding. This is the ' +
          'combination to check when changing either one.',
      },
    },
  },
};
