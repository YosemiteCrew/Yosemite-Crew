import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { OrganizationDocument } from '@/app/features/documents/types/document';
import DocumentInfo from './DocumentInfo';

const ORG_ID = 'org-storybook-documents';

/** An uploaded file: the branch that gets a badge, a footer and a download. */
const UPLOADED: OrganizationDocument = {
  _id: 'doc-anaesthesia-consent',
  organisationId: ORG_ID,
  title: 'Consent to anaesthesia',
  description: 'Signed by the pet parent before any procedure under GA.',
  category: 'GENERAL',
  fileUrl: 'https://files.example.com/sunrise-vet/consent-to-anaesthesia.pdf',
};

/** No file at all: the in-app e-sign template, which has nothing to download. */
const TEMPLATE: OrganizationDocument = {
  _id: 'doc-cancellation',
  organisationId: ORG_ID,
  title: 'Cancellation policy',
  description: 'Merge fields: parent, visit, practitioner.',
  category: 'CANCELLATION_POLICY',
  fileUrl: '',
};

/**
 * `ModalBase` portals to `document.body`, so nothing this panel renders is
 * inside `canvasElement`, and a closed dialog stays mounted without its `open`
 * attribute - which is why the panel is addressed through `dialog[open]`.
 */
const drawer = () => document.querySelector('dialog[open]') as HTMLElement;

/** `FieldValueRow` is a flex row of exactly two divs, so a label's parent is its row. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

/**
 * The header's text column, given its title. Asserting eyebrow + title + meta as
 * one string is what proves the three belong together: the category label also
 * appears further down as the value of the Category row, so a `getByText` for it
 * passes with the header meta missing entirely.
 */
const headerTextOf = (title: HTMLElement): string =>
  (title.parentElement?.parentElement as HTMLElement).textContent ?? '';

type HarnessProps = {
  activeDocument: OrganizationDocument;
  canEditDocument: boolean;
};

const DocumentInfoHarness = ({ activeDocument, canEditDocument }: HarnessProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[560px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The documents list sits behind the drawer, so the backdrop tint and blur are visible.
      </p>
      <DocumentInfo
        showModal={open}
        setShowModal={setOpen}
        activeDocument={activeDocument}
        canEditDocument={canEditDocument}
      />
    </div>
  );
};

