import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import type { OrgIntegration } from '@/app/features/integrations/services/types';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import AddForm from './index';

const ORG_ID = 'org-avenger-park';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const SERVICE_OPTIONS = [
  { label: 'Dental consultation', value: 'svc-dental', badge: 'Service' },
  { label: 'Senior wellness package', value: 'svc-senior', badge: 'Package' },
];

const SCHEMA: FormField[] = [
  {
    id: 'presenting_complaint',
    type: 'input',
    label: 'Presenting complaint',
    placeholder: 'Limping on the left hind',
  },
  {
    id: 'observed_signs',
    type: 'checkbox',
    label: 'Observed signs',
    multiple: true,
    options: [
      { label: 'Lameness', value: 'lameness' },
      { label: 'Swelling', value: 'swelling' },
    ],
  },
  { id: 'owner_signature', type: 'signature', label: 'Owner signature' },
];

const TEMPLATE: FormsProps = {
  _id: 'form-2291',
  name: 'Anaesthesia consent',
  description: 'Signed before any procedure requiring general anaesthetic.',
  category: 'Consent form',
  usage: 'Internal & External',
  requiredSigner: 'CLIENT',
  services: ['svc-dental'],
  species: ['Canine'],
  updatedBy: 'Dr. Elena Marsh',
  lastUpdated: '2026-06-02T10:15:00.000Z',
  status: 'Draft',
  templateSource: 'ORG_TEMPLATE',
  isTemplateBacked: false,
  schema: SCHEMA,
};

const merck = (status: OrgIntegration['status']): OrgIntegration => ({
  id: 'int-merck',
  organisationId: ORG_ID,
  provider: 'MERCK_MANUALS',
  status,
});

/**
 * Seeds the org and the MSD integration. `merckEnabled` comes from
 * `useResolvedMerckIntegrationForPrimaryOrg`, whose gateway just resolves the
 * provider out of the integrations the store already holds - so seeding the
 * store is the whole setup, with no service stubbed and no network reached.
 */
const seed = (status: OrgIntegration['status'] = 'enabled') => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useIntegrationStore.setState({
    integrationsById: { 'int-merck': merck(status) },
    integrationIdsByOrgId: { [ORG_ID]: ['int-merck'] },
    status: 'loaded',
    error: null,
    lastFetchedAt: '2026-08-18T06:05:00.000Z',
  });
};

const BuilderHarness = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[720px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">Forms list behind the builder drawer.</p>
      <AddForm
        showModal={open}
        setShowModal={setOpen}
        initialForm={TEMPLATE}
        serviceOptions={SERVICE_OPTIONS}
      />
    </div>
  );
};

const panel = () => document.querySelector('dialog[open]') as HTMLElement;

