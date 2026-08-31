import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import AddAppointment from './AddAppointment';
import { LeadOptions, SpecialityOptions, SupportOptions } from './AddAppointmentOptions';

/**
 * Both dropdown flavours `createPortal` their panel onto `document.body`, so it is
 * outside `canvasElement` and invisible to `within(canvas)`. The single-select panel
 * carries `aria-label={placeholder}`; the multi-select panel carries none, which is
 * how the two are told apart below.
 */
const findSelectPanel = (label: string) =>
  waitFor(() => {
    const panel = globalThis.document.querySelector<HTMLElement>(
      `[data-portal-dropdown][aria-label="${label}"]`
    );
    if (!panel) throw new Error(`The ${label} panel is not mounted`);
    return panel;
  });

const findMultiSelectPanel = () =>
  waitFor(() => {
    const panel = globalThis.document.querySelector<HTMLElement>(
      '[data-portal-dropdown]:not([aria-label])'
    );
    if (!panel) throw new Error('The multi-select panel is not mounted');
    return panel;
  });

/** Opening by trigger name and then matching the panel by label keeps a stale panel
    from a previous pick from being mistaken for the one just opened. */
const openSelect = async (canvasElement: HTMLElement, placeholder: string) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: placeholder }));
  return findSelectPanel(placeholder);
};

const meta = {
  title: 'Companions/Sections/AddAppointment',
  component: AddAppointment,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Add appointment" panel from the companion record: four accordions over one local ' +
          '`formData`, and a "Book appointment" CTA. It takes no props at all, so every state ' +
          'below is reached by driving the real controls.\n\n' +
          'Three things only a rendered story shows. Two of the four sections - "Select date & ' +
          'time" and "Billable services" - are empty `<div>`s, so a booking made here can carry ' +
          'no date and no charges. The "Service" dropdown is wired to `SpecialityOptions`, so it ' +
          'offers specialities rather than services. And `formDataErrors` is a `useState` with no ' +
          'setter in scope, so no field can ever show an error and the CTA submits nothing - ' +
          'which is why there is no validation story here.\n\n' +
          'Nothing imports this component. `CompanionInfo` builds its panes from a ' +
          '`COMPONENT_MAP` that lists `companion-information`, `parent-information`, ' +
          '`core-information` and `history`, and this section is in none of them, so the surface ' +
          'is unreachable in the product today.\n\n' +
          'Rendered at 530px, the width of the drawer `CompanionInfo` opens it inside (`Modal` ' +
          'with no `size` falls back to `lg`).',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[530px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddAppointment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the first section is mounted open; the other three keep their children
    // unrendered, so every control below "Appointment details" is absent until
    // expanded. A story that queried them without expanding would fail loudly here
    // rather than quietly asserting nothing.
    await expect(canvas.getByRole('button', { name: 'Appointment details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    for (const title of ['Select date & time', 'Staff details', 'Billable services']) {
      await expect(canvas.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    }
    // Every accordion is handed `isEditing` and `showEditIcon={false}`, so the panel
    // is permanently in edit mode and no pencil is ever offered. If either prop is
    // dropped the sections gain a pencil that toggles a mode they do not have.
    await expect(canvas.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    // `href="#"` is not a link in BaseButton - it collapses to a real <button>, so
    // the CTA is reachable by keyboard rather than being an anchor to nowhere.
    await expect(canvas.getByRole('button', { name: 'Book appointment' }).tagName).toBe('BUTTON');
  },
};

export const SpecialityAndService: Story = {
  name: 'Speciality and service chosen',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const specialityPanel = await openSelect(canvasElement, 'Speciality');
    await expect(within(specialityPanel).getAllByRole('button')).toHaveLength(
      SpecialityOptions.length
    );
    await userEvent.click(
      within(specialityPanel).getByRole('button', { name: 'Internal medicine' })
    );
    // The trigger re-labels itself with the pick. That aria-label is the only
    // announcement of the chosen value - the value span itself carries no label -
    // so losing it makes the whole field silent to a screen reader while still
    // looking answered.
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Speciality: Internal medicine' })).toBeVisible()
    );

    const servicePanel = await openSelect(canvasElement, 'Service');
    // Drift worth pinning: "Service" is wired to SpecialityOptions, so it lists the
    // same three specialities. Nothing in the type system objects - both props take
    // string[] - and the field looks perfectly healthy until the panel is open.
    await expect(
      within(servicePanel)
        .getAllByRole('button')
        .map((option) => option.textContent)
    ).toEqual(SpecialityOptions);
    await userEvent.click(within(servicePanel).getByRole('button', { name: 'Surgery' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Service: Surgery' })).toBeVisible()
    );
  },
};

export const StaffDetails: Story = {
  name: 'Lead and support staff',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Staff details starts collapsed, so neither of its controls exists yet.
    await userEvent.click(canvas.getByRole('button', { name: 'Staff details' }));

    const leadPanel = await openSelect(canvasElement, 'Lead');
    await userEvent.click(within(leadPanel).getByRole('button', { name: LeadOptions[0] }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: `Lead: ${LeadOptions[0]}` })).toBeVisible()
    );

    // Support is the multi-select, and it holds the panel open across picks rather
    // than closing on the first one the way Lead does.
    await userEvent.click(canvas.getByRole('button', { name: 'Support' }));
    const supportPanel = await findMultiSelectPanel();
    await expect(within(supportPanel).getAllByRole('button')).toHaveLength(SupportOptions.length);
    await userEvent.click(within(supportPanel).getByRole('button', { name: SupportOptions[0] }));
    await userEvent.click(within(supportPanel).getByRole('button', { name: SupportOptions[2] }));

    // Selection rides entirely on aria-pressed plus a 14px check glyph; there is no
    // fill or weight change, so the pressed state is the only durable contract.
    await waitFor(() =>
      expect(within(supportPanel).getAllByRole('button', { pressed: true })).toHaveLength(2)
    );
    await expect(
      canvas.getByRole('button', {
        name: `Support: ${SupportOptions[0]}, ${SupportOptions[2]}`,
      })
    ).toBeVisible();
  },
};

export const Concern: Story = {
  name: 'Concern filled in',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const concern = canvas.getByRole('textbox', { name: 'Describe concern' });
    // FormDesc ships a 72px floor and this panel overrides it to 120 with the
    // Tailwind important suffix. Drop the `!` and the box silently shrinks back to
    // 72 - a change no assertion on the copy would notice.
    await expect(concern.getBoundingClientRect().height).toBeGreaterThanOrEqual(120);

    await userEvent.type(concern, 'Limping since Tuesday');
    // The textarea is controlled off formData.concern, so a dropped onChange leaves
    // it permanently empty while still accepting keystrokes.
    await expect(concern).toHaveValue('Limping since Tuesday');
  },
};

export const UnbuiltSections: Story = {
  name: 'Date and billing sections are empty',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const countControls = () =>
      canvas.getAllByRole('button').length + canvas.getAllByRole('textbox').length;
    const before = countControls();

    await userEvent.click(canvas.getByRole('button', { name: 'Select date & time' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Billable services' }));

    await expect(canvas.getByRole('button', { name: 'Select date & time' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Billable services' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // Both open, and between them they add not one control: the two sections are
    // empty `<div>`s. Expanding an accordion and getting a blank strip reads as a
    // render fault, so this pins that it is the component, not the accordion.
    await expect(countControls()).toBe(before);
  },
};

export const Phone: Story = {
  name: 'Phone: one column, no sideways scroll',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // The accordions and the 44px dropdown triggers are all `w-full`, so anything
    // that pushes past 375 comes from a fixed width sneaking in.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
