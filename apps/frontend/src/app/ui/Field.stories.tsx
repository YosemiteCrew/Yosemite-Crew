import type { Meta, StoryObj } from '@storybook/react';
import Field from './Field';
import Input from './Input';

const meta = {
  title: 'Primitives/Field',
  component: Field,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    children: <Input id="work-email" placeholder="name@clinic.com" />,
    htmlFor: 'work-email',
    label: 'Work email',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    children: (
      <Input
        id="reminder-email"
        aria-describedby="reminder-email-message"
        placeholder="name@clinic.com"
      />
    ),
    hint: 'We use this for appointment reminders.',
    htmlFor: 'reminder-email',
    messageId: 'reminder-email-message',
  },
};

export const Required: Story = {
  args: {
    children: <Input id="required-email" placeholder="name@clinic.com" required />,
    htmlFor: 'required-email',
  },
};

export const WithError: Story = {
  args: {
    children: (
      <Input
        id="room"
        aria-describedby="room-message"
        defaultValue="Room 2"
        error
        placeholder="Enter a room"
      />
    ),
    error: 'That room is already booked at this time.',
    htmlFor: 'room',
    label: 'Room',
    messageId: 'room-message',
  },
};

export const Disabled: Story = {
  args: {
    children: (
      <Input
        id="disabled-email"
        defaultValue="team@clinic.com"
        disabled
        placeholder="name@clinic.com"
      />
    ),
    disabled: true,
    htmlFor: 'disabled-email',
  },
};
