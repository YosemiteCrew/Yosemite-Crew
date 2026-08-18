import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AppointmentDetailsSection from './AppointmentDetailsSection';

const SPECIALITIES = [
  { label: 'General practice', value: 'spec-general' },
  { label: 'Dermatology', value: 'spec-derm' },
  { label: 'Orthopaedics', value: 'spec-ortho' },
  { label: 'Dentistry', value: 'spec-dental' },
];

const SERVICES = [
  { label: 'Wellness exam - 30 min', value: 'svc-wellness' },
  { label: 'Vaccination booster', value: 'svc-vax' },
  { label: 'Senior care package', value: 'svc-senior' },
  { label: 'Dental scale & polish', value: 'svc-dental' },
  { label: 'Nail trim', value: 'svc-nails' },
];

/** The panels portal to `document.body`, so the trigger needs room beneath it. */
const Room = (Story: React.ComponentType) => (
  <div className="min-h-[520px] w-full max-w-[560px] p-4">
    <Story />
  </div>
);

/** Opens one of the two dropdowns and hands back its portalled panel. */
const openPanel = async (trigger: HTMLElement) => {
  await userEvent.click(trigger);
  // The panel is `createPortal`ed to document.body, so it is outside canvasElement.
  const panel = document.querySelector('[data-portal-dropdown]');
  await expect(panel).toBeInTheDocument();
  return panel as HTMLElement;
};

const meta = {
  title: 'Appointments/AppointmentDetailsSection',
  component: AppointmentDetailsSection,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Speciality / Service / Concern block of the booking flow. Everything it renders ' +
          'lives **two gates deep**, which is why it had no story worth trusting: the accordion ' +
          'body only mounts when `Accordion` is open (`{open && hasChildren && ...}`), and each ' +
          "`LabelDropdown`'s option list only mounts after its trigger is clicked - and then " +
          '`createPortal`s to `document.body`, outside the canvas entirely.\n\n' +
          'That double gating is exactly the shape of the four production bugs on this branch: ' +
          'panels whose layout or ink tokens were wrong, and which no snapshot ever contained. ' +
          "Here the specific things now drawn are the open body's `flex flex-col gap-3` stack " +
          "(two 44px dropdown triggers over a `min-h-[120px]` textarea), the accordion's split " +
          'border - `border-x border-t rounded-t-2xl` on the header plus `border-x border-b ' +
          'rounded-b-2xl` on the body, which only reads as one box when both halves render - and ' +
          'the portalled option rows at 12.5px/600 on `--ink-body`, the ink token whose fill-token ' +
          'counterpart shipped as a bug in a sibling dropdown.\n\n' +
          'The stories assert the opened panel has its option rows, not merely that the trigger ' +
          'flipped `aria-expanded`; the weaker check passes on an empty panel, which is how a real ' +
          'regression stayed invisible.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialitiesOptions: SPECIALITIES,
    servicesOptions: SERVICES,
    onSpecialitySelect: fn(),
    onServiceSelect: fn(),
    concern: '',
    onConcernChange: fn(),
    onConcernFocus: fn(),
    onConcernBlur: fn(),
    onNext: fn(),
    defaultOpen: true,
  },
} satisfies Meta<typeof AppointmentDetailsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed (header only)',
  args: { defaultOpen: false },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. With the body unmounted the header carries the all-round `border ' +
          'rounded-2xl`; the split-border pair below only exists once it is open.',
      },
    },
  },
};

export const Expanded: Story = {
  name: 'Body open (via header click)',
  args: { defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Appointment details' }));
    // Assert the body actually mounted its fields - not just that aria-expanded flipped.
    await expect(await canvas.findByRole('button', { name: 'Speciality' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Services / Packages' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Describe concern' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opened the way a user opens it. The body is a `flex flex-col gap-3` column and the Next ' +
          'button sits in its own centred `pt-3 pb-1` row, so the gap above it is 12px + 12px rather ' +
          'than the 12px the stack implies.',
      },
    },
  },
};

export const SpecialityPanelOpen: Story = {
  name: 'Speciality panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openPanel(canvas.getByRole('button', { name: 'Speciality' }));
    // Options are plain <button>s, not role="option".
    await expect(within(panel).getAllByRole('button')).toHaveLength(SPECIALITIES.length);
    await expect(within(panel).getByText('Dermatology')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first of the two portalled listboxes. It is positioned absolutely from the measured ' +
          'trigger rect (4px below it, matching its width), so it is one of the few surfaces whose ' +
          'geometry cannot be reviewed from the closed state at all.',
      },
    },
  },
};

export const ServicesPanelOpen: Story = {
  name: 'Services panel open (5 rows, one selected)',
  args: { serviceId: 'svc-senior' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openPanel(
      canvas.getByRole('button', { name: 'Services / Packages: Senior care package' })
    );
    await expect(within(panel).getAllByRole('button')).toHaveLength(SERVICES.length);
    await expect(within(panel).getByText('Senior care package')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The taller of the two panels, with a value already selected. The selected row is marked ' +
          'only by the `--nav-active-bg` wash and `--nav-active` ink - there is no check mark, so ' +
          'the selected state has to survive on colour alone. `max-h-[200px]` with a hidden ' +
          'scrollbar caps the list, which only shows up once enough rows are drawn.',
      },
    },
  },
};

export const WithErrors: Story = {
  name: 'Validation errors (open)',
  args: {
    specialityError: 'Select a speciality.',
    serviceError: 'Select a service or package.',
    concernError: 'Describe the concern before continuing.',
    concern: '',
  },
  parameters: {
    docs: {
      description: {
        story:
          'All three fields failing at once. Each error line is its own `min-h-6 mt-1.5` row inside ' +
          'the field, so the 12px column gap compounds and the block grows by roughly 30px per ' +
          'failing field - worth seeing composited rather than one field at a time.',
      },
    },
  },
};

export const NoNextAction: Story = {
  name: 'Without the Next action',
  args: { onNext: undefined },
  parameters: {
    docs: {
      description: {
        story:
          'Reused inside the workspace, where the step is advanced from the meta bar instead. The ' +
          'Next row is not disabled but absent, so the body ends on the textarea.',
      },
    },
  },
};
