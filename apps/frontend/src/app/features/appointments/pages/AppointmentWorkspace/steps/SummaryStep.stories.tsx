import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import SummaryStep from './SummaryStep';

const APPOINTMENT_ID = 'appt-workspace-1';

const SIGN_BLOCKED_REASON = 'Signing is available only while the appointment is In progress.';
const NO_TEMPLATE_MATCHES = 'No discharge templates match this search.';

/**
 * Every network call this step makes is gated on `appointment.organisationId`:
 * the discharge-template list, the bootstrap encounter-id lookup, the documents
 * read-model and the context template resolver all return at their first line
 * without one. An unresolved org id is therefore the whole offline seam - no
 * service module is stubbed anywhere in this file, and the component under
 * review is the real one.
 *
 * It also puts `handleSign` on its missing-context branch, which is the same
 * branch a real visit takes when it has no encounter yet (not checked in).
 */
const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: APPOINTMENT_ID,
  organisationId: '',
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'prac-amara', name: 'Dr. Amara Weber' },
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'CHECKED_IN',
  ...over,
});

const encounter = (over: Partial<AppointmentEncounter> = {}): AppointmentEncounter => ({
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  leadId: 'prac-amara',
  leadName: 'Dr. Amara Weber',
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '<p>Rest for 48 hours. Soft food only. Recheck the incision daily.</p>',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'COMPLETED',
    DIAGNOSTICS: 'COMPLETED',
    TREATMENT: 'COMPLETED',
    PASSPORT: 'EMPTY',
    INVOICE: 'COMPLETED',
    SUMMARY: 'IN_PROGRESS',
  },
  viewOnly: false,
  ...over,
});

/** A saved summary is what puts Print All / Sign on screen at all. */
const SAVED = encounter({
  dischargeSavedAt: '2026-03-12T11:20:00.000Z',
  dischargeSavedByName: 'Dr. Amara Weber',
});

const signButton = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('button', { name: 'Sign' });

const meta = {
  title: 'Workspace/SummaryStep',
  component: SummaryStep,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The discharge step. Three of its surfaces are unreachable from a plain render, and ' +
          'none of them had ever been drawn.\n\n' +
          '**The discharge-template dropdown** is a `SearchResultsDropdown` portalled to ' +
          '`document.body` at `position: fixed, zIndex 1000`, sized from the search input rect. It ' +
          'mounts only while the query is non-empty, so nothing renders it at rest - and its ' +
          '"no matches" branch is a plain paragraph, not a row, which is exactly the kind of ' +
          'inner content a story asserting "the panel opened" would miss.\n\n' +
          '**The Sign tooltip** wraps the button only while the appointment is not In progress. ' +
          'It is not a disabled tooltip that happens to be closed: the two branches render ' +
          'different trees, one with a `.glass-tooltip` wrapper and one without, so the wrapped ' +
          'form only exists on a checked-in or completed visit.\n\n' +
          '**The `signError` alert** sits above the action row and pushes it down. It is set ' +
          'from `handleSign`, so it can only appear after a failed attempt.\n\n' +
          'The stories mount the real step with an unresolved `organisationId`, which is the one ' +
          'condition under which every service call in this file returns at its first line. That ' +
          'is deliberate: this repo has no MSW wiring, and the alternative would be stubbing four ' +
          'modules to draw three pieces of markup.\n\n' +
          'What is NOT drawn here, for the same reason: the **populated** template list and the ' +
          '"Unable to load discharge templates." error line. Both need ' +
          '`listDischargeSummaryTemplates` to resolve or reject, and neither is reachable without ' +
          'a request stub.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    appointment: appointment(),
    encounter: encounter(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    // The signing overlay is a global store and portals over the whole viewport;
    // reset it so a story that ran earlier in the tab cannot cover this one.
    useSigningOverlayStore.getState().close();
    useAppointmentWorkspaceStore.setState({ saveStatusByAppointmentId: {} });
  },
} satisfies Meta<typeof SummaryStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TemplateSearchNoMatches: Story = {
  name: 'Template dropdown (no matches)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('searchbox', { name: 'Search discharge templates' });
    // The dropdown is derived from the query, not from a prop, so it cannot exist yet.
    await expect(within(document.body).queryByText(NO_TEMPLATE_MATCHES)).not.toBeInTheDocument();

    await userEvent.type(search, 'ortho');

    const emptyLine = await within(document.body).findByText(NO_TEMPLATE_MATCHES);
    // Portalled to body: the panel is NOT a descendant of the step.
    await expect(canvas.queryByText(NO_TEMPLATE_MATCHES)).not.toBeInTheDocument();

    const panel = emptyLine.parentElement as HTMLElement;
    const panelStyle = getComputedStyle(panel);
    await expect(panelStyle.position).toBe('fixed');
    await expect(panelStyle.zIndex).toBe('1000');

    /* The panel is sized from the anchor's rect every time the window moves, so a
       broken anchor shows up as a width mismatch rather than as a missing panel.
       getBoundingClientRect, not getComputedStyle: the panel is bordered, and the
       content box reads 2px narrower than the width it was actually given. */
    const anchor = search.closest('div.relative') as HTMLElement;
    await expect(panel.getBoundingClientRect().width).toBeCloseTo(
      anchor.getBoundingClientRect().width,
      1
    );

    // Empty means empty: no result row survived the filter, and nothing else did either.
    await expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    await expect(within(panel).queryAllByRole('listitem')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query that matches nothing. The panel still opens - it is gated on the query being ' +
          'non-empty, not on there being results - and shows one muted sentence at `px-4 py-3`. ' +
          'Worth drawing because the empty branch is what a clinician sees while typing any name ' +
          'the practice has not yet templated, and because its geometry (fixed, body-portalled, ' +
          'anchored to the input width) is invisible in the source.',
      },
    },
  },
};

