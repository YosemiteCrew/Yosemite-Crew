import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import AddDocument from './AddDocument';

const ORG_ID = 'org-storybook-add-document';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

/**
 * `primaryOrgId` is read with `useOrgStore.getState()` in the render body rather
 * than through a selector, so it has to be in place BEFORE the first render -
 * seeding it from the play function would be too late and the drawer would come
 * back as the `null` branch. `beforeEach` runs ahead of the render; the cleanup
 * puts the whole store back so neighbouring stories are unaffected.
 */
const withPrimaryOrg = (primaryOrgId: string | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    orgsById: primaryOrgId ? { [ORG_ID]: ORG } : {},
    orgIds: primaryOrgId ? [ORG_ID] : [],
    primaryOrgId,
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

/**
 * `ModalBase` portals to `document.body`, so nothing this panel renders is inside
 * `canvasElement`, and a closed drawer stays mounted without its `open`
 * attribute - which is why the panel is addressed through `dialog[open]` and why
 * `dialog` on its own is the query for "the component rendered nothing at all".
 */
const drawer = () => document.querySelector('dialog[open]') as HTMLElement;

/** The category menu portals out of the drawer's scrolling column, same as in AddRoom. */
const listbox = () => document.querySelector('[data-portal-dropdown]') as HTMLElement;

const AddDocumentHarness = () => {
  const [showModal, setShowModal] = useState(true);
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The documents list sits behind the drawer, so the backdrop tint is visible.
      </p>
      <button
        type="button"
        className="mt-3 rounded-full border border-[var(--hairline)] px-4 py-2 text-[13px]"
        onClick={() => setShowModal(true)}
      >
        Reopen the drawer
      </button>
      <AddDocument showModal={showModal} setShowModal={setShowModal} />
    </div>
  );
};

const meta = {
  title: 'Organization/AddDocument',
  component: AddDocumentHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Add document" drawer, opened from the Add button on the organisation Documents ' +
          'section. It had never been drawn, and three of the things it does are invisible from ' +
          'the call site.\n\n' +
          '**It can render nothing.** `primaryOrgId` is read off the org store and a missing one ' +
          'returns `null` before the Modal - so the caller flips `showModal` to true and no ' +
          'dialog appears, with no message and nothing to close. The value is read through ' +
          '`getState()` in the render body rather than a selector, so the panel only picks up an ' +
          'org switch when its parent re-renders.\n\n' +
          '**The two required fields report differently.** The title is a `FormInput`: red ' +
          'border, `aria-invalid`, and a `role="alert"` line wired to the input through ' +
          '`aria-describedby`. The file is a plain div AddDocument renders under the uploader - ' +
          'no alert role, and not associated with any control. The `error` handed to ' +
          '`DocUploader` is dropped there rather than forwarded to `PdfDocUploader`, so the ' +
          'upload zone itself never turns red either. Errors are also only recomputed when Save ' +
          'is pressed, so a fixed field keeps showing its message until the next press.\n\n' +
          '**Nothing resets on close.** Only a successful save clears the form, the errors and ' +
          'the picked file, so closing the drawer and reopening it shows the abandoned draft - ' +
          'stale error line included.\n\n' +
          'Two states are deliberately not storied. `fileUrl` is only ever set by a real signed ' +
          'upload to S3, so the valid form - and with it the `createDocument` POST, the success ' +
          'toast and the reset - cannot be reached without a request-mocking layer this ' +
          'Storybook does not have. That also means Save is safe to press in every story below: ' +
          'validation can never pass, so no story here touches the network.\n\n' +
          'Worth noting while reviewing: the drawer passes neither `aria-label` nor ' +
          '`aria-labelledby` to `Modal`, so the dialog has no accessible name even though a ' +
          '`<h2>` sits at the top of it, and that `<h2>` and the accordion under it both read ' +
          '"Add document".',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withPrimaryOrg(ORG_ID),
} satisfies Meta<typeof AddDocumentHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {
  name: 'Add document',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    /* 470px, because this drawer asks for `size="md"`. Every panel that names no
       size gets the 530px `lg` default, so a dropped prop would be a 60px width
       change that no text assertion notices. */
    await expect(Math.round(drawer().getBoundingClientRect().width)).toBe(470);

    await expect(panel.getByRole('heading', { level: 2, name: 'Add document' })).toBeVisible();
    // The single section is open from the first paint, so the drawer opens at
    // full height rather than as one collapsed row.
    await expect(panel.getByRole('button', { name: 'Add document' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await expect(panel.getByLabelText('Document title')).toHaveValue('');
    await expect(panel.getByLabelText('Description')).toHaveValue('');

    /* The type is NOT blank on open: `INITIAL_FORM_DATA` hard-codes
       CANCELLATION_POLICY, so the drawer arrives with a category nobody chose,
       resolved to its label rather than shown as the raw enum. */
    await expect(
      panel.getByRole('button', { name: 'Type: Cancellation policy' })
    ).toBeInTheDocument();

    /* Queried by ROLE: `PdfDocUploader` puts the same `aria-label` on the drop
       zone and on the hidden `<input type="file">` inside it, so a label query
       matches two nodes and throws. */
    const uploader = panel.getByRole('button', { name: 'Upload document' });
    await expect(uploader.textContent).toContain('Only PDF');
    await expect(uploader.textContent).toContain('max size 20 MB');

    // Nothing is reported before Save is pressed.
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);
    // `href="#"` on the Primary is inert - BaseButton only takes the Link branch
    // for a real href - so this is a real button, not an anchor.
    await expect(panel.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // The title field and the type trigger stack directly on top of each other,
    // so a height drift between the two primitives shows as a ragged column.
    const titleHeight = panel.getByLabelText('Document title').getBoundingClientRect().height;
    const typeHeight = panel
      .getByRole('button', { name: 'Type: Cancellation policy' })
      .getBoundingClientRect().height;
    await expect(typeHeight).toBe(titleHeight);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens: header, one always-open section holding title, type, ' +
          'description and the PDF drop zone, and a single full-width Save. Only two of the four ' +
          'fields are required and neither of them is the one that is prefilled.',
      },
    },
  },
};

