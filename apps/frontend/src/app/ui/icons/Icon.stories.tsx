import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from './Icon';
import { OFFLINE_ICONS } from './offlineIcons';

const meta = {
  title: 'Icons/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Drop-in replacement for Iconify’s `<Icon>`. Import this rather than `@iconify/react`: a ' +
          'bare string name makes Iconify fetch the icon from api.iconify.design at render time, which ' +
          'costs a third-party request on first paint and is blocked outright by the app’s CSP. This ' +
          'wrapper looks the name up in the bundled `OFFLINE_ICONS` set first, so rendering stays local ' +
          'and synchronous. A name that is not bundled falls through to Iconify unchanged - which is ' +
          'the one case to watch for, since it will silently render nothing under the CSP.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    icon: 'solar:calendar-bold',
    width: 28,
    height: 28,
  },
  argTypes: {
    icon: {
      control: 'select',
      options: Object.keys(OFFLINE_ICONS),
      description: 'Bundled icon name. Anything outside this list is not offline-safe.',
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Coloured: Story = {
  name: 'Inherits currentColor',
  args: { icon: 'solar:heart-bold', width: 32, height: 32 },
  decorators: [
    (Story) => (
      <span style={{ color: 'var(--blue-text)' }}>
        <Story />
      </span>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Icons paint in `currentColor`, so they take the ink of whatever they sit in rather than ' +
          'carrying a colour of their own. Set the colour on the parent.',
      },
    },
  },
};

export const BundledSet: Story = {
  name: 'The bundled set',
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
        gap: 12,
        maxWidth: 680,
      }}
    >
      {Object.keys(OFFLINE_ICONS).map((name) => (
        <div
          key={name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '12px 6px',
            borderRadius: 12,
            border: '1px solid var(--hairline)',
            background: 'var(--screen)',
            color: 'var(--ink-body)',
          }}
        >
          <Icon icon={name} width={24} height={24} />
          <span
            style={{
              fontSize: 10,
              lineHeight: 1.3,
              textAlign: 'center',
              color: 'var(--ink-faint)',
              wordBreak: 'break-word',
            }}
          >
            {name.replace(/^[^:]+:/, '')}
          </span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Every name that renders without a network request. Check here before using an icon name ' +
          'in a component - one that is missing needs adding to `offlineIcons.ts` first.',
      },
    },
  },
};