export const SignBlockedTooltip: Story = {
  name: 'Sign blocked (tooltip open)',
  args: { encounter: SAVED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Saved swaps the whole editor out for the read-only render plus the stamp, and
       that swap is what reveals the action row. Assert the render, not just the row -
       an empty saved view would still show the buttons. */
    await expect(canvas.getByText(/Rest for 48 hours\./)).toBeInTheDocument();
    await expect(canvas.getByText('Saved by Dr. Amara Weber')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Edit discharge summary' })
    ).toBeInTheDocument();
    // Save is replaced by Print All + Sign once saved; it is not merely disabled.
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Print All' })).toBeInTheDocument();

    const sign = signButton(canvasElement);
    await expect(sign).toBeDisabled();
    await expect(sign.closest('.glass-tooltip')).not.toBeNull();

    const bubble = await openGlassTooltip(sign);
    await expect(bubble).toHaveTextContent(SIGN_BLOCKED_REASON);
    await expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);

    /* Closed explicitly. The pencil above is a CircleIconButton, which is also a
       GlassTooltip - leaving this bubble open would leave two candidates on
       document.body for any later query in the same tab. */
    await closeGlassTooltip(sign);
    await expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A checked-in visit with the summary already saved. Signing is refused until the ' +
          'appointment is actually In progress, and the only place that rule is stated is this ' +
          'bubble - the button itself just reads "Sign" at 60% opacity.',
      },
    },
  },
};

export const SignAllowed: Story = {
  name: 'Sign allowed (no wrapper)',
  args: { appointment: appointment({ status: 'IN_PROGRESS' }), encounter: SAVED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sign = signButton(canvasElement);
    await expect(sign).toBeEnabled();
    /* The wrapper is gone, not just quiet. `queryByRole('tooltip')` would pass either
       way, since a closed GlassTooltip renders no bubble in both branches. */
    await expect(sign.closest('.glass-tooltip')).toBeNull();

    /* The rest of the row is byte-identical to the blocked story, which is the
       point: the only difference between the two branches is the wrapper and the
       disabled attribute, so everything else has to be asserted here or the
       comparison proves nothing. */
    await expect(sign).toHaveTextContent('Sign');
    await expect(canvas.getByRole('button', { name: 'Print All' })).toBeEnabled();
    // Not yet signed, so the Sign→Download Signed swap has not happened.
    await expect(canvas.queryByRole('button', { name: 'Download Signed' })).not.toBeInTheDocument();
    /* Sign sits to the RIGHT of Print All on the same line - the row is
       `justify-end flex-wrap`, so at laptop width neither wraps. Overlap rather
       than an exact top: `items-center` centres them, so two buttons of unequal
       height would share a line without sharing a top edge. */
    const print = canvas.getByRole('button', { name: 'Print All' });
    const signRect = sign.getBoundingClientRect();
    const printRect = print.getBoundingClientRect();
    await expect(signRect.top).toBeLessThan(printRect.bottom);
    await expect(printRect.top).toBeLessThan(signRect.bottom);
    await expect(signRect.left).toBeGreaterThan(printRect.left);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same row on an in-progress visit, for the side-by-side. `signDisabledReason` is ' +
          'undefined here, so the step renders the second of its two Sign branches and the button ' +
          'sits directly in the flex row with no wrapping span.',
      },
    },
  },
};

export const SignErrorAlert: Story = {
  name: 'Sign failure (role=alert)',
  args: { appointment: appointment({ status: 'IN_PROGRESS' }), encounter: SAVED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(signButton(canvasElement));

    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Missing organisation or encounter for signing.');
    // Inline `text-body-4 text-text-error`, not a banner: it is a bare <p> in the
    // right-aligned column above the buttons, so it pushes the action row down.
    await expect(alert.tagName).toBe('P');

    /* The guard returns before `setIsSigning(true)`, so the label never flips to
       "Signing…" and the button stays clickable for a retry. */
    await waitFor(() => {
      expect(signButton(canvasElement)).toBeEnabled();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure path of `handleSign` when the encounter context is missing - the state a ' +
          'visit is in before it has been checked in and given an encounter. It is the only error ' +
          'surface on this step that is announced (`role="alert"`), and until now nothing had ' +
          'rendered it.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: actions stack',
  args: { encounter: SAVED },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders at full panel width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* At 375px the two-pane `lg:flex-row` collapses, so All Documents drops under
       the summary instead of sitting in the 400px aside. Both panes are still
       present - the layout changes, the content does not. */
    await expect(canvas.getByText('Discharge Summary')).toBeInTheDocument();
    await expect(canvas.getByText('All Documents')).toBeInTheDocument();
    await expect(canvas.getByText('No documents recorded yet.')).toBeInTheDocument();

    /* Stacked, not side by side. On a wide viewport these two headings sit at
       roughly the same y; here the documents pane must start below the summary
       pane entirely, which is the only observable difference between the
       `lg:flex-row` and the collapsed layout. */
    const summaryTitle = canvas.getByText('Discharge Summary');
    const documentsTitle = canvas.getByText('All Documents');
    await expect(documentsTitle.getBoundingClientRect().top).toBeGreaterThan(
      summaryTitle.getBoundingClientRect().bottom
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The saved step at phone width. The action row is `flex-wrap`, so Print All and Sign ' +
          'wrap rather than shrink, and the documents aside stops being an aside.',
      },
    },
  },
};
