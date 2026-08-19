import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Service } from '@yosemite-crew/types';

import type { SpecialityWeb } from '@/app/features/organization/types/speciality';
import SpecialityStep from './SpecialityStep';

const ORG_ID = 'org-storybook-avenger-park';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
  address: {
    addressLine: '12 Kollwitzstrasse',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
};

const buildService = (name: string, durationMinutes: number, cost: number): Service => ({
  id: '',
  organisationId: ORG_ID,
  name,
  durationMinutes,
  cost,
  isActive: true,
});

const DENTISTRY: SpecialityWeb = {
  name: 'Dentistry',
  organisationId: ORG_ID,
  services: [buildService('Dental Cleaning & Scaling', 60, 160)],
};

/* Hoisted rather than created inline: a `fn()` in the render body is a new spy on
   every re-render, so an assertion about it would read a different mock than the
   one the click reached. */
const onPrevStep = fn();

type HarnessProps = {
  /** Specialties already on the step, as the wizard would hand them back on resume. */
  initialSpecialities?: SpecialityWeb[];
};

/**
 * The step is fully controlled - it owns no specialty state of its own - so the
 * stories supply the `useState` pair the CreateOrg wizard normally supplies.
 * Nothing here reaches the network: `submitSpecialityStep` is only called once
 * the specialty list is non-empty, and every story that presses the CTA presses
 * it with an empty list on purpose.
 */
const SpecialityStepHarness = ({ initialSpecialities = [] }: HarnessProps) => {
  const [formData, setFormData] = useState<Organisation>(ORG);
  const [specialities, setSpecialities] = useState<SpecialityWeb[]>(initialSpecialities);

  return (
    <div className="min-h-[760px] w-[960px] max-w-full bg-[var(--page)] p-6">
      <SpecialityStep
        formData={formData}
        setFormData={setFormData}
        initialSpecialities={initialSpecialities}
        isExistingOrg
        prevStep={onPrevStep}
        specialities={specialities}
        setSpecialities={setSpecialities}
      />
    </div>
  );
};

const meta = {
  title: 'Onboarding/SpecialityStep',
  component: SpecialityStepHarness,
  parameters: {
    layout: 'fullscreen',
    /* Required, not decorative: the step calls `useRouter()` from next/navigation
       at the top of its hook. The framework only builds that mock when
       `appDirectory` is set, and `getRouter()` throws
       NextjsRouterMocksNotAvailable otherwise - so every story here fails to
       render without this line. */
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The third create-org step, and the only one whose interesting surfaces are all bespoke ' +
          'markup local to the file rather than shared primitives - which is exactly why none of ' +
          'them had ever been drawn.\n\n' +
          'Three of them open only on interaction and are therefore invisible to a static ' +
          'snapshot of the step:\n\n' +
          '- The **specialty picker dropdown**, opened by focusing or typing in the search field. ' +
          'It is an absolutely positioned overlay (`top: calc(100% + 10px)`, `z-index: 20`) that ' +
          'is not portalled, so it is clipped by any scrolling ancestor the wizard grows later.\n' +
          '- Its **"Create specialty" empty branch**, which replaces the whole option list the ' +
          'moment the query matches nothing. It is the only route to a custom specialty, and it ' +
          'is reachable only by typing something the 15-entry catalog does not contain.\n' +
          '- The **per-specialty service picker**, the same markup again, nested inside each ' +
          'selected card.\n\n' +
          'The list is capped at `slice(0, 8)` of 15 catalog entries with no "more" affordance ' +
          'and no scroll hint beyond the 280px `max-height`, so seven specialties are only ' +
          'reachable by typing their name. The recommended chip row is capped the same way, at ' +
          '6 of the 8 names `orgTypeContent.HOSPITAL.recommended` lists - Emergency & Critical ' +
          'Care and Preventive / Wellness Medicine never render as chips.\n\n' +
          'Both validation errors land in the same single `.step-inline-error` line at the foot ' +
          'of the list, including the one raised from inside the service modal - where it renders ' +
          'behind the scrim.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SpecialityStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing added yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No specialties added yet')).toBeInTheDocument();

    // Six chips, not the eight names the HOSPITAL content block lists.
    const chipGroup = canvasElement.querySelector('.step-three-chip-group') as HTMLElement;
    await expect(chipGroup.children).toHaveLength(6);
    await expect(chipGroup.children[0]).toHaveTextContent('General Practice');
    await expect(chipGroup.children[5]).toHaveTextContent('Radiology / Diagnostic Imaging');
    await expect(
      within(chipGroup).queryByText('Emergency & Critical Care')
    ).not.toBeInTheDocument();

    // The picker is closed at rest, so the story below is the only place it exists.
    await expect(canvasElement.querySelector('.step-three-picker-dropdown')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting step for a hospital. The search panel carries the org-type audience line ' +
          'and the recommended chips; the empty card below is the only thing that changes once a ' +
          'specialty is added.',
      },
    },
  },
};

