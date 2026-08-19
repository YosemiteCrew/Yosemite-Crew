import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';

import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import type { Appointment, Organisation } from '@yosemite-crew/types';

import AppointmentCard from './index';
import type { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';

const ORG_ID = 'org-storybook';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

const SOAP_INTENT: AppointmentViewIntent = { label: 'prescription', subLabel: 'subjective' };

const BASE_APPOINTMENT: Appointment = {
  id: 'appt-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Maya Whitfield' },
  },
  lead: { id: 'vet-1', name: 'Dr. Elena Marsh' },
  supportStaff: [{ id: 'nurse-1', name: 'Tom Reyes' }],
  room: { id: 'room-1', name: 'Consult 2' },
  appointmentType: {
    id: 'type-1',
    name: 'Wellness exam',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Annual check-up and vaccination review',
};

const meta = {
  title: 'Cards/AppointmentCard',
  component: AppointmentCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The appointment tile used by the appointments list: companion header, the detail rows, the ' +
          'inpatient/outpatient pill and the status pill, closed by a row of circular actions. Which ' +
          'actions appear depends on the status and on `canEditAppointments` — a requested booking ' +
          'shows only accept/decline, a locked-down role only shows the read actions. The clinical ' +
          'notes action is labelled from the organisation type ("Medical Records" for a hospital, ' +
          '"Care" elsewhere), which the stories seed into the org store.\n\n' +
          '**Every action on that rail is wrapped in a `GlassTooltip`, and none of those bubbles had ' +
          'ever been drawn.** There are nine in the source - seven on the normal rail (view, change ' +
          'status, reschedule, assign room, clinical notes, finance, labs) and two on the requested ' +
          'rail (accept, decline) - and each one is portalled to `document.body` only while its ' +
          'trigger is hovered or focused. No prop opens them: `GlassTooltip` attaches `mouseenter` ' +
          'and `focusin` listeners imperatively in a `useEffect`, so rendering the card exercises ' +
          'none of the bubble, none of `updatePosition`, and none of the viewport clamp.\n\n' +
          'That matters here more than on a lone tooltip. The rail is a `flex-wrap` row inside a card ' +
          'that is itself `sm:w-[calc(50%-12px)]`, the bubbles are `side="bottom"`, and ' +
          '`updatePosition` measures the trigger AND the bubble before clamping to the viewport with ' +
          '8px of padding - so the last icon in a wrapped row is exactly where a bubble gets pushed ' +
          'back over its own neighbours. The stories below open them and assert the bubble carries ' +
          'its label, since an empty bubble would satisfy "a tooltip appeared".\n\n' +
          'The clinical-notes bubble is the one with a real failure mode: its text is not a constant ' +
          'but `getClinicalNotesLabel(orgType)` read from the org store, so a card whose organisation ' +
          'has not resolved falls back to `HOSPITAL` and says "Medical Records" to a groomer.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: BASE_APPOINTMENT,
    canEditAppointments: true,
    handleViewAppointment: fn(),
    handleWorkspaceAppointment: fn(),
    handleRescheduleAppointment: fn(),
    handleChangeStatusAppointment: fn(),
    handleChangeRoomAppointment: fn(),
    getSoapViewIntent: () => SOAP_INTENT,
  },
  argTypes: {
    canEditAppointments: { control: 'boolean' },
  },
  decorators: [
    (StoryFn) => (
      <div className="flex flex-wrap gap-6" style={{ maxWidth: 720 }}>
        <StoryFn />
      </div>
    ),
  ],
  beforeEach: () => {
    // The card resolves its clinical-notes label from the org store. Only
    // `orgsById` is seeded: setting `primaryOrgId` would make the card's
    // content hook start loading the team over the network.
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({ orgsById: { [ORG_ID]: ORG }, orgIds: [ORG_ID], primaryOrgId: null });
    return () => {
      useOrgStore.setState({
        orgsById: snapshot.orgsById,
        orgIds: snapshot.orgIds,
        primaryOrgId: snapshot.primaryOrgId,
      });
    };
  },
} satisfies Meta<typeof AppointmentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A confirmed booking an editor can act on: view, change status, reschedule, assign room, medical records, finance and labs.',
      },
    },
  },
};

export const Requested: Story = {
  name: 'Requested — needs a response',
  args: {
    appointment: {
      ...BASE_APPOINTMENT,
      status: 'REQUESTED',
      room: undefined,
      concern: 'Limping on the back right leg since yesterday',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A request replaces the whole action row with the accept (success) and decline (danger) pair — the only two things that can happen to it next.',
      },
    },
  },
};

export const ViewOnly: Story = {
  name: 'Without edit permission',
  args: { canEditAppointments: false },
  parameters: {
    docs: {
      description: {
        story:
          'Without `canEditAppointments` the mutating actions disappear and the row keeps only view, records, finance and labs.',
      },
    },
  },
};

export const LongValues: Story = {
  name: 'Long names and reason',
  args: {
    appointment: {
      ...BASE_APPOINTMENT,
      patient: {
        id: 'companion-2',
        name: 'Bartholomew Fitzgerald the Third',
        species: 'dog',
        breed: 'Bernese Mountain Dog / Great Pyrenees cross',
        parent: { id: 'parent-2', name: 'Alexandra Konstantinopoulos' },
      },
      appointmentType: {
        id: 'type-2',
        name: 'Post-operative orthopaedic recheck and bandage change',
        speciality: { id: 'spec-2', name: 'Orthopaedic surgery' },
      },
      room: { id: 'room-2', name: 'Surgical prep and recovery suite' },
      concern:
        'Recheck of the cranial cruciate ligament repair, bandage change and a review of the pain relief plan',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Overflow guard: long companion, breed, service and room values must not push the card wider or break the action row.',
      },
    },
  },
};

