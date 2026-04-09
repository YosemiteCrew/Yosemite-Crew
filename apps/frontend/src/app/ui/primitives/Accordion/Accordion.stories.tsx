import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Accordion from './Accordion';

/**
 * Collapsible content section with optional edit/delete controls.
 *
 * **Status: Approved**
 *
 * Supports both controlled (`open` + `onOpenChange`) and uncontrolled (`defaultOpen`) usage.
 * All interactive controls (toggle, edit, delete) are semantic `<button>` elements.
 *
 * @see src/app/ui/primitives/Accordion/Accordion.tsx
 */
const meta = {
  title: 'Primitives/Accordion',
  component: Accordion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Collapsible section component. The expand toggle uses a semantic `<button>` with `aria-expanded`. ' +
          'The edit and delete controls are each wrapped in their own `<button>` for keyboard and screen-reader safety.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: { control: 'boolean' },
    showEditIcon: { control: 'boolean' },
    showDeleteIcon: { control: 'boolean' },
    isEditing: { control: 'boolean' },
    title: { control: 'text' },
    onEditClick: { action: 'edit clicked' },
    onDeleteClick: { action: 'delete clicked' },
    onOpenChange: { action: 'open changed' },
  },
  args: {
    title: 'Section title',
    defaultOpen: false,
    showEditIcon: true,
    showDeleteIcon: false,
    isEditing: false,
    onEditClick: fn(),
    onDeleteClick: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Core states
// ---------------------------------------------------------------------------

export const Collapsed: Story = {
  args: {
    title: 'Appointment details',
    defaultOpen: false,
    children: (
      <p className="text-body-4 text-text-secondary py-3">Appointment content goes here.</p>
    ),
  },
};

export const Expanded: Story = {
  args: {
    title: 'Appointment details',
    defaultOpen: true,
    children: (
      <p className="text-body-4 text-text-secondary py-3">Appointment content goes here.</p>
    ),
  },
};

export const WithEditAndDelete: Story = {
  name: 'With edit & delete controls',
  args: {
    title: 'Service item',
    defaultOpen: false,
    showEditIcon: true,
    showDeleteIcon: true,
    children: (
      <p className="text-body-4 text-text-secondary py-3">
        Service details are editable and deletable.
      </p>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both edit and delete icon buttons are fully keyboard-accessible. ' +
          'They carry `aria-label` values that describe the action and the item name.',
      },
    },
  },
};

export const EditingState: Story = {
  name: 'While editing (icons hidden)',
  args: {
    title: 'Service item',
    defaultOpen: true,
    showEditIcon: true,
    showDeleteIcon: true,
    isEditing: true,
    children: (
      <p className="text-body-4 text-text-secondary py-3">
        Edit/delete controls are hidden while isEditing=true.
      </p>
    ),
  },
};

export const NoEditIcon: Story = {
  name: 'Without edit icon',
  args: {
    title: 'Read-only section',
    showEditIcon: false,
    defaultOpen: false,
    children: (
      <p className="text-body-4 text-text-secondary py-3">This section has no edit control.</p>
    ),
  },
};

export const WithCustomRightElement: Story = {
  name: 'With custom right element',
  args: {
    title: 'Status section',
    showEditIcon: false,
    defaultOpen: false,
    rightElement: (
      <span className="text-caption-1 text-status-success-text bg-status-success-bg px-2 py-0.5 rounded-full">
        Active
      </span>
    ),
    children: <p className="text-body-4 text-text-secondary py-3">Section with a custom badge.</p>,
  },
};

export const Stacked: Story = {
  name: 'Stacked list',
  render: () => (
    <div className="flex flex-col gap-2 w-full max-w-md">
      {['General info', 'Billing', 'Preferences'].map((title) => (
        <Accordion key={title} title={title} showEditIcon={false}>
          <p className="text-body-4 text-text-secondary py-3">Content for {title}.</p>
        </Accordion>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple independent accordion sections. Each manages its own state.',
      },
    },
  },
};