export const RequiredFieldErrors: Story = {
  name: 'Save pressed with nothing filled in',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);

    await userEvent.click(panel.getByRole('button', { name: 'Save' }));

    expect(await panel.findByText('Name is required')).toBeInTheDocument();
    await expect(panel.getByText('File is required')).toBeInTheDocument();

    const title = panel.getByLabelText('Document title');
    await expect(title).toHaveAttribute('aria-invalid', 'true');

    /* The two messages are not equivalent to assistive tech, which is the part a
       screenshot cannot show. The title's is a `role="alert"` line wired to the
       input; the file's is a plain div AddDocument renders itself, next to an
       uploader that never receives the `error` it is passed. So exactly one
       alert exists, and the upload control describes nothing. */
    await expect(panel.queryAllByRole('alert')).toHaveLength(1);
    const describedBy = title.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(document.getElementById(describedBy as string)?.textContent).toBe(
      'Name is required'
    );
    await expect(panel.getByRole('button', { name: 'Upload document' })).not.toHaveAttribute(
      'aria-describedby'
    );

    // Validation returns before `createDocument`, so a refused Save leaves the
    // drawer open over the draft rather than closing or firing a request.
    await expect(drawer()).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both required fields refusing at once, and the one state that puts the two error ' +
          'treatments side by side. The type and the description are optional, so neither is ' +
          'marked - the type in particular is already "answered" by a default the user never ' +
          'picked.',
      },
    },
  },
};

export const ErrorsOnlyRecomputeOnSave: Story = {
  name: 'Fixing the title leaves its error on screen',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    expect(await panel.findByText('Name is required')).toBeInTheDocument();

    await userEvent.type(panel.getByLabelText('Document title'), 'Fire evacuation plan');

    /* Typing does not clear it. `onChange` only writes `formData`; the error map
       is untouched until the next Save, so the field is red and "Name is
       required" sits under a filled, valid input. */
    await expect(panel.getByText('Name is required')).toBeInTheDocument();
    await expect(panel.getByLabelText('Document title')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(panel.getByRole('button', { name: 'Save' }));

    // `handleSave` REPLACES the error object rather than merging into it, so the
    // cleared field must lose its message rather than keep it from the last press.
    await waitFor(() => expect(panel.queryByText('Name is required')).not.toBeInTheDocument());
    await expect(panel.getByLabelText('Document title')).toHaveAttribute('aria-invalid', 'false');

    /* What is left is the file error alone - and with the title's alert gone,
       the drawer is now refusing to save while announcing nothing at all. */
    await expect(panel.getByText('File is required')).toBeInTheDocument();
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The half-fixed form. It is also the only way to see the file error on its own: the ' +
          'file cannot be supplied in Storybook, so this is the closest state to a form the user ' +
          'believes is complete.',
      },
    },
  },
};

