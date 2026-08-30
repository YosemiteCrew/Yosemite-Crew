import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import CompanionDocumentUploadForm from './CompanionDocumentUploadForm';

const COMPANION_ID = 'companion-poppy-812';

/**
 * The draft the records tab opens with: `emptyCompanionRecord` plus the org name
 * its effect writes in. `issueDate` is a fixed date-only string rather than
 * today's, so the field's value can be asserted - the component only ever
 * `split('T')[0]`s it, so no timezone is involved either way.
 */
const draft = (over: Partial<CompanionRecord> = {}): CompanionRecord => ({
  title: '',
  category: 'HEALTH',
  subcategory: 'SURGERY_OR_PROCEDURE',
  attachments: [],
  visitType: 'HOSPITAL',
  issuingBusinessName: 'Avenger Park Veterinary',
  issueDate: '2026-07-14',
  hasIssueDate: true,
  ...over,
});

const PDF = new File(['%PDF-1.4 storybook fixture'], 'discharge-summary.pdf', {
  type: 'application/pdf',
});

type FormProps = React.ComponentProps<typeof CompanionDocumentUploadForm>;

/**
 * The form is fully controlled - it owns no state at all - so every branch here
 * (the sub-category options, the issue-date field, the attached file card) only
 * moves if something holds the draft. This harness is that something: the args
 * seed it, and from then on the real `setFormData`/`setFile` dispatches drive it.
 *
 * The render-time resync is the same guard `LabelDropdown` uses on its own
 * selection: without it the state captured at mount would ignore a `formData`
 * arg changed from the Controls panel, and the docs page would show a form that
 * silently refuses to update.
 */
const ControlledUploadForm = (props: FormProps) => {
  const [seed, setSeed] = useState(props.formData);
  const [record, setRecord] = useState(props.formData);
  const [file, setFile] = useState<File | null>(props.file);
  if (seed !== props.formData) {
    setSeed(props.formData);
    setRecord(props.formData);
    setFile(props.file);
  }
  return (
    <CompanionDocumentUploadForm
      {...props}
      formData={record}
      setFormData={setRecord}
      file={file}
      setFile={setFile}
    />
  );
};

/** The dropdown menu portals to `document.body`, so it is never in the canvas. */
const openPanel = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument());
  return document.querySelector('[data-portal-dropdown]') as HTMLElement;
};

