import type { Meta, StoryObj } from '@storybook/react';
import Faq from './Faq';

const meta = {
  title: 'Widgets/Faq',
  component: Faq,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The marketing "Frequently asked questions" section. It owns its five questions and its ' +
          'own open/closed state: only one answer is expanded at a time, so opening a second ' +
          'question closes the first. Each row is the shared `Accordion` primitive with the edit ' +
          'affordance turned off; the section styling (heading, panel rhythm) lives in `Faq.css`.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Faq>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Phone: Story = {
  name: 'Phone width',
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story:
          'At 375px the questions wrap onto two and three lines. This is the width where the ' +
          'chevron has to stay pinned right and out of the wrapping title, so it is worth a ' +
          'snapshot of its own.',
      },
    },
  },
};