export const PickerOpen: Story = {
  name: 'Specialty picker (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('textbox', { name: 'Search or add a specialty' }));

    await waitFor(() =>
      expect(canvasElement.querySelector('.step-three-picker-dropdown')).not.toBeNull()
    );
    const dropdown = canvasElement.querySelector('.step-three-picker-dropdown') as HTMLElement;

    // Eight options of the fifteen the catalog holds - the cap is silent.
    const options = within(dropdown).getAllByRole('button');
    await expect(options).toHaveLength(8);
    await expect(options[0]).toHaveTextContent('Observational tools');
    await expect(options[0]).toHaveTextContent('3 starter services included');
    await expect(options[1]).toHaveTextContent('General Practice');
    await expect(options[1]).toHaveTextContent('6 starter services included');
    // Ninth in catalog order onwards: present in the data, absent from the UI.
    await expect(within(dropdown).queryByText('Cardiology')).not.toBeInTheDocument();

    // Overlay, not an inline block: it is positioned out of flow over the chips.
    await expect(getComputedStyle(dropdown).position).toBe('absolute');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opened on focus, so it appears before a single character is typed. Each row is a ' +
          'two-line option - name plus the starter-service count that will be copied into the ' +
          'card - and the count differs per specialty, so it is worth reading rather than ' +
          'assuming: Observational tools ships 3, most clinical specialties ship 6 or 7 because ' +
          'the catalog prepends a General Consult to any row flagged `consult`.',
      },
    },
  },
};

export const PickerCreateCustom: Story = {
  name: 'Specialty picker (no matches)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search or add a specialty' });
    await userEvent.type(search, 'Hydrotherapy');

    await waitFor(() =>
      expect(canvasElement.querySelector('.step-three-picker-dropdown')).not.toBeNull()
    );
    const dropdown = canvasElement.querySelector('.step-three-picker-dropdown') as HTMLElement;

    // The whole option list is replaced by one create row - not appended to it.
    const createRow = within(dropdown).getByRole('button', {
      name: 'Create specialty “Hydrotherapy”',
    });
    await expect(within(dropdown).getAllByRole('button')).toHaveLength(1);

    await userEvent.click(createRow);

    // The card is built from the query, with no template behind it: zero services
    // and the generated fallback summary rather than a catalog one.
    await expect(canvas.getByText('Hydrotherapy')).toBeInTheDocument();
    await expect(canvas.getByText('0 services')).toBeInTheDocument();
    await expect(
      canvas.getByText('A configurable specialty for hydrotherapy services in your organization.')
    ).toBeInTheDocument();
    await expect(search).toHaveValue('');
    await expect(canvasElement.querySelector('.step-three-picker-dropdown')).toBeNull();

    /* One card, one track. Both counts matter: the grid is
       `repeat(auto-fit, minmax(320px, 1fr))`, and it is the `:has(> :only-child)`
       rule that collapses it to `minmax(0, 1fr)` - so a track count read without
       the child count would not say which rule produced it. */
    const grid = canvasElement.querySelector('.step-three-selected-grid') as HTMLElement;
    await expect(grid.children).toHaveLength(1);
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing a specialty the catalog does not carry. The filter matches service names as ' +
          'well as specialty names, so this branch only appears once neither hits - and it is the ' +
          'only way to add a custom specialty, which is why it is worth seeing that it looks ' +
          'nothing like the option rows it replaces. Selecting it clears the query, closes the ' +
          'picker and adds an empty card whose summary is generated from the typed name.',
      },
    },
  },
};

export const ServicePickerOpen: Story = {
  name: 'Service picker inside a card',
  args: { initialSpecialities: [DENTISTRY] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add service' }));

    const searchLabel = 'Search services for Dentistry';
    expect(await canvas.findByRole('textbox', { name: searchLabel })).toBeInTheDocument();

    const panel = canvasElement.querySelector('.step-three-service-search-panel') as HTMLElement;
    const dropdown = panel.querySelector('.step-three-picker-dropdown') as HTMLElement;
    const options = within(dropdown).getAllByRole('button');

    // Five of the six Dentistry template services: the one already on the card is
    // filtered out, so the list shrinks as the card fills.
    await expect(options).toHaveLength(5);
    await expect(options[0]).toHaveTextContent('General Consult');
    await expect(options[0]).toHaveTextContent('30 min • $75');
    await expect(within(dropdown).queryByText('Dental Cleaning & Scaling')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same dropdown markup again, nested one level deeper and keyed by specialty name. ' +
          'Each row carries the duration and price the catalog derives from keywords in the ' +
          'service name, which is what the service editor then opens with - so the numbers on ' +
          'these rows are the defaults a clinic ships with unless someone edits them.',
      },
    },
  },
};