export const FilledIn: Story = {
  name: 'Title, category and description filled',
  play: async () => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    const panel = within(drawer());

    await userEvent.type(panel.getByLabelText('Document title'), 'Fire evacuation plan');

    await userEvent.click(panel.getByRole('button', { name: 'Type: Cancellation policy' }));
    await waitFor(() => expect(listbox()).not.toBeNull());
    // All five `OrgDocumentCategoryOptions`, by label rather than raw enum.
    await expect(within(listbox()).getAllByRole('button')).toHaveLength(5);
    await userEvent.click(within(listbox()).getByRole('button', { name: 'Fire safety' }));

    /* The choice lands in the trigger's accessible name, so it is announced
       rather than only being a swapped label inside a closed control. The
       category also decides the endpoint - FIRE_SAFETY and GENERAL post to
       `/documents`, everything else to `/documents/policy` - so this is a
       routing choice, not just a badge. */
    await waitFor(() =>
      expect(panel.getByRole('button', { name: 'Type: Fire safety' })).toBeInTheDocument()
    );

    await userEvent.type(panel.getByLabelText('Description'), 'Posted at both exits.');
    await expect(panel.getByLabelText('Description')).toHaveValue('Posted at both exits.');

    // Left unpressed on purpose: this is the resting "looks complete" snapshot,
    // and pressing Save here would paint the file error over it.
    await expect(panel.queryAllByRole('alert')).toHaveLength(0);
    await expect(panel.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything a user can supply without a file. The description is a `min-h-[120px]` ' +
          'textarea here rather than the 72px default, so this is the story that shows the ' +
          'section at its natural height.',
      },
    },
  },
};

export const ClosingKeepsTheDraft: Story = {
  name: 'Closing and reopening keeps the draft',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(drawer()).not.toBeNull());
    await userEvent.type(within(drawer()).getByLabelText('Document title'), 'Boarding terms');
    await userEvent.click(within(drawer()).getByRole('button', { name: 'Save' }));
    expect(await within(drawer()).findByText('File is required')).toBeInTheDocument();

    await userEvent.click(within(drawer()).getByRole('button', { name: 'Close' }));

    /* The dialog stays MOUNTED without its `open` attribute, so absence has to be
       asserted against `dialog[open]` - querying for the element itself finds it
       either way and would pass whatever happened. */
    await waitFor(() => expect(drawer()).toBeNull());

    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reopen the drawer' }));
    await waitFor(() => expect(drawer()).not.toBeNull());

    /* Nothing is reset on the way out - only a successful save clears the form,
       the errors and the picked file - so the abandoned draft comes back with
       its stale error still under the uploader. There is no dirty check and no
       discard confirm either, unlike the Rooms drawer next door. */
    await expect(within(drawer()).getByLabelText('Document title')).toHaveValue('Boarding terms');
    await expect(within(drawer()).getByText('File is required')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The X, Escape and a backdrop click all take this same route: `setShowModal(false)` ' +
          'and nothing else. Kept as a story because the component is mounted permanently by the ' +
          'Documents section, so its state outlives every close.',
      },
    },
  },
};

export const NoPrimaryOrg: Story = {
  name: 'No primary organisation',
  beforeEach: withPrimaryOrg(null),
  play: async ({ canvasElement }) => {
    /* The guard is a bare `return null` above the Modal, so there is no dialog at
       all - not a closed one. `dialog[open]` alone would pass here for the wrong
       reason, which is why this asserts against `dialog`. */
    await expect(document.querySelector('dialog')).toBeNull();

    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reopen the drawer' }));

    // Opening it again changes nothing: the caller's `showModal` is true and the
    // user is looking at an unchanged page with no drawer and no explanation.
    await expect(document.querySelector('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a member with no primary organisation sees after pressing Add: the section they ' +
          'were on, unchanged. The Documents section around it renders normally, so nothing ' +
          'upstream signals that the action is unavailable.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 768px `Modal` swaps the 470px right-side drawer for the full-screen phone panel ' +
          '(`yc-modal-fullscreen`: inset 0, no radius, no border, `--screen` background), so the ' +
          'form runs edge to edge and the footer Save spans the width.\n\n' +
          'Deliberately without a play function. `useIsPhone` reads `matchMedia` against the ' +
          'preview iframe, and the viewport global is applied by the Storybook manager when it ' +
          'sizes that iframe - a headless run that loads `iframe.html` directly gets the ' +
          'harness viewport instead and renders the desktop drawer. Any phone-only assertion ' +
          'here would therefore be measuring the 1280px branch and passing for the wrong reason.',
      },
    },
  },
};
