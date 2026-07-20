import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
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
          'history never reads as an editable field.',
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

export const Default: Story = {};

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
