import type { Meta, StoryObj } from '@storybook/react';
import Header from './Header';

const meta = {
  title: 'Layout/Header/Header',
  component: Header,
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    layout: 'fullscreen',
    surface: 'marketing',
    docs: {
      description: {
        component:
          'Sticky top bar that picks its contents from one flag: `user` renders `<UserHeader>`, the ' +
          'default renders `<GuestHeader>`. The guest form also docks - it floats as a pill until the ' +
          'reader passes 60% of the viewport height, then flattens into a flush bar. The threshold is ' +
          'viewport-relative rather than keyed to the first section, because some public pages wrap ' +
          'the whole document in their first child, which would make that bottom edge useless as a ' +
          'trigger. Scroll listeners are only attached in the guest form.',
      },
    },
  },
  tags: ['autodocs'],
  args: { user: false },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

const Page = () => (
  <div style={{ height: '220vh', padding: '32px clamp(16px, 5vw, 60px)' }}>
    <p style={{ color: 'var(--ink-muted)', maxWidth: 520, lineHeight: 1.6 }}>
      Scroll past 60% of the viewport height to watch the floating pill dock into the flush bar.
    </p>
  </div>
);

export const Guest: Story = {
  name: 'Guest (floating pill)',
  render: (args) => (
    <>
      <Header {...args} />
      <Page />
    </>
  ),
};

export const SignedIn: Story = {
  name: 'Signed in',
  args: { user: true },
  render: (args) => (
    <>
      <Header {...args} />
      <Page />
    </>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The `user` form renders `<UserHeader>` and skips the dock behaviour entirely - no scroll ' +
          'or resize listener is attached.',
      },
    },
  },
};
