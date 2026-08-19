import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import RichTextEditor from './RichTextEditor';
import SectionContainer from '../SectionContainer/SectionContainer';

const meta = {
  title: 'Primitives/RichTextEditor',
  component: RichTextEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tiptap rich-text editor matching the SOAP editor in the "PIMS - Appointments" ' +
          'design. An editable field carries the recessed --field-bg surface (1.5px hairline ' +
          'border, 12px radius); on focus it gains a blue border + glow and reveals a docked ' +
          'B/I/U/list/indent toolbar bar. Read-only notes drop the surface and toolbar so ' +
          'history never reads as an editable field.\n\n' +
          'That toolbar is `display: none` until `.yc-rte-field:focus-within`, so no prop reveals ' +
          'it and none of the existing stories ever had. Its layout, its hairline underline and ' +
          'its five buttons had never been rendered in Storybook at all - the component was ' +
          'documented as having a toolbar that no snapshot contained.\n\n' +
          'The focused stories below click into the field so the bar, the blue border and the 3px ' +
          'glow are drawn. Worth knowing when reading them: the toolbar buttons `preventDefault` ' +
          'on mousedown precisely so clicking one keeps focus inside the field and the bar stays ' +
          'open - behaviour that is invisible unless the bar is on screen.\n\n' +
          '`useEditor` runs with `immediatelyRender: false`, so the textbox arrives after mount; ' +
          'the play functions await it rather than assuming it is there.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    readOnly: { control: 'boolean' },
  },
  args: {
    ariaLabel: 'Notes',
    value: '',
    onChange: fn(),
    placeholder: 'Patient history and owner-reported information',
  },
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting (toolbar hidden)',
};

export const Focused: Story = {
  name: 'Focused (toolbar revealed)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('textbox');
    await userEvent.click(field);
    // The bar is CSS-gated on :focus-within, so assert it is actually displayed
    // rather than merely present in the DOM - it is present either way.
    const toolbar = await canvas.findByRole('toolbar');
    await expect(toolbar).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the component was described by and never drawn in: the docked B / I / U / list ' +
          '/ indent bar, its hairline underline on the --screen band, and the focused field border.',
      },
    },
  },
};

export const FocusedWithContent: Story = {
  name: 'Focused with content',
  args: { value: '<p>Bright, alert, responsive. Eating and drinking normally.</p>' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('textbox'));
    expect(await canvas.findByRole('toolbar')).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Toolbar over real content, which is where the bar competes with the first line of text ' +
          'for the top of the field.',
      },
    },
  },
};

export const WithContent: Story = {
  args: {
    value: '<p>Bright, alert, responsive. Eating and drinking normally.</p>',
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: '<p>Bright, alert, responsive. Eating and drinking normally.</p>',
  },
};

/** The SOAP note arrangement: a titled section (its own focus border suppressed)
 *  wrapping the editor, so only the inner field highlights on focus. */
export const SoapSection: Story = {
  render: (args) => (
    <div className="flex flex-col gap-5">
      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Subjective (History)"
        compactTop
        disableFocusBorder
      >
        <RichTextEditor {...args} ariaLabel="Subjective history" />
      </SectionContainer>
      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Objective (Examination)"
        compactTop
        disableFocusBorder
      >
        <RichTextEditor
          {...args}
          ariaLabel="Objective examination"
          placeholder="Examination findings and recorded vitals"
        />
      </SectionContainer>
    </div>
  ),
};
