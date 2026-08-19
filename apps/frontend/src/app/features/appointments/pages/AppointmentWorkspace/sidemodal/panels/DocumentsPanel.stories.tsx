import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import DocumentsPanel from './DocumentsPanel';

const SIGN_GATE_REASON = 'Signing is available only while the appointment is In progress.';

const meta = {
  title: 'Workspace/DocumentsPanel',
  component: DocumentsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Documents tab of the quick-actions drawer: a Forms tab carrying the combined ' +
          "clinical packet plus the appointment's assigned forms, and a Records tab carrying " +
          "the companion's document library.\n\n" +
          'The surface these stories cover is the **clinical packet card and its gate**. The ' +
          "card is the workspace's only in-drawer route to Print All / Sign / Download Signed, " +
          'and every one of those actions is conditional: without an org **and** an encounter ' +
          'the card swaps its status badges for a one-line explanation and disables Print; and ' +
          'Sign is additionally gated on the appointment being In progress, which is expressed ' +
          'by wrapping the disabled button in a `GlassTooltip` that names the reason. That ' +
          'wrapper appears and disappears with the status - the button looks identical either ' +
          'way, so the only way to see which state you are in is to hover it.\n\n' +
          "The Records tab's own empty state is here too: with no companion on the appointment " +
          'the whole `CompanionDocumentsSection` is skipped rather than rendered empty.\n\n' +
          '**Not covered here: the loaded `FormRow` list and its auth badges.** ' +
          '`fetchAppointmentForms` POSTs on mount with no store in front of it, and the ' +
          'signed/pending badge state is computed from that response - `Authorized by Client`, ' +
          '`Authorized by Service Provider` and the red `Acknowledgement pending`, each with its ' +
          'own icon, plus the download/print pair that disables until a submission id exists. ' +
          "Same for the packet's Draft/Final and signing badges, which come from " +
          '`createEncounterDocumentPacket`. All of that needs a request-mocking layer this ' +
          'Storybook does not have, so it stays undrawn rather than being faked here.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: 'appt-workspace-1',
    appointmentStatus: 'CHECKED_IN',
  },
  decorators: [
    /* The drawer is 530px wide and the packet card's action row is `flex-wrap`,
       so the width is what decides whether Print All and Sign share a line. */
    (Story) => (
      <div className="w-[498px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FormsTab: Story = {
  name: 'Forms tab, no encounter context',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two tabs, Forms selected, and the tab is wired to its panel.
    const forms = canvas.getByRole('tab', { name: 'Forms' });
    const records = canvas.getByRole('tab', { name: 'Records' });
    await expect(forms).toHaveAttribute('aria-selected', 'true');
    await expect(records).toHaveAttribute('aria-selected', 'false');
    await expect(forms).toHaveAttribute('aria-controls', 'docs-panel-FORMS');
    await expect(canvasElement.querySelector('#docs-panel-FORMS')).not.toBeNull();

    /* The packet card, in its no-context form: title, subtitle, the explanation
       that replaces the status badges, and both actions disabled. */
    const packet = within(canvas.getByLabelText('Clinical packet'));
    await expect(packet.getByText('Clinical packet')).toBeInTheDocument();
    await expect(
      packet.getByText('Combined SOAP, prescription and discharge documents.')
    ).toBeInTheDocument();
    await expect(
      packet.getByText('Open this from an encounter to print or sign the combined packet.')
    ).toBeInTheDocument();
    await expect(packet.getByRole('button', { name: 'Print All' })).toBeDisabled();
    await expect(packet.getByRole('button', { name: 'Sign' })).toBeDisabled();
    // Download Signed only exists once the packet is signed, so not here.
    await expect(packet.queryByRole('button', { name: 'Download Signed' })).not.toBeInTheDocument();

    // The forms search sits under the card and is always present.
    await expect(
      canvas.getByRole('searchbox', { name: 'Search forms to add' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tab as it renders without an encounter - which is the state the drawer opens in ' +
          'for any appointment that has not started one. Note that the two status badges (Draft ' +
          'or Final, plus the signing state) are absent rather than empty: the card swaps them ' +
          'for a single explanatory line, so the card is two rows shorter here than it is with ' +
          'a live packet.',
      },
    },
  },
};

export const SignGateTooltip: Story = {
  name: 'Sign gate reason (tooltip)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sign = canvas.getByRole('button', { name: 'Sign' });

    // The button carries no visible reason - it is disabled and unlabelled.
    await expect(sign).toBeDisabled();
    // Here it IS wrapped, which is the difference the "gate lifted" story below
    // asserts the absence of.
    await expect(sign.closest('.glass-tooltip')).not.toBeNull();

    /* Opened through the shared helper rather than `userEvent.hover`: the
       tooltip binds `mouseenter` on its wrapper inside an effect, so a single
       dispatch sent before that effect flushes is lost for good and a
       `findByRole('tooltip')` would retry the query without re-sending it. */
    const bubble = await openGlassTooltip(sign);
    /* The whole reason, exactly - not a substring match on "Signing", which the
       button's own label would satisfy. The bubble is portalled to
       `document.body`, so it is outside `canvasElement` and a canvas-scoped
       query would never have found it. */
    await expect(bubble).toHaveAttribute('role', 'tooltip');
    await expect(bubble.textContent?.trim()).toBe(SIGN_GATE_REASON);
    await expect(canvasElement.contains(bubble)).toBe(false);

    /* Closed by identity: the helper waits for THIS bubble to leave the
       document, and asserting the same node is what distinguishes a real close
       from a second bubble appearing next to a stranded one. */
    await closeGlassTooltip(sign);
    await expect(document.contains(bubble)).toBe(false);
    await expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Why Sign is dead on a checked-in appointment. The reason exists only in a hover ' +
          'bubble portalled to `document.body`, so on a touch device - and for anyone reading ' +
          'the panel rather than pointing at it - the button is simply an unexplained disabled ' +
          "control. That is the thing to look at here, more than the bubble's styling.",
      },
    },
  },
};

