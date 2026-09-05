import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AddTask from './AddTask';

const meta = {
  title: 'Companions/Sections/AddTask',
  component: AddTask,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "New task" section of the companion record, as it stands: a 23px heading and one ' +
          'accordion, and nothing else. It takes no props and holds no state, so this is its ' +
          'only state.\n\n' +
          'The accordion is passed `defaultOpen` but no children, and `Accordion` only renders ' +
          'its panel when it has some - so the section draws an open chevron over an empty ' +
          'header strip. That reads as a broken accordion rather than an unbuilt one, which is ' +
          'exactly why it is worth pinning: the day a child is added, this story is the ' +
          'before-picture.\n\n' +
          'Two names collide here. This is `features/companions/components/Sections/AddTask`, ' +
          'the placeholder; the working task drawer is `Companions/AddTask` ' +
          '(`features/companions/pages/Companions/AddTask`), which owns the real eleven-control ' +
          'form. Nothing imports this one - `CompanionInfo` maps only ' +
          '`companion-information`, `parent-information`, `core-information` and `history`.\n\n' +
          'Rendered at 530px, the width of the drawer `CompanionInfo` opens its sections inside ' +
          '(`Modal` with no `size` falls back to `lg`).',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[530px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Placeholder shell',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The panel heading and the accordion title now name different things, so
       each is reachable directly; they used to share the words "Add task" and a
       text query matched five nodes. */
    const trigger = canvas.getByRole('button', { name: 'Task details' });
    const headerRow = trigger.parentElement as HTMLElement;
    const accordionRoot = headerRow.parentElement as HTMLElement;

    // Open, and yet the accordion root has exactly one child - the header strip.
    // `hasChildren` gates the panel, so `defaultOpen` alone renders nothing. Add a
    // child and this count becomes 2, which is the signal that the section is real.
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(accordionRoot.children).toHaveLength(1);

    // `showEditIcon={false}`, so there is no pencil beside the title. The default
    // is true, so dropping the prop silently adds an edit control to a section that
    // has nothing to edit.
    await expect(
      canvas.queryByRole('button', { name: 'Edit Task details' })
    ).not.toBeInTheDocument();

    // The panel heading is the design's 17px sans panel title and a real <h2>, so
    // it is announced as a heading rather than being told apart by measurement.
    const heading = canvas.getByRole('heading', { name: 'New task' });
    await expect(globalThis.getComputedStyle(heading).fontSize).toBe('17px');
  },
};

export const Phone: Story = {
  name: 'Phone: full-width strip',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Task details' });
    const headerRow = trigger.parentElement as HTMLElement;
    // The header strip is `w-full` inside a `w-full` column, so at 375 it should
    // still fill the viewport rather than shrinking to its content or overflowing.
    await expect(headerRow.getBoundingClientRect().width).toBeGreaterThan(300);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
