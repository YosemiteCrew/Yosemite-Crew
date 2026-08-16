import type { Meta, StoryObj } from '@storybook/react';
import Fallback from './index';

const meta = {
  title: 'Overlays/Fallback',
  component: Fallback,
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/invoices' } },
    layout: 'padded',
    docs: {
      description: {
        component:
          'Section-level permission denial. This used to be a bare red “Not authorized” line - error ' +
          'styling for a state that is not an error, naming neither the missing permission nor a way ' +
          'forward. It now renders `PermissionDeniedState` in its compact `inline` variant, which ' +
          'quotes the caller’s real role in the org and offers a request-access route. Use this ' +
          'inside a page; for a whole page, pass `deniedResource` to `PermissionGate` instead and get ' +
          'the full centered card.',
      },
    },
  },
  tags: ['autodocs'],
  args: { resource: 'invoices and payouts' },
} satisfies Meta<typeof Fallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutResource: Story = {
  name: 'No resource named',
  args: { resource: undefined },
  parameters: {
    docs: {
      description: {
        story:
          'Falls back to “this section”. Prefer passing `resource` - naming what is being withheld is ' +
          'the difference between a notice someone can act on and a dead end.',
      },
    },
  },
};

export const InContext: Story = {
  name: 'In a section card',
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 620,
          padding: 20,
          borderRadius: 16,
          border: '1px solid var(--hairline)',
          background: 'var(--screen)',
        }}
      >
        <h3
          style={{
            margin: '0 0 14px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Billing
        </h3>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'How it actually lands: one section of a page is withheld while the rest of the page ' +
          'renders normally around it.',
      },
    },
  },
};
