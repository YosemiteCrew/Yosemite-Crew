import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import AddCompanionCentralModal from './index';

/** Open dialogs only. A closed one stays mounted, just without its `open` attribute. */
const openDialogs = (): HTMLDialogElement[] =>
  [...document.querySelectorAll('dialog[open]')] as HTMLDialogElement[];

/**
 * Real `showModal` state, so the discard flow can actually close the modal and a
 * story can tell "the confirm was dismissed" apart from "everything closed".
 */
const Harness = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[640px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Companions list behind the modal. The desktop shell portals to `document.body`; the phone
        sheet does not.
      </p>
      <AddCompanionCentralModal showModal={open} setShowModal={setOpen} />
    </div>
  );
};

/** Types a patient name, which is the cheapest way to make the form dirty. */
const makeDirty = async () => {
  const body = within(document.body);
  const name = await body.findByRole('textbox', { name: 'Name' });
  await userEvent.type(name, 'Poppy');
  return name;
};

const meta = {
  title: 'Companions/AddCompanionCentralModal',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    // `useRouter` is called for the "open overview" jump in view mode; without
    // the app-router mock the modal throws on mount even though create mode
    // never navigates.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The add-companion wizard, and the two surfaces around it that no prop can reach.\n\n' +
          'The first is the **nested "Discard changes?" confirm**. It is a `CenterModal` ' +
          'rendered beside the main shell, gated on `showDiscardConfirm`, and the only thing that ' +
          'sets that flag is an attempted close while `hasUnsavedChanges` is true. Dirtiness is ' +
          'computed against a baseline snapshot over seven fields (name, species, breed, first, ' +
          'last, email, phone), so a story has to type into the form before the surface exists ' +
          'at all. With it open there are **two dialogs open at once**, which is the case the ' +
          'modal stack in `ModalBase` exists for - Escape and backdrop clicks must reach only ' +
          'the topmost one, or dismissing the confirm would take the half-filled form with it.\n\n' +
          'The second is the **phone bottom sheet**. `formVariant` is `sheet` only when ' +
          '`isCreate && isPhone`, and `useIsPhone` is false during SSR and the first client ' +
          'render, so this is a post-mount swap that no static desktop snapshot contains. The ' +
          'sheet is also structurally different, not just narrower: `BottomSheet` renders its ' +
          '`<dialog>` inline rather than through a portal, it supplies its own grabber and close ' +
          'row, and the wizard footer drops its inline Cancel because the sheet header already ' +
          'offers one.\n\n' +
          'No service is stubbed. The species and breed code lookups both fire on mount and both ' +
          'swallow their own failures (`.catch` -> `DEFAULT_SPECIES_OPTIONS` / `[]`), and the ' +
          'parent search only runs on a keystroke in the client column, so create mode renders ' +
          'fully from an unseeded store.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WizardStepOne: Story = {
  name: 'Create wizard (step 1)',
  play: async () => {
    const body = within(document.body);

    /* One dialog, and it is portalled - so `within(canvasElement)` sees none of
       this. The confirm's own CenterModal is already mounted alongside it
       without `open`, which is why absence is asserted against `dialog[open]`
       rather than against the node existing. */
    await waitFor(() => expect(openDialogs()).toHaveLength(1));

    await expect(body.getByTestId('add-companion-step-subtitle')).toHaveTextContent(
      'Step 1 of 2 · patient details'
    );
    await expect(body.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    await expect(body.getByRole('button', { name: 'Parent details' })).toBeInTheDocument();
    await expect(body.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // Step 2's fields are not merely hidden, they are unmounted - the wizard
    // renders one column at a time.
    await expect(body.queryByRole('textbox', { name: 'First name' })).not.toBeInTheDocument();
    /* The confirm's copy is ALREADY in the DOM - its CenterModal is mounted
       unconditionally and merely lacks `open` - so "not shown" has to be
       asserted as not visible. `not.toBeInTheDocument()` here would fail against
       a perfectly correct closed dialog. */
    await expect(body.getByText('Discard changes?')).not.toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state every other story starts from: the centered shell, step 1 of the wizard, ' +
          'clean. Cancel closes immediately from here, because nothing is dirty yet.',
      },
    },
  },
};