export const SignGateLifted: Story = {
  name: 'Sign gate lifts while In progress',
  args: { appointmentStatus: 'IN_PROGRESS' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sign = canvas.getByRole('button', { name: 'Sign' });

    /* With the appointment in progress `signGateReason` is undefined, so the
       GlassTooltip wrapper is not rendered at all - the button is a bare
       Secondary. Asserting the wrapper's absence is the only observable
       difference; the button itself still reads "Sign" and is still disabled,
       because this story has no org or encounter either. */
    await expect(sign.closest('.glass-tooltip')).toBeNull();
    await expect(sign).toBeDisabled();
    await expect(sign).toHaveTextContent('Sign');

    /* The negative is only worth anything because the positive is asserted a
       story above, where the same button DOES resolve a `.glass-tooltip`
       ancestor - so this is a real difference in the tree, not a selector that
       never matches anything. */
    await expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);

    /* The reason is gone from the whole card, not just from a wrapper: the
       string exists nowhere in the packet section, while the card is otherwise
       identical to the gated story - same title, same no-context explanation,
       same disabled Print. Without these the story would pass against a card
       that had failed to render at all. */
    const packet = canvas.getByLabelText('Clinical packet');
    await expect(packet).not.toHaveTextContent(SIGN_GATE_REASON);
    await expect(within(packet).getByText('Clinical packet')).toBeInTheDocument();
    await expect(
      within(packet).getByText('Open this from an encounter to print or sign the combined packet.')
    ).toBeInTheDocument();
    await expect(within(packet).getByRole('button', { name: 'Print All' })).toBeDisabled();
    // Two actions on the row, still: Download Signed only joins once signed.
    await expect(within(packet).getAllByRole('button')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same card once the visit starts. Two different reasons can disable Sign - the ' +
          'status gate and the missing encounter - and only the status gate is ever explained. ' +
          'Here the explanation is gone while the button stays disabled, which is the worse of ' +
          'the two states to land on.',
      },
    },
  },
};

