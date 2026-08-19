import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import CompanionCard from './CompanionCard';

const parent: CompanionParent['parent'] = {
  id: 'parent-1',
  firstName: 'Marta',
  lastName: 'Alvarez',
  email: 'marta.alvarez@example.com',
  phoneNumber: '+34 600 000 000',
  address: { city: 'Barcelona', country: 'ES' },
  createdFrom: 'pms',
};

const baseCompanion: CompanionParent = {
  companion: {
    id: 'companion-1',
    organisationId: 'org-1',
    parentId: 'parent-1',
    name: 'Kiko',
    type: 'dog',
    breed: 'Border Collie',
    dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
    gender: 'male',
    allergy: 'Chicken protein',
    isInsured: true,
    status: 'active',
  },
  parent,
};

const meta = {
  title: 'Cards/CompanionCard',
  component: CompanionCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone/tablet card for one companion record: avatar, breed and species, parent, ' +
          'gender/age, allergies, status pill, and a row of round icon actions. Each action is ' +
          'permission-gated, so the same card renders with anywhere from one to four buttons. ' +
          'Action labels run through the org terminology rewriter, which falls back to the ' +
          'default "companion" wording when no org is loaded.\n\n' +
          'What none of the resting stories contained is the **tooltip bubble**. Each of the four ' +
          'round buttons is wrapped in a `GlassTooltip`, which `createPortal`s its bubble to ' +
          '`document.body` and mounts it only while `open` - state set from `mouseenter`/`focusin` ' +
          'listeners attached imperatively to the wrapper span. So four separate portalled ' +
          'surfaces lived on this card and not one of them had ever been rendered by a story or a ' +
          'snapshot.\n\n' +
          'That is exactly the class of defect this pass exists to close: a dropdown panel on this ' +
          'branch shipped with fill tokens where ink tokens belonged, and a popover shipped an ' +
          'invalid comma in its `grid-template-columns`, because neither surface existed until ' +
          'someone pointed at it. A bubble here is `position: fixed` at coordinates computed from ' +
          '`getBoundingClientRect`, clamped to an 8px viewport padding, with `side="top"` giving ' +
          'it `translate(-50%, -100%)` and a 10px gap above the trigger - all of which is only ' +
          'checkable with it on screen.\n\n' +
          'Three of the four bubbles carry fixed copy ("Change status", "Schedule", "Task"); the ' +
          'View bubble is the only one routed through the terminology rewriter, so it is the one ' +
          'that changes wording per org type while the other three never do. The stories below ' +
          'open the bubbles and assert their text, rather than asserting that a trigger was ' +
          'hovered - an empty bubble would satisfy the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companion: baseCompanion,
    handleViewCompanion: fn(),
    handleBookAppointment: fn(),
    handleAddTask: fn(),
    handleChangeStatus: fn(),
    canEditAppointments: true,
    canEditTasks: true,
    canEditCompanions: true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllActions: Story = { name: 'All actions' };

export const ViewOnly: Story = {
  name: 'View only (no edit permissions)',
  args: {
    canEditAppointments: false,
    canEditTasks: false,
    canEditCompanions: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A read-only member sees the single View action. The row stays centred rather than ' +
          'leaving three empty slots.',
      },
    },
  },
};

export const Archived: Story = {
  args: {
    companion: {
      ...baseCompanion,
      companion: {
        ...baseCompanion.companion,
        id: 'companion-2',
        name: 'Pepper',
        type: 'cat',
        breed: 'Maine Coon',
        gender: 'female',
        allergy: undefined,
        status: 'archived',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Archived tone on the status pill, and a missing allergy renders the `-` placeholder ' +
          'rather than an empty gap.',
      },
    },
  },
};

export const LongText: Story = {
  name: 'Long name and breed',
  args: {
    companion: {
      ...baseCompanion,
      companion: {
        ...baseCompanion.companion,
        id: 'companion-3',
        name: 'Bartholomew Wigglesworth III',
        type: 'horse',
        breed: 'Andalusian Cross Warmblood',
        allergy: 'Seasonal pollen, dust mites and one specific brand of hay net',
      },
      parent: { ...parent, lastName: 'Van Der Berg-Christiansen' },
    },
  },
};

