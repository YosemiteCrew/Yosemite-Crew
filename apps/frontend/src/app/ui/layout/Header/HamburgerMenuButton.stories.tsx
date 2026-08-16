import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import HamburgerMenuButton from './HamburgerMenuButton';
import './Header.css';

const meta = {
  title: 'Layout/Header/HamburgerMenuButton',
  component: HamburgerMenuButton,
  parameters: {
    layout: 'centered',
    surface: 'marketing',
    // Both are `lg:hidden`: on the default desktop canvas they render into a
    // display:none box - in the DOM, zero pixels on screen. Pin to mobile.
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        component:
          'Three-bar menu toggle for the public header, hidden from `lg` up. `menuOpen` drives both ' +
          'the animation (top and bottom bars rotate into a cross, the middle one scales away) and ' +
          'the accessible state: `aria-expanded` tracks it and the label flips between Open and Close ' +
          'menu. Pass `controlsId` matching the drawer’s `id` so the button and `<MobileMenu>` are ' +
          'wired to each other for screen readers.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    menuOpen: false,
    controlsId: 'yc-mobile-menu',
  },
  argTypes: {
    onClick: { action: 'toggled' },
  },
} satisfies Meta<typeof HamburgerMenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  args: { menuOpen: true },
  parameters: {
    docs: {
      description: {
        story: 'The open state: bars crossed, `aria-expanded="true"`, label reads “Close menu”.',
      },
    },
  },
};

const Toggling = ({ controlsId }: { controlsId?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <HamburgerMenuButton
      menuOpen={open}
      onClick={() => setOpen((v) => !v)}
      controlsId={controlsId}
    />
  );
};

export const Interactive: Story = {
  name: 'Interactive (press it)',
  render: (args) => <Toggling controlsId={args.controlsId} />,
  parameters: {
    docs: {
      description: {
        story: 'Wired to local state so the 300ms bar transition can be seen in both directions.',
      },
    },
  },
};
