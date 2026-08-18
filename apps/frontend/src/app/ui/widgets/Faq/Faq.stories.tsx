import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import Faq from './Faq';

const QUESTIONS = {
  openSource: 'What are the benefits of open-source in animal health?',
  security: 'How does Yosemite Crew ensure high data security and reliability?',
  observational: 'What are observational tools?',
} as const;

const ANSWERS = {
  openSource: /Open-source models encourage collaboration among researchers/,
  security: /ISO 27001 and SOC 2-compliant cloud hosting/,
  observational: /Observational tools are structured methods/,
};

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
          'affordance turned off; the section styling (heading, panel rhythm) lives in `Faq.css`.\n\n' +
          'The answer panel had never been drawn. `Accordion` does not hide an open panel with ' +
          'CSS - it renders `{open && hasChildren && <div>}`, so with every row collapsed the ' +
          'answers are not in the document at all, and both existing stories are of five closed ' +
          'headers. Everything the section exists to say was therefore outside every snapshot: ' +
          'the `Faq_panel` copy, its `pb-2 px-3` inset, and - the part that only appears open - ' +
          'the header losing its full border for `border-x border-t rounded-t-2xl` while the ' +
          'panel supplies the matching `border-x border-b rounded-b-2xl` underneath. An open row ' +
          'is two elements pretending to be one box, and a mismatch between them is invisible ' +
          'until something is open.\n\n' +
          'The chevron is not a separate glyph per state either: one `IoIosArrowDown` rotated ' +
          'from `-rotate-90` to `rotate-0`, so a closed row points right and an open one points ' +
          'down.\n\n' +
          'Worth noting while reading the markup: each panel carries the `id` its Bootstrap ' +
          'ancestor used (`collapseOne`...`collapseFive`), but nothing references it - the header ' +
          'button has no `aria-controls`, only `aria-expanded` and an `aria-label` of the ' +
          'question.\n\n' +
          'The stories below open rows with a `play` function and assert the answer text, not the ' +
          '`aria-expanded` flag - a row that expands onto an empty panel would pass the flag ' +
          'check and look like a working accordion in the a11y tree.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Faq>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expanded: Story = {
  name: 'Answer expanded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing to read before the click: the panel is not rendered, not hidden.
    await expect(canvas.queryByText(ANSWERS.openSource)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: QUESTIONS.openSource }));
    // Assert the answer, not the flag - an empty panel would satisfy aria-expanded.
    await expect(canvas.getByText(ANSWERS.openSource)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: QUESTIONS.openSource })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first answer open: the header sheds its bottom border and bottom radius, and the ' +
          'panel below carries them instead, so the two together read as one rounded card. The ' +
          'four rows below stay closed and keep their full `rounded-2xl` outline.',
      },
    },
  },
};

export const OnlyOneOpenAtATime: Story = {
  name: 'Opening a second answer closes the first',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: QUESTIONS.openSource }));
    await expect(canvas.getByText(ANSWERS.openSource)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: QUESTIONS.security }));
    // The second answer is mounted and the first is gone from the DOM entirely.
    await expect(canvas.getByText(ANSWERS.security)).toBeInTheDocument();
    await expect(canvas.queryByText(ANSWERS.openSource)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The single `openItem` string in `Faq` is what makes this exclusive - each `Accordion` ' +
          'is fully controlled, so opening one is the same event that closes the other. The list ' +
          'height therefore changes twice in one click, which is only observable with a longer ' +
          'answer replacing a shorter one.',
      },
    },
  },
};

export const CollapsesAgain: Story = {
  name: 'Clicking an open answer closes it',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: QUESTIONS.observational });
    await userEvent.click(header);
    await expect(canvas.getByText(ANSWERS.observational)).toBeInTheDocument();
    await userEvent.click(header);
    // `onOpenChange(false)` clears `openItem`, so the section returns to all-closed.
    await expect(canvas.queryByText(ANSWERS.observational)).not.toBeInTheDocument();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The last question, opened and closed again. Worth its own story because "one open at a ' +
          'time" and "always one open" are easy to confuse: the section is allowed to rest with ' +
          'every answer closed, which is also the state it mounts in.',
      },
    },
  },
};

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