/**
 * Opens the bubble for `name` and asserts its copy.
 *
 * The bubble portals to `document.body`, so it is outside `canvasElement`; it is also
 * the only element with `role="tooltip"`, and only one is ever open.
 *
 * `openGlassTooltip` rather than `userEvent.hover`: the wrapper's listeners are bound in
 * an effect that has not necessarily flushed when a play function starts, so a single
 * dispatch can land on an element that is not listening yet. `findByRole` retries the
 * query but never re-sends the event, so that dispatch is lost for good.
 */
const openTooltipFor = async (canvasElement: HTMLElement, name: RegExp, text: RegExp) => {
  const button = within(canvasElement).getByRole('button', { name });
  const tooltip = await openGlassTooltip(button);
  await expect(tooltip).toHaveTextContent(text);
  return button;
};

export const ViewTooltip: Story = {
  name: 'Tooltip - View (hover)',
  play: async ({ canvasElement }) => {
    // The label is rewritten per org type, so match its shape rather than one wording.
    await openTooltipFor(canvasElement, /^View .*Kiko$/, /^View /);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first of the four bubbles, and the only one whose copy is org-dependent - it shares ' +
          "the trigger's rewritten label rather than a literal string.",
      },
    },
  },
};

export const AllFourTooltips: Story = {
  name: 'All four tooltips (hovered in turn)',
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    // Nothing is open at rest: the bubble does not exist until a pointer arrives.
    await expect(body.queryByRole('tooltip')).not.toBeInTheDocument();

    const steps: Array<[RegExp, RegExp]> = [
      [/^View .*Kiko$/, /^View /],
      [/^Change status for Kiko$/, /^Change status$/],
      [/^Schedule Kiko$/, /^Schedule$/],
      [/^Create task for Kiko$/, /^Task$/],
    ];

    for (const [trigger, copy] of steps) {
      const button = await openTooltipFor(canvasElement, trigger, copy);
      // mouseleave unmounts the portal, so the next bubble is unambiguous.
      await closeGlassTooltip(button);
    }

    // Leave the last one open so the story has something to look at.
    await openTooltipFor(canvasElement, /^Create task for Kiko$/, /^Task$/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every bubble on the card, one at a time. Each is asserted to carry its own copy, which is ' +
          'the check that would have caught a tooltip wired to the wrong trigger or rendering empty - ' +
          'the failure mode an `aria-expanded`-style assertion cannot see.',
      },
    },
  },
};

export const TooltipOnFocus: Story = {
  name: 'Tooltip - keyboard focus',
  play: async ({ canvasElement }) => {
    /* `focusin` is a separate listener from the mouse pair, so the bubble is reachable
       without a pointer at all. Driven by dispatching at the wrapper rather than by
       `.focus()`, which fires nothing unless the page itself has focus - not something
       an automated run can guarantee. */
    const button = within(canvasElement).getByRole('button', {
      name: /^Change status for Kiko$/,
    });
    expect(await openGlassTooltip(button, { via: 'focus' })).toHaveTextContent(/^Change status$/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same bubble reached by keyboard. `GlassTooltip` listens for `focusin`/`focusout` ' +
          'alongside the mouse events, so a keyboard user gets the label too - worth drawing, ' +
          'because a hover-only tooltip on an icon-only button leaves those buttons unlabelled ' +
          'in practice.',
      },
    },
  },
};

export const ViewOnlyTooltip: Story = {
  name: 'Tooltip - read-only card',
  args: {
    canEditAppointments: false,
    canEditTasks: false,
    canEditCompanions: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(1);
    await openTooltipFor(canvasElement, /^View .*Kiko$/, /^View /);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A read-only member has one button, so the single bubble has the whole centred row to ' +
          'itself. Worth its own drawing because the bubble is clamped to the viewport rather than ' +
          'to the card, and a one-button row puts the trigger in a different place than a four- ' +
          'button one does.',
      },
    },
  },
};