export const DiscardConfirm: Story = {
  name: 'Discard changes? (nested confirm)',
  play: async () => {
    const body = within(document.body);
    await makeDirty();

    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));

    // TWO open dialogs: the create shell and the confirm stacked over it. This is
    // the assertion that proves the parent survived - a confirm that closed its
    // own parent would leave exactly one.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    const confirm = body.getByText('Discard changes?').closest('dialog') as HTMLElement;
    await expect(
      within(confirm).getByText('You have unsaved changes. Are you sure you want to discard them?')
    ).toBeInTheDocument();

    /* Two plain `<button>`s, not the Primary/Secondary pills used everywhere else
       in this modal - "Keep editing" is an outlined 2xl button and "Discard" is a
       `.yc-primary-button`. The destructive action is the FILLED one here, which
       is the opposite of the usual pairing and worth seeing drawn. */
    const keep = within(confirm).getByRole('button', { name: 'Keep editing' });
    const discard = within(confirm).getByRole('button', { name: 'Discard' });
    await expect(keep).toBeInTheDocument();
    await expect(discard).toHaveClass('yc-primary-button');
    // Poll rather than read once: both carry `transition-colors`, so a single
    // synchronous read can land mid-transition on an interpolated value.
    await waitFor(() => {
      expect(getComputedStyle(discard).backgroundColor).not.toBe(
        getComputedStyle(keep).backgroundColor
      );
    });

    // The typed value is still behind the confirm, untouched.
    await expect(body.getByRole('textbox', { name: 'Name' })).toHaveValue('Poppy');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type a patient name, then hit Cancel. The confirm is a 500px `CenterModal` over a ' +
          "`--sh55` scrim with a 6px blur, sitting on top of the shell's own 2px-blur scrim - " +
          'so the page behind it is blurred twice.',
      },
    },
  },
};

export const KeepEditing: Story = {
  name: 'Keep editing returns to the form',
  play: async () => {
    const body = within(document.body);
    await makeDirty();
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    await userEvent.click(body.getByRole('button', { name: 'Keep editing' }));

    /* Back to one dialog, and the form still holds what was typed. Asserting the
       count alone would pass if the WRONG dialog had closed, so the surviving
       field value is checked too. */
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await expect(body.getByRole('textbox', { name: 'Name' })).toHaveValue('Poppy');
    await expect(body.getByTestId('add-companion-step-subtitle')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The recovery path. "Keep editing" also clears the pending "go to appointment" flag, so ' +
          'a later clean close goes back to closing the modal rather than navigating away.',
      },
    },
  },
};

export const DiscardAndClose: Story = {
  name: 'Discard closes both',
  play: async () => {
    const body = within(document.body);
    await makeDirty();
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    await userEvent.click(body.getByRole('button', { name: 'Discard' }));

    // Nothing open. Both dialogs are still in the DOM - they always are - so this
    // has to be counted over `dialog[open]`.
    await waitFor(() => expect(openDialogs()).toHaveLength(0));

    /* BOTH of them, checked separately. The count alone would be satisfied by a
       single surviving-but-closed dialog if the other had been unmounted, and it
       says nothing about which one closed - so the confirm's copy and the
       wizard's own subtitle are each asserted invisible. */
    await expect(body.getByText('Discard changes?')).not.toBeVisible();
    await expect(body.getByTestId('add-companion-step-subtitle')).not.toBeVisible();
    /* And the trap itself, pinned rather than avoided. A closed `<dialog>` is
       `display: none` per the UA sheet, but the panel's own `flex` class beats
       that rule, so this dialog stays laid out and its subtree stays in the
       accessibility tree as far as testing-library is concerned: the field is
       still FOUND by role. `inert` is what actually removes it for a real
       screen reader, and `isInaccessible` does not model `inert` at all.
       Asserting all three - found, invisible, inside a closed inert dialog -
       states the real shape of "the modal is gone" instead of the
       `not.toBeInTheDocument()` that was here, which described a DOM this app
       never produces. */
    const name = body.getByRole('textbox', { name: 'Name' });
    await expect(name).not.toBeVisible();
    const shell = name.closest('dialog') as HTMLDialogElement;
    await expect(shell).not.toHaveAttribute('open');
    await expect(shell).toHaveAttribute('inert');
    await expect(getComputedStyle(shell).display).toBe('flex');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirm closes itself and then closes the shell, in that order. Both dialogs stay ' +
          'mounted and merely lose `open`, which is why "the modal is gone" is only true of the ' +
          '`open` attribute.\n\n' +
          'It is truer than that, even: the panel class list includes `flex`, which overrides ' +
          'the user-agent `dialog:not([open]) { display: none }`, so a closed shell keeps a ' +
          'laid-out subtree and is hidden by `opacity-0` and `pointer-events-none` alone. What ' +
          'takes it away from assistive tech is `inert` - and that is invisible to ' +
          'testing-library, so every field in a closed modal is still findable by role.',
      },
    },
  },
};

