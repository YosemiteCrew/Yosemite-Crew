import type { Meta, StoryObj } from '@storybook/react';
import Input from './Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Base text input. Use `FormInput` for floating-label inputs in forms. ' +
          'This primitive is for composing custom inputs or quick standalone fields.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    error: { control: 'boolean' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    placeholder: 'Enter value…',
    error: false,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: 'harshit@example.com', placeholder: 'Email' },
};

export const ErrorState: Story = {
  args: { error: true, defaultValue: 'bad-value', placeholder: 'Email' },
  parameters: {
    docs: {
      description: { story: 'Red border shown when `error={true}`.' },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'readonly value' },
};