export const AddFormsDropdownEmpty: Story = {
  name: 'Add-forms dropdown with nothing to add',
  args: { organisationId: 'org-storybook' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The dropdown opens on focus, not only on typing, so the clinician can
       browse the org's assignable forms without a query. It needs an org id -
       without one `dropdownOpen` is false however much you type. */
    const search = canvas.getByRole('searchbox', { name: 'Search forms to add' });
    await userEvent.click(search);

    // It is portalled to document.body with fixed positioning, so it is outside
    // the canvas entirely.
    const copy = await within(document.body).findByText('No assignable forms available to add.');
    await expect(canvasElement.contains(copy)).toBe(false);

    /* The empty branch is one paragraph, not an empty list, and the panel around
       it is the real portalled dropdown: `position: fixed` and anchored to the
       search input's own width. Reading the width is what proves the anchoring
       ran - a portal that never measured its anchor renders at width 0 and is
       invisible while every text assertion above still passes. */
    const panel = copy.parentElement as HTMLElement;
    await expect(panel.querySelectorAll('ul')).toHaveLength(0);
    await expect(panel.children).toHaveLength(1);
    await expect(getComputedStyle(panel).position).toBe('fixed');
    const anchor = search.closest('div.relative') as HTMLElement;
    await waitFor(() => {
      const anchorWidth = anchor.getBoundingClientRect().width;
      expect(anchorWidth).toBeGreaterThan(0);
      expect(Math.abs(panel.getBoundingClientRect().width - anchorWidth)).toBeLessThanOrEqual(1);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The browse-on-focus dropdown when the org has no assignable form templates. Only ' +
          '`FORM` and `CONSENT` templates in `PUBLISHED` status are ever offered here - SOAP, ' +
          'vitals, prescription, discharge, tasks and inpatient-schedule templates are authored ' +
          'elsewhere in the workspace and are filtered out - so this empty panel is what an org ' +
          'with a full template library but no consent forms sees. The copy also changes once ' +
          'something has been typed, to "No forms available to add for this search."',
      },
    },
  },
};

export const RecordsTabEmpty: Story = {
  name: 'Records tab with no companion',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const records = canvas.getByRole('tab', { name: 'Records' });

    await userEvent.click(records);
    await expect(records).toHaveAttribute('aria-selected', 'true');

    // The Forms panel is unmounted, not hidden - the packet card goes with it.
    await waitFor(() => {
      expect(canvasElement.querySelector('#docs-panel-FORMS')).toBeNull();
    });
    await expect(canvas.queryByLabelText('Clinical packet')).not.toBeInTheDocument();

    const panel = canvasElement.querySelector('#docs-panel-RECORDS') as HTMLElement;
    await expect(panel).not.toBeNull();
    await expect(within(panel).getByText('No companion records available.')).toBeInTheDocument();

    /* The selected tab goes bold as well as blue and takes the 2px underline.
       Polled: `TabToggle` carries `transition-colors duration-150`, so a read in
       the same frame as the click can catch an interpolated value. */
    await waitFor(() => {
      expect(getComputedStyle(records).fontWeight).not.toBe(
        getComputedStyle(canvas.getByRole('tab', { name: 'Forms' })).fontWeight
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Records without a companion id. The tab does not render an empty document library - ' +
          "it renders a single line of copy instead, so none of the library's own filter chips " +
          'or sort control appear. Switching tabs also unmounts the Forms panel, which means the ' +
          'packet card re-resolves its state from the server every time the clinician comes back.',
      },
    },
  },
};

export const PhoneFormsTab: Story = {
  name: 'Phone: Forms tab',
  // The meta decorator is `w-[498px] max-w-full`, so it collapses to the phone
  // width here rather than forcing a horizontal scroll. No second wrapper needed.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both tabs still share the row at 375; TabToggle gives each `flex-1`.
    const forms = canvas.getByRole('tab', { name: 'Forms' });
    const records = canvas.getByRole('tab', { name: 'Records' });
    const drift = Math.abs(forms.getBoundingClientRect().top - records.getBoundingClientRect().top);
    await expect(drift).toBeLessThan(1);

    const packet = within(canvas.getByLabelText('Clinical packet'));
    await expect(packet.getByRole('button', { name: 'Print All' })).toBeDisabled();
    await expect(packet.getByRole('button', { name: 'Sign' })).toBeDisabled();
    await expect(
      packet.getByText('Open this from an encounter to print or sign the combined packet.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 the drawer is full-screen, so the packet card runs the full phone width. Its ' +
          'action row is `flex-wrap justify-end`, which is the detail to check here: Print All ' +
          'and Sign are the only two actions until a packet is signed, and a third button ' +
          '(Download Signed) joins them at that point - the width at which the row breaks onto ' +
          'two lines is not reachable in Storybook without the packet state.',
      },
    },
  },
};