const meta = {
  title: 'Organization/DocumentInfo',
  component: DocumentInfoHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The document drawer, opened from a row of the organisation Documents section. None ' +
          'of it had ever been drawn: it only mounts once a row is clicked, and two of its ' +
          'three parts are conditional on top of that.\n\n' +
          'It is really three panels sharing a header. The `Document info` accordion is always ' +
          'there. The uploader below it exists only with `document:edit:any`, and it is a ' +
          'REPLACEMENT uploader - dropping a file there does not save on its own, it fills a ' +
          'second state that makes a `Save` appear in the footer next to the download.\n\n' +
          'The footer is the conditional part worth reviewing, because its condition is an OR ' +
          'of two unrelated things: `activeDocument.fileUrl || (canEditDocument && fileUrl)`. A ' +
          'template with no uploaded file gets no footer at all - not an empty bar, no bar - so ' +
          'the panel ends at the uploader and the whole action rail is missing rather than ' +
          'disabled. That is the shape a snapshot of the uploaded case never shows.\n\n' +
          '`canEditDocument` also removes the accordion pencil and the trash together, turning ' +
          'the panel into a read-only summary that can still download.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeDocument: UPLOADED,
    canEditDocument: true,
  },
} satisfies Meta<typeof DocumentInfoHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UploadedFile: Story = {
  name: 'Uploaded file (editable)',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    // Eyebrow / title / meta, as one string.
    await expect(headerTextOf(panel.getByRole('heading', { name: 'Consent to anaesthesia' }))).toBe(
      'DocumentConsent to anaesthesiaGeneral'
    );

    /* Three read rows, opened by default. Assert the row rather than the value:
       the title also sits in the header above, and the category label sits in
       the header meta, so both would pass a bare `getByText` with the accordion
       collapsed. */
    await expect(panel.getByRole('button', { name: 'Document info' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(rowOf(panel.getByText('Title')).textContent).toBe('TitleConsent to anaesthesia');
    await expect(rowOf(panel.getByText('Description')).textContent).toBe(
      'DescriptionSigned by the pet parent before any procedure under GA.'
    );
    // The stored enum is resolved through OrgDocumentCategoryOptions, not printed raw.
    await expect(rowOf(panel.getByText('Category')).textContent).toBe('CategoryGeneral');

    // Both edit affordances, and the uploader that only exists with the permission.
    await expect(panel.getByRole('button', { name: 'Edit Document info' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Delete Document info' })).toBeInTheDocument();
    /* Queried by ROLE, not by label: `PdfDocUploader` puts the same `aria-label`
       on both the drop zone and the hidden `<input type="file">` inside it, so a
       label query matches two nodes and throws. */
    await expect(panel.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();

    /* The footer exists because the document HAS a file. `Save` is the other
       half of the OR and is not here yet: it needs a freshly uploaded url in
       component state, which no amount of permission alone produces. */
    await expect(panel.getByRole('link', { name: 'Download document' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full panel. `Download document` is a real anchor at the stored url, not a button ' +
          'with a click handler, so it keeps middle-click and "copy link address" - the handler ' +
          'beside it only adds the new-tab open.',
      },
    },
  },
};

export const TemplateWithoutFile: Story = {
  name: 'E-sign template (no footer)',
  args: { activeDocument: TEMPLATE },
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    await expect(headerTextOf(panel.getByRole('heading', { name: 'Cancellation policy' }))).toBe(
      'DocumentCancellation policyCancellation policy'
    );
    await expect(rowOf(panel.getByText('Category')).textContent).toBe(
      'CategoryCancellation policy'
    );

    /* No file and no freshly uploaded url: the whole ModalFooter is absent, so
       neither action exists rather than one being disabled. The uploader is
       still there, which is the only route from this state to a file. */
    await expect(panel.queryByRole('link', { name: 'Download document' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A template that gets signed in the app. Here the header meta and the Category row ' +
          'carry the same words for a different reason than in the uploaded case - the title ' +
          'and the category happen to match - which is exactly why both are asserted as whole ' +
          'rows rather than as loose text.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without document:edit:any',
  args: { canEditDocument: false },
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    // One flag removes three things at once.
    await expect(
      panel.queryByRole('button', { name: 'Edit Document info' })
    ).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Delete Document info' })
    ).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();

    // The read rows and the download survive: this is a summary, not a denial.
    await expect(rowOf(panel.getByText('Title')).textContent).toBe('TitleConsent to anaesthesia');
    await expect(panel.getByRole('link', { name: 'Download document' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The accordion header keeps its chevron and title row, so the panel does not visibly ' +
          'lose a control - the right-hand icon cluster is simply empty, which reads as a ' +
          'slightly different header rather than as a missing affordance.',
      },
    },
  },
};

export const EditingDetails: Story = {
  name: 'Accordion in edit mode',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Edit Document info' }));

    /* The read rows are REPLACED, not decorated. The LABELS are the wrong thing
       to assert on - `FormInput` renders its own `<label>` with the same text, so
       "Description" is still on screen in both modes. The row's VALUE is what
       moves: it stops being text and becomes an input value. */
    await waitFor(() =>
      expect(
        panel.queryByText('Signed by the pet parent before any procedure under GA.')
      ).not.toBeInTheDocument()
    );
    await expect(panel.getByLabelText('Title')).toHaveValue('Consent to anaesthesia');
    await expect(panel.getByLabelText('Description')).toHaveValue(
      'Signed by the pet parent before any procedure under GA.'
    );

    /* Editing swaps the icon cluster for the inline action pair. There is exactly
       ONE Save on screen: the footer's only grows a second one after a
       replacement file is uploaded, which is state Storybook cannot reach. */
    await expect(panel.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Document info' })
    ).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Delete Document info' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edit mode is local to the accordion, so the header, the uploader and the footer stay ' +
          'exactly as they were: the download stays live in the footer while the record above it ' +
          'is being rewritten. Upload a replacement file in this state and a second Save appears ' +
          'in that footer, wired to a different handler than the accordion pair - which is the ' +
          'collision this story exists to make visible.',
      },
    },
  },
};