/**
 * Opens one action's bubble and returns it together with its trigger.
 *
 * `openGlassTooltip` rather than a `userEvent` pointer session: the wrapper binds its
 * listeners in an effect, and a play function can start before that effect has flushed -
 * a single dispatch then lands on an element that is not listening and is lost, because
 * `findByRole` retries the query and never re-sends the event.
 *
 * That also means leaving is explicit. A dispatched `mouseenter` on the next icon does
 * not emit a `mouseleave` on the last one, so a walk along the rail has to close each
 * bubble itself or they pile up on `document.body` - which is exactly what the
 * one-bubble assertion below is there to catch.
 */
const openAction = async (canvasElement: HTMLElement, actionLabel: string) => {
  const button = within(canvasElement).getByRole('button', { name: actionLabel });
  const bubble = await openGlassTooltip(button);
  // Settling on exactly one is the real assertion: a teardown leak would never settle.
  await waitFor(() => {
    expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);
  });
  return { bubble, button };
};

export const ViewTooltip: Story = {
  name: 'Tooltip — view action',
  play: async ({ canvasElement }) => {
    const { bubble } = await openAction(canvasElement, 'View appointment for Poppy');
    await expect(bubble).toHaveTextContent('View appointment');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first bubble on the rail. It hangs below its 40px circular trigger with a 10px gap, ' +
          'and because the card sits at the left edge of the grid this is the placement that has to ' +
          'survive the 8px left clamp in `updatePosition`.',
      },
    },
  },
};

export const ClinicalNotesTooltip: Story = {
  name: 'Tooltip — clinical notes label',
  play: async ({ canvasElement }) => {
    const { bubble } = await openAction(canvasElement, 'Medical Records for Poppy');
    // The org store says HOSPITAL, so the bubble must say Medical Records rather
    // than the Care fallback. This string is data, not a constant.
    await expect(bubble).toHaveTextContent('Medical Records');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only bubble whose text comes from state. `getClinicalNotesLabel(orgType)` resolves ' +
          '"Medical Records" for a hospital and "Care" for every other business type, so this bubble ' +
          'is where an unresolved organisation shows up as the wrong word.',
      },
    },
  },
};

export const RailTooltips: Story = {
  name: 'Tooltips — the whole rail',
  play: async ({ canvasElement }) => {
    const expectations: Array<[string, string]> = [
      ['View appointment for Poppy', 'View appointment'],
      ['Change status for Poppy', 'Change status'],
      ['Reschedule appointment for Poppy', 'Reschedule'],
      ['Assign room for Poppy', 'Assign room'],
      ['Medical Records for Poppy', 'Medical Records'],
      ['Finance summary for Poppy', 'Finance summary'],
      ['Lab tests for Poppy', 'Lab tests'],
    ];

    // Each icon is closed before the next is opened, so the one-bubble assertion inside
    // `openAction` really is checking teardown rather than a lucky ordering. Seven
    // stacked bubbles would be its own defect.
    for (const [trigger, label] of expectations) {
      const { bubble, button } = await openAction(canvasElement, trigger);
      await expect(bubble).toHaveTextContent(label);
      await closeGlassTooltip(button);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'All seven actions of an editable upcoming appointment, opened in turn. The assertion after ' +
          'each hover is that exactly **one** bubble exists — `GlassTooltip` closes on `mouseleave`, ' +
          'and a leak there would leave the rail trailing bubbles as the pointer crosses it.',
      },
    },
  },
};

export const RequestedTooltip: Story = {
  name: 'Tooltip — requested rail',
  args: {
    appointment: {
      ...BASE_APPOINTMENT,
      status: 'REQUESTED',
      room: undefined,
      concern: 'Limping on the back right leg since yesterday',
    },
  },
  play: async ({ canvasElement }) => {
    // Hover only. The decline button fires `rejectAppointment` over the network
    // on click, so a story must never press it.
    const { bubble } = await openAction(canvasElement, 'Accept request for Poppy');
    await expect(bubble).toHaveTextContent('Accept request');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other rail entirely. A requested booking replaces all seven actions with two tinted ' +
          'discs, so these two bubbles can never appear in the same render as the seven above — which ' +
          'is why the rail needs both stories rather than one.',
      },
    },
  },
};

export const TooltipByKeyboard: Story = {
  name: 'Tooltip — opened by keyboard focus',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* focusin, not hover: the path a keyboard user gets, and the one that rots unnoticed
       because every manual check is done with a mouse. Dispatched at the wrapper rather
       than via `.focus()`, which fires nothing unless the page itself has focus. */
    const bubble = await openGlassTooltip(
      canvas.getByRole('button', { name: 'Lab tests for Poppy' }),
      { via: 'focus' }
    );
    await expect(bubble).toHaveTextContent('Lab tests');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The last icon on the rail, reached without a pointer. `GlassTooltip` listens for `focusin` ' +
          'as well as `mouseenter`, so tabbing through the card surfaces the same labels — worth its ' +
          'own story because the icons carry no visible text at all.',
      },
    },
  },
};