export const SubmitWithNoSpecialities: Story = {
  name: 'Validation: no specialties added',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Create organisation' }));

    const error = await canvas.findByText('Add at least one specialty to continue');
    await expect(error).toHaveClass('step-inline-error');
    // The guard returns before `setIsSubmitting(true)`, so the CTA never enters
    // its pending label and nothing was sent.
    await expect(canvas.getByRole('button', { name: 'Create organisation' })).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Creating organisation...' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only client-side guard on this step. The message renders at the foot of the list ' +
          'rather than next to the search field that would fix it, and the empty-state card sits ' +
          'between the two.',
      },
    },
  },
};

export const ServiceEditorNameRequired: Story = {
  name: 'Validation: service name cleared',
  args: { initialSpecialities: [DENTISTRY] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Dental Cleaning & Scaling' }));

    /* The editor is a CenterModal, which portals to document.body - none of its
       fields are inside canvasElement, and a closed dialog stays mounted without
       its `open` attribute, so both queries have to go through `dialog[open]`. */
    await waitFor(() => expect(document.querySelector('dialog[open]')).not.toBeNull());
    const dialog = document.querySelector('dialog[open]') as HTMLElement;
    const nameField = within(dialog).getByRole('textbox', { name: 'Service name' });
    await expect(nameField).toHaveValue('Dental Cleaning & Scaling');

    await userEvent.clear(nameField);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save service' }));

    // The editor stays open, and the message it raises is rendered by the PAGE,
    // behind the scrim - not inside the dialog the user is looking at.
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    expect(await canvas.findByText('Service name is required.')).toBeInTheDocument();
    await expect(within(dialog).queryByText('Service name is required.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Saving a service with an empty name. `handleSaveService` sets the same `error` state ' +
          'the submit guard uses, which is rendered in the step body - so the message lands ' +
          'behind the modal scrim while the modal stays open with no feedback of its own. Worth ' +
          'a design decision rather than a snapshot: this is the one error in the step a user ' +
          'cannot see when it fires.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { initialSpecialities: [DENTISTRY] },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders at full panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* "Dentistry" is on screen TWICE, and both are the step working as built: the
       recommended chip stays in the row after it has been added - it is disabled,
       not removed - and the selected card repeats the name as its title. So this
       is not the step rendered twice at this breakpoint, and not the preview
       decorator's sr-only story-title banner; it is one chip and one card, and it
       reads the same way at 1280px. Every query for a specialty name in this step
       has to say which of the two it means. */
    const chipGroup = canvasElement.querySelector('.step-three-chip-group') as HTMLElement;
    const grid = canvasElement.querySelector('.step-three-selected-grid') as HTMLElement;
    await expect(canvas.getAllByText('Dentistry')).toHaveLength(2);
    await expect(within(grid).getByText('Dentistry')).toBeInTheDocument();
    /* The chip is the reason the picker list is one shorter than the catalog for
       an added specialty: `filteredCatalog` drops selected names, but the chip row
       keeps them and greys them out instead. */
    await expect(within(chipGroup).getByText('Dentistry')).toBeDisabled();

    // Under 500px the footer reverses so the primary action sits on top.
    const buttons = canvasElement.querySelector('.step-buttons') as HTMLElement;
    await expect(getComputedStyle(buttons).flexDirection).toBe('column-reverse');

    // Single card, single track - the same only-child rule as on desktop, so
    // this is not a breakpoint effect and the child count is what says so.
    await expect(grid.children).toHaveLength(1);
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The step at 375px. The footer flips to `column-reverse` below 500px, which puts ' +
          '"Create organisation" above "Back" - the opposite vertical order to the desktop row, ' +
          'and the only breakpoint where that happens.\n\n' +
          'The resumed card also shows what an added specialty does to the panel above it: the ' +
          'recommended chip is disabled in place rather than removed, so the name appears both as ' +
          'a greyed chip and as a card title, while the picker list below drops it entirely. Two ' +
          'different rules for the same fact, and only one of them is visible at rest.',
      },
    },
  },
};