export const PhoneSheet: Story = {
  name: 'Phone: create becomes a bottom sheet',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story pinned that way renders the desktop
  // centered modal under a name that promises a sheet.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const body = within(document.body);

    // `useIsPhone` starts false and flips after mount, so the sheet is a
    // post-mount swap - poll for it rather than reading once.
    await waitFor(() => {
      const dialogs = openDialogs();
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0].className).toContain('yc-phone-sheet');
    });
    const sheet = openDialogs()[0];

    /* Structurally different, not just narrower: BottomSheet renders its dialog
       INLINE, so unlike every other modal in this flow it lives inside the
       story canvas. */
    await expect(canvasElement.contains(sheet)).toBe(true);

    // Sheet chrome: grabber, title row with its own close, and the pinned footer.
    await expect(sheet.querySelector('.yc-phone-sheet-grabber')).not.toBeNull();
    await expect(sheet.querySelector('.yc-phone-sheet-footer')).not.toBeNull();
    await expect(within(sheet).getByTestId('add-companion-step-subtitle')).toHaveTextContent(
      'Step 1 of 2 · patient details'
    );

    /* The footer drops its inline Cancel in the sheet variant - the header X is
       the close affordance - while keeping the step dots and the advance button.
       That omission is the one visible behaviour difference in the footer, so it
       is asserted rather than left to the eye. */
    const footer = sheet.querySelector('.yc-phone-sheet-footer') as HTMLElement;
    await expect(
      within(footer).getByRole('button', { name: 'Parent details' })
    ).toBeInTheDocument();
    await expect(within(footer).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    /* The desktop `AppointmentCentralModalShell` is an early-return branch, so in
       the phone create path it is never constructed at all. One `.yc-modal-dialog`
       IS still in the DOM - the discard confirm's CenterModal, which both branches
       render unconditionally - so this has to be counted over `[open]` rather than
       over the class, and the confirm's copy is checked for visibility rather
       than presence. */
    await expect(body.getByText('Discard changes?')).not.toBeVisible();
    await expect(document.querySelectorAll('.yc-modal-dialog')).toHaveLength(1);
    await expect(document.querySelector('.yc-modal-dialog[open]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the create flow re-forms into a bottom sheet: 24px top radius, a 44x5 ' +
          'grabber, a title + close row, and the wizard footer pinned to the bottom in ' +
          '`.yc-phone-sheet-footer`. Edit and view keep the centered modal at every width, so ' +
          'this swap belongs to the create path alone.',
      },
    },
  },
};

export const PhoneDiscardConfirm: Story = {
  name: 'Phone: discard confirm over the sheet',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    await waitFor(() => {
      expect(openDialogs()[0]?.className).toContain('yc-phone-sheet');
    });
    const sheet = openDialogs()[0];

    await makeDirty();

    /* TWO controls are labelled "Close" here - the sheet's X and the full-screen
       backdrop button behind it - so this has to be scoped to the sheet. A bare
       `getByRole('button', { name: 'Close' })` throws on the ambiguity. */
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(2));

    /* VISIBLE, not merely present. `discardConfirm` is rendered unconditionally in
       both branches of this component, so "Discard changes?" is in the DOM from
       the first paint and `toBeInTheDocument()` here would pass against a confirm
       that never opened.

       Polled, because `CenterModal` fades: its panel carries `transition-opacity
       duration-100` and flips `opacity-0` -> `opacity-100` in the same commit
       that sets `open`, so the `waitFor` above returns while the computed
       opacity is still exactly `0`. Everything asserted visible below this line
       is safe once the fade has landed. */
    await waitFor(() => expect(body.getByText('Discard changes?')).toBeVisible());

    /* The confirm does NOT re-form for phones: it stays the portalled CenterModal
       at `w-[90%]`, layered over an in-canvas sheet. Two dialogs from two
       different mounting strategies is exactly the arrangement that breaks
       focus traps, so both are pinned here. */
    const [first, second] = openDialogs();
    await expect(first.className).toContain('yc-phone-sheet');
    await expect(second.className).toContain('yc-modal-dialog');

    /* The confirm's own copy and buttons, scoped to it - and the sheet behind it
       still holding what was typed, which is what makes this a layering story
       rather than a "something opened" one. */
    await expect(
      within(second).getByText('You have unsaved changes. Are you sure you want to discard them?')
    ).toBeVisible();
    await expect(within(second).getByRole('button', { name: 'Keep editing' })).toBeVisible();
    await expect(within(second).getByRole('button', { name: 'Discard' })).toBeVisible();
    await expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveValue('Poppy');

    /* The two mounting strategies, made checkable: the sheet renders inline and so
       lives in the story canvas, while the confirm is portalled and sits outside
       it as a direct child of `document.body`. Asserting the containment is what
       proves the claim above - a class-name check would still pass if both had
       ended up in the same tree. */
    await expect(canvasElement.contains(first)).toBe(true);
    await expect(canvasElement.contains(second)).toBe(false);
    await expect(document.body.contains(second)).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dirty-close path on a phone. The sheet stays put and the same centered confirm ' +
          'appears over it, so on a 375px screen the confirm is the only element that is not ' +
          'bottom-anchored.',
      },
    },
  },
};