const meta = {
  title: 'Documents/CompanionDocumentUploadForm',
  component: CompanionDocumentUploadForm,
  render: (args) => <ControlledUploadForm {...args} />,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The body of the "Upload record" sheet, driven from props instead of through the sheet ' +
          'that normally owns it. **CompanionHistory/HistoryDocumentUpload** already covers the ' +
          'form as a user meets it - opened, at its defaults, and after a failed save. These ' +
          'stories cover the states that caller cannot reach:\n\n' +
          '- **The dependent dropdowns.** Choosing a category rewrites the sub-category *options ' +
          'and* the selection, in one `setFormData`. Getting only half of that right leaves a ' +
          'health sub-category selected against a hygiene list, and the value goes to the API ' +
          'unchanged.\n' +
          '- **The issue-date branch.** `hasIssueDate` is the only conditional field in the ' +
          'form, and it defaults on, so the sheet never shows it closed.\n' +
          '- **All four validation messages at once.** Two of them - category and sub-category - ' +
          'are unreachable through the sheet, because the draft opens with both selected and a ' +
          'dropdown can only replace a selection, never clear one. They are drawn here so the ' +
          'error treatment is reviewable even though nothing produces it today.\n' +
          '- **`saving`.** The sheet never passes it, so the disabled "Saving..." button has ' +
          'never been drawn.\n\n' +
          'Nothing here touches the network. `CompanionDoc` only calls ' +
          '`POST /v1/document/pms/upload-url` from the file input’s change handler, so a story ' +
          'that hands the form an already-picked `File` exercises the attached-file card and the ' +
          'remove wiring without an upload.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: COMPANION_ID,
    formData: draft(),
    file: null,
    formDataErrors: {},
    saving: false,
    onSave: fn(),
    setFormData: fn(),
    setFile: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[560px] rounded-2xl bg-[var(--screen)] p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionDocumentUploadForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A new record',
  // Unique per story on purpose: `issueDateInputId` defaults to a constant, and
  // the autodocs page mounts every story at once - duplicate ids would point
  // this label at the first story's checkbox.
  args: { issueDateInputId: 'issue-date-default' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exact accessible names. `LabelDropdown` builds them as
       `${placeholder}: ${selected.label}`, so these three strings are the proof
       that the draft opens with all three already chosen - a loose /Category/
       would match an empty, unselected trigger just as happily. */
    await expect(canvas.getByRole('button', { name: 'Category: Health' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Sub-category: Surgery/ Procedure' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Visit type: Hospital' })).toBeInTheDocument();

    await expect(canvas.getByLabelText('Title')).toHaveValue('');
    await expect(canvas.getByLabelText('Issuing business name')).toHaveValue(
      'Avenger Park Veterinary'
    );

    /* `hasIssueDate` defaults on, so the checkbox REMOVES a field rather than
       adding one - the reverse of how an "Include ..." checkbox usually reads. */
    await expect(canvas.getByRole('checkbox', { name: 'Include issue date' })).toBeChecked();
    await expect(canvas.getByLabelText('Issue date')).toHaveValue('2026-07-14');

    // No file yet: the uploader is on its own, with no attached-file card.
    await expect(canvas.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};

export const SubcategoryFollowsCategory: Story = {
  name: 'Category rewrites the sub-category list',
  args: { issueDateInputId: 'issue-date-category' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Category: Health' }));
    await userEvent.click(
      within(await openPanel()).getByRole('button', { name: 'Hygiene maintenance' })
    );

    /* The selection moves with the list, in the same `setFormData`. This is the
       assertion the whole story exists for: leaving `subcategory` alone would
       keep SURGERY_OR_PROCEDURE selected against a hygiene list - a value that
       is not in the visible options and that goes to the API unchanged, because
       `document.subcategory` is posted verbatim. */
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Sub-category: Bathing' })).toBeInTheDocument()
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Sub-category: Bathing' }));
    const options = within(await openPanel())
      .getAllByRole('button')
      .map((option) => (option.textContent ?? '').trim());

    // The hygiene table in full, and nothing from the health one.
    await expect(options).toEqual([
      'Bathing',
      'Nail trim',
      'Grooming',
      'Ear cleaning',
      'Dental cleaning',
      'Skin care',
      'Anal gland expression',
      'Other',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Health and hygiene share one `subcategory` field and one wire format, so the only ' +
          'thing keeping a hygiene record from carrying a surgical sub-category is that the ' +
          'category handler resets it. The visit type is untouched by the switch - it is an ' +
          'independent axis, not a third dependent level.',
      },
    },
  },
};

export const IssueDateToggle: Story = {
  name: 'Issue date on and off',
  args: { issueDateInputId: 'issue-date-toggle' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* A role query, not `getByLabelText('Include issue date')`: the string is on
       the wrapping <label> AND on the checkbox inside it, so a label query
       matches two nodes and throws before it can assert anything. */
    const toggle = canvas.getByRole('checkbox', { name: 'Include issue date' });
    const label = toggle.closest('label') as HTMLElement;

    /* The row is `flex-nowrap`, so the revealed field sits beside the checkbox
       rather than under it, at a fixed 210px. Measured, because the alternative
       - a wrapped row - is a layout most reviewers would accept in a snapshot. */
    const dateField = canvas.getByLabelText('Issue date');
    await expect(dateField.getBoundingClientRect().width).toBe(210);
    await expect(dateField.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      label.getBoundingClientRect().right
    );

    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.queryByLabelText('Issue date')).not.toBeInTheDocument());
    await expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    /* The value comes back. Unchecking only flips `hasIssueDate` - it does not
       clear `issueDate` - so a user who unticks the box by accident does not
       silently lose the date they typed. */
    await waitFor(() => expect(canvas.getByLabelText('Issue date')).toHaveValue('2026-07-14'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The form’s only conditional field. Note what the checkbox does *not* do: the record ' +
          'keeps its `issueDate` while the field is hidden, and `hasIssueDate` travels with the ' +
          'record - so the caller, not the form, decides whether a hidden date is still saved.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Every field in error',
  args: {
    issueDateInputId: 'issue-date-errors',
    formDataErrors: {
      title: 'Title is required',
      category: 'Category is required',
      sub: 'Sub-category is required',
      fileUrl: 'File is required',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Category is required')).toBeInTheDocument();
    await expect(canvas.getByText('Sub-category is required')).toBeInTheDocument();
    await expect(canvas.getByText('Title is required')).toBeInTheDocument();

    /* Exactly one node, not two. The form ALSO hands `fileUrl` to `CompanionDoc`
       as `error`, and that component declares the prop and never renders it - so
       wiring it through would silently double this message. */
    await expect(canvas.getAllByText('File is required')).toHaveLength(1);

    /* Only the `FormInput` error is announced. The two dropdown messages and the
       file message are plain text with no alert role, so a screen reader user
       hears one of four problems. Pinned rather than fixed here, because it is a
       gap in the shared inputs rather than in this form. */
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(canvas.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');

    // Errors do not lock the form: Save stays live so a corrected draft can go
    // straight back through the same button.
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'All four messages the error map can carry. Two of them cannot be produced through the ' +
          'upload sheet at all - the draft opens with a category and a sub-category selected, ' +
          'and `LabelDropdown` has no "clear" - so this is the only place their treatment can be ' +
          'reviewed.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Save in flight',
  args: { issueDateInputId: 'issue-date-saving', saving: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: 'Saving...' });

    await expect(save).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    /* `pointerEventsCheck: 0` because `isDisabled` also paints
       `pointer-events-none`, which makes userEvent refuse the click before the
       component gets a chance to ignore it. The point is that a second click
       cannot fire a second create request. */
    await userEvent.click(save, { pointerEventsCheck: 0 });
    await expect(args.onSave).not.toHaveBeenCalled();

    /* Only the button locks. Every field stays editable while the request is in
       flight, which is worth knowing: an edit made now is not in the record
       being saved. */
    await expect(canvas.getByLabelText('Title')).toBeEnabled();
  },
};

export const FileAttached: Story = {
  name: 'With a document attached',
  args: { issueDateInputId: 'issue-date-file', file: PDF },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('discharge-summary.pdf')).toBeInTheDocument();
    const remove = canvas.getByRole('button', { name: 'Remove discharge-summary.pdf' });

    /* The drop zone stays. Replacing a file is picking another one, so hiding
       the uploader behind the attached card would make the card a dead end. */
    await expect(canvas.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();

    await userEvent.click(remove);
    /* Remove clears the FILE only. `formData.attachments` is written by the
       uploader's own `onChange` after a successful upload, and this button does
       not touch it - so a record whose upload already finished keeps its
       attachment key even though the card is gone. */
    await waitFor(() =>
      expect(canvas.queryByText('discharge-summary.pdf')).not.toBeInTheDocument()
    );
    await expect(canvas.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `File` handed in as a prop, which is how the attached-file card is reachable without ' +
          'a network round trip: the uploader only calls the signed-URL endpoint from the file ' +
          'input’s change handler.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the issue-date row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { issueDateInputId: 'issue-date-phone' },
  /* Pinned as a width as well as a viewport global. The global resizes the
     preview iframe from the MANAGER, so a play function loaded straight from
     `iframe.html` - the story verifier, any headless run - measures the full
     panel width and reports desktop geometry as a phone result. Nothing in this
     form has a media query, so a 375px box is the reflow a phone gets. */
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvasElement.querySelector('.flex-nowrap') as HTMLElement;
    const label = canvas.getByRole('checkbox', { name: 'Include issue date' }).closest('label');
    const dateField = canvas.getByLabelText('Issue date');

    /* The one row in this form that cannot reflow: `flex-nowrap`, a `shrink-0`
       label and a `w-[210px] shrink-0` date field. Their widths are fixed, so on
       a phone the row is wider than the form and the overflow is real - it is
       clipped by whatever scroller the sheet puts around it rather than wrapping
       to a second line. Measured rather than described, because the two controls
       still look correct in a screenshot: it is the right-hand end of the date
       field that is missing. */
    await expect(dateField.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      (label as HTMLElement).getBoundingClientRect().right
    );
    await expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The form at 375px, and the one place it does not fit. Every other field is a ' +
          'full-width block that reflows on its own; the issue-date row pairs a fixed-width ' +
          'label with a fixed 210px date field under `flex-nowrap`, which overflows below roughly ' +
          '400px. Recorded here rather than fixed - the row is the component’s, but the choice ' +
          'between wrapping it and shrinking the date field is a design call.',
      },
    },
  },
};