const meta = {
  title: 'Forms/AddForm builder',
  component: BuilderHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The template builder drawer and its **view switcher**, which is the part that had ' +
          'never been drawn. `Build` has its own story; the two panes that replace it do not.\n\n' +
          '"Preview as parent" does not open anything - it swaps the entire body for `Review` and ' +
          'takes the modal chrome with it. The header\'s "Save template" pill is removed (Review ' +
          'supplies its own Publish/Save-as-draft pair) and the `ModalFooter` is not rendered at ' +
          'all, so the drawer temporarily has **no footer**. That is a whole different panel ' +
          'skeleton reached by one toggle, and a snapshot of the builder proves nothing about ' +
          'it.\n\n' +
          'The MSD pane is the same trick with an extra gate: the button only exists when the ' +
          'org has the MSD integration enabled, and the view is coerced back to `build` during ' +
          'render if that ever stops being true (`effectiveView`), so a stale `merck` view can ' +
          'never render an empty pane. Both cases are drawn below.\n\n' +
          'Neither toggle is idempotent-looking: `TOGGLE_VIEW` returns to `build` when the ' +
          'active pane is re-selected, which is why the buttons carry `aria-pressed` and why the ' +
          'preview button relabels itself to "Back to builder".\n\n' +
          'Everything mounts from seeded zustand state. The only service calls in this file are ' +
          'in the save and publish handlers, and no story clicks them.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seed();
  },
} satisfies Meta<typeof BuilderHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Builder: Story = {
  name: 'Builder (default view)',
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(panel()).not.toBeNull());
    const drawer = within(panel());

    // Header: title carries the template name, and the meta line is the derived
    // "<category> · <n> fields · linked to <n> services" summary.
    await expect(drawer.getByText('Edit template · Anaesthesia consent')).toBeInTheDocument();
    await expect(
      drawer.getByText('Consent form · 3 fields · linked to 1 service')
    ).toBeInTheDocument();

    // Three header actions plus the footer's draft action, all four at once.
    const preview = drawer.getByRole('button', { name: 'Preview as parent' });
    await expect(preview).toHaveAttribute('aria-pressed', 'false');
    expect(
      await drawer.findByRole('button', { name: 'MSD Veterinary Manual' })
    ).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Update & publish' })).toBeInTheDocument();

    /* The draft action lives in the `ModalFooter` here - a `border-t` row that is
       a sibling of the body. Review renders a button with the SAME label inside
       its own `grid-cols-2` action pair, so "is there an Update draft button" is
       true in both views and only its container tells them apart. */
    const draft = drawer.getByRole('button', { name: 'Update draft' });
    await expect(draft.parentElement?.className).toContain('border-t');
    await expect(draft.closest('div[class*="grid-cols-2"]')).toBeNull();

    // The builder body: the details fold (collapsed) over the palette/canvas.
    await expect(drawer.getByRole('button', { name: 'Edit details' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(drawer.getByText('Add a field')).toBeInTheDocument();
    // Nothing from the preview pane is mounted.
    await expect(body.queryByRole('button', { name: 'Publish template' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting builder. The title reads "Edit template" rather than "Add template" ' +
          'because `initialForm._id` is set, and the same flag turns the two save actions into ' +
          '"Update & publish" / "Update draft" - a four-label swap driven by one boolean.',
      },
    },
  },
};

export const PreviewAsParent: Story = {
  name: 'Preview as parent (Review pane)',
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(panel()).not.toBeNull());
    const drawer = () => within(panel());

    await userEvent.click(drawer().getByRole('button', { name: 'Preview as parent' }));

    /* Waited on a string only Review renders. The builder's own details step says
       "Usage and visibility"; Review says "Usage & visibility". Waiting on
       "Update & publish" instead would resolve instantly against the header pill
       that was already there, and the story would pass without ever switching. */
    expect(await drawer().findByText('Usage & visibility')).toBeInTheDocument();

    // The body is REPLACED, not stacked - the builder has to be gone.
    await expect(drawer().queryByText('Add a field')).not.toBeInTheDocument();
    await expect(drawer().queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();

    // Review's read-only summary, over the same schema.
    await expect(drawer().getByText('Form details')).toBeInTheDocument();
    await expect(drawer().getByText('Presenting complaint')).toBeInTheDocument();

    /* The chrome changes too, which is the easiest part to miss. The header's
       save pill is gone and the `ModalFooter` is not rendered at all, so the one
       remaining "Update draft" now sits in Review's own `grid-cols-2` pair
       rather than in a `border-t` footer row. The label is identical in both
       views, so the container is the only thing that proves the swap. */
    const draft = drawer().getByRole('button', { name: 'Update draft' });
    const actions = draft.closest('div[class*="grid-cols-2"]') as HTMLElement;
    await expect(actions).not.toBeNull();
    await expect(draft.parentElement?.className ?? '').not.toContain('border-t');

    /* Two equal tracks holding exactly two buttons. Matching the class string
       alone would still pass if a third action had been dropped into the pair, or
       if the tracks had collapsed to one at this width - and it is the pairing
       that makes Review's actions read as a decision rather than as a footer. */
    const tracks = getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(tracks[0]).toBe(tracks[1]);
    await expect(actions.children).toHaveLength(2);
    await expect([...actions.children].map((node) => node.textContent?.trim())).toEqual([
      'Update & publish',
      'Update draft',
    ]);

    /* Exactly one "Update & publish" anywhere in the document: the header pill is
       unmounted in this view and Review supplies its own, so a count of two would
       mean the header failed to strip itself. */
    await expect(body.getAllByRole('button', { name: 'Update & publish' })).toHaveLength(1);

    // The toggle relabels itself and reports its pressed state.
    const back = drawer().getByRole('button', { name: 'Back to builder' });
    await expect(back).toHaveAttribute('aria-pressed', 'true');

    // Re-selecting the active pane returns to the builder rather than doing nothing.
    await userEvent.click(back);
    await waitFor(() => expect(drawer().queryByText('Add a field')).toBeInTheDocument());
    await expect(drawer().getByRole('button', { name: 'Preview as parent' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a pet parent would be handed. `Review` renders the two detail accordions read-only ' +
          'and then the real `FormRenderer` over the same schema, so the fields below the fold are ' +
          'the actual controls rather than a mock-up of them.',
      },
    },
  },
};

export const MsdPane: Story = {
  name: 'MSD Veterinary Manual pane',
  play: async () => {
    await waitFor(() => expect(panel()).not.toBeNull());
    const drawer = () => within(panel());

    const msd = await drawer().findByRole('button', { name: 'MSD Veterinary Manual' });
    await userEvent.click(msd);

    // `AppointmentMerckSearch` replaces the builder body.
    expect(await drawer().findByText('MSD Manual')).toBeInTheDocument();
    await expect(drawer().getByText('In-visit lookup')).toBeInTheDocument();
    await expect(drawer().getByRole('textbox', { name: 'Search manuals' })).toBeInTheDocument();
    await expect(drawer().queryByText('Add a field')).not.toBeInTheDocument();

    /* Unlike preview, this pane keeps the full modal chrome - the save pill and
       the footer are both still there, because only `preview` strips them. Two
       panes, two different skeletons, one switcher. */
    await expect(drawer().getByRole('button', { name: 'Update & publish' })).toBeInTheDocument();
    await expect(drawer().getByRole('button', { name: 'Update draft' })).toBeInTheDocument();
    await expect(msd).toHaveAttribute('aria-pressed', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The in-builder manual lookup, so a clinician can check a dose or a differential without ' +
          'losing a half-built template. It mounts the same `AppointmentMerckSearch` the ' +
          'appointment workspace uses, with `activeAppointment` null.',
      },
    },
  },
};

export const MsdHiddenWhenDisabled: Story = {
  name: 'MSD button hidden when the integration is off',
  beforeEach: () => {
    seed('disabled');
  },
  play: async () => {
    await waitFor(() => expect(panel()).not.toBeNull());
    const drawer = within(panel());

    /* The button is not disabled, it is absent - and the two actions beside it
       have to still be there, or "the button is gone" would also be true of a
       drawer that failed to render its header at all. `MsdPane` above is the
       positive control: the same query finds the button once the integration
       resolves as enabled, so this pair is what proves the gate rather than a
       missing render. */
    await expect(drawer.getByRole('button', { name: 'Preview as parent' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Update & publish' })).toBeInTheDocument();
    await expect(
      drawer.queryByRole('button', { name: 'MSD Veterinary Manual' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'With MSD off, the third header action never mounts. The reducer can still hold a stale ' +
          '`merck` view from an earlier session, which is why `effectiveView` coerces it back to ' +
          '`build` while rendering rather than in an effect - the pane is never shown empty.',
      },
    },
  },
};

export const DetailsFoldOpen: Story = {
  name: 'Template details fold (open)',
  play: async () => {
    await waitFor(() => expect(panel()).not.toBeNull());
    const drawer = within(panel());

    const toggle = drawer.getByRole('button', { name: 'Edit details' });
    await userEvent.click(toggle);

    /* The fold is ALWAYS mounted - it is toggled with a `hidden` class, not by
       unmounting - because publish validates through its imperative handle even
       while it is shut. So the assertion has to be about visibility, and about
       the label flipping, not about the fields appearing in the DOM. */
    const relabelled = await drawer.findByRole('button', { name: 'Hide details' });
    await expect(relabelled).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('textbox', { name: 'Form name' })).toBeVisible();
    await expect(drawer.getByRole('textbox', { name: 'Form name' })).toHaveValue(
      'Anaesthesia consent'
    );
    // `hideNext` is set here, so the step's own Next button stays out of the
    // builder - saving happens from the header pill instead.
    await expect(drawer.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The details step folded into the single-screen builder. It is capped at `max-h-[40%]` ' +
          'and scrolls, so opening it never pushes the palette off the drawer.',
      },
    },
  },
};
