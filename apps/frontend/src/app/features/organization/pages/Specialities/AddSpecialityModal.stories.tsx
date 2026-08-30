import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import AddSpecialityModal from './AddSpecialityModal';

const ORG_ID = 'org-avenger-park';
const OTHER_ORG_ID = 'org-riverside';

const speciality = (id: string, name: string, organisationId: string): SpecialityRevamp => ({
  id,
  name,
  organisationId,
  teamMemberIds: [],
});

const created = async (name: string, organisationId: string): Promise<SpecialityRevamp> =>
  speciality(`spec-${name.toLowerCase().replace(/\s+/g, '-')}`, name, organisationId);

/**
 * The store action is the network. `addSpeciality` posts through `catalogApi`, so
 * the only way to reach the success and failure branches offline is to swap the
 * action itself on the store - the component reads it out of state on every render
 * (`useRevampCatalogStore((s) => s.addSpeciality)`), so a `setState` is enough and
 * nothing has to be module-mocked.
 */
const addSpeciality = fn(created);

const seed =
  ({ specialities = [], fails = false }: { specialities?: SpecialityRevamp[]; fails?: boolean }) =>
  () => {
    const snapshot = useRevampCatalogStore.getState();
    addSpeciality.mockClear();
    addSpeciality.mockImplementation(
      fails
        ? async () => {
            throw new Error('offline');
          }
        : created
    );
    useRevampCatalogStore.setState({ specialities, addSpeciality });
    return () => {
      useRevampCatalogStore.setState(snapshot);
    };
  };

/** ModalBase portals to document.body, so nothing here is inside canvasElement. */
const findDialog = async () => within(await within(globalThis.document.body).findByRole('dialog'));

const meta = {
  title: 'Organization/AddSpecialityModal',
  component: AddSpecialityModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The one-field dialog behind "Add speciality". Almost all of its behaviour is refusal, ' +
          'and all of it is client-side: a blank name and a name the organisation already uses are ' +
          'both rejected before anything is sent, so neither branch has ever been reachable from a ' +
          'static render.\n\n' +
          'The duplicate check is the interesting one. It compares `trim().toLowerCase()` against ' +
          'the store, and it is scoped by `organisationId` - the catalog store holds specialities ' +
          'for every organisation the user can see, so an unscoped check would refuse a name purely ' +
          'because some other practice uses it. Both halves of that are asserted, since they fail ' +
          'in opposite and equally silent directions.\n\n' +
          'There are two ways to submit and they do not share a code path: the "Add speciality" ' +
          'button is `type="button"` and calls the handler directly, while the field is the only ' +
          'one in the form, so Enter triggers implicit submission through `onSubmit`. `noValidate` ' +
          'is what lets an empty submit reach the JavaScript check at all rather than being ' +
          "swallowed by the browser's own required-field bubble. Both entry points are exercised.\n\n" +
          'Both actions pass `href="#"`, which `BaseButton` reads as *not* a link, so they render ' +
          'as `<button>` rather than anchors - a mistake there would be invisible until a keyboard ' +
          'user hit it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    organisationId: ORG_ID,
  },
  beforeEach: seed({}),
} satisfies Meta<typeof AddSpecialityModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Opened, nothing typed',
  play: async () => {
    const panel = await findDialog();

    await expect(panel.getByRole('heading', { name: 'Add speciality' })).toBeInTheDocument();
    const input = panel.getByLabelText('Speciality name');
    await expect(input).toHaveValue('');
    // Nothing is validated until a submit, so the field opens clean.
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();

    /* `href="#"` must not produce anchors. An <a href="#"> looks identical, takes
       focus the same way, and then navigates instead of submitting. */
    const cancel = panel.getByRole('button', { name: 'Cancel' });
    const add = panel.getByRole('button', { name: 'Add speciality' });
    await expect(cancel.tagName).toBe('BUTTON');
    await expect(add.tagName).toBe('BUTTON');

    /* Recorded, not endorsed: CenterModal takes `ariaLabel`/`ariaLabelledBy` and
       ModalHeader takes `titleId`, and this dialog wires up neither - so the
       visible "Add speciality" heading does not name the dialog for a screen
       reader. Wiring titleId through is the fix, and it will trip this line. */
    const dialog = globalThis.document.querySelector('dialog.yc-modal-dialog[open]');
    await expect(dialog).not.toBeNull();
    await expect(dialog).not.toHaveAttribute('aria-label');
    await expect(dialog).not.toHaveAttribute('aria-labelledby');
  },
};

export const NameRequired: Story = {
  name: 'Submitting a blank name',
  play: async ({ args }) => {
    const panel = await findDialog();
    const input = panel.getByLabelText('Speciality name');

    /* Enter, not the button: the field is `required`, and only the form's
       `noValidate` lets an empty submit reach the JS check instead of the
       browser's native bubble - which would leave this branch dead. */
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');

    await expect(await panel.findByRole('alert')).toHaveTextContent('Speciality name is required.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    // Refused locally: nothing was sent and the dialog stayed open.
    await expect(addSpeciality).not.toHaveBeenCalled();
    await expect(args.setShowModal).not.toHaveBeenCalled();

    /* The message clears on the next keystroke rather than on the next submit, so
       the user is not still being shouted at while they fix it. */
    await userEvent.type(input, 'D');
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();
    await expect(input).toHaveAttribute('aria-invalid', 'false');
  },
};

export const DuplicateName: Story = {
  name: 'A name this organisation already uses',
  beforeEach: seed({ specialities: [speciality('spec-derm', 'Dermatology', ORG_ID)] }),
  play: async ({ args }) => {
    const panel = await findDialog();
    const input = panel.getByLabelText('Speciality name');

    /* Different case and padded with spaces: the check normalises both sides, so
       "  dermatology  " has to be caught. Comparing raw strings would let a second
       "dermatology" through and leave the org with two of everything. */
    await userEvent.type(input, '  dermatology  ');
    await userEvent.click(panel.getByRole('button', { name: 'Add speciality' }));

    await expect(await panel.findByRole('alert')).toHaveTextContent(
      'A speciality with this name already exists.'
    );
    await expect(addSpeciality).not.toHaveBeenCalled();
    await expect(args.setShowModal).not.toHaveBeenCalled();
  },
};

export const AddsAndCloses: Story = {
  name: 'A name only another organisation uses',
  /* The catalog store is not scoped to one practice, so it holds specialities the
     user can see elsewhere. This seeds exactly the collision the org filter exists
     to allow through. */
  beforeEach: seed({ specialities: [speciality('spec-cardio', 'Cardiology', OTHER_ORG_ID)] }),
  play: async ({ args }) => {
    const panel = await findDialog();
    const input = panel.getByLabelText('Speciality name');

    await userEvent.type(input, '  Cardiology  ');
    await userEvent.click(panel.getByRole('button', { name: 'Add speciality' }));

    /* Trimmed on the way out, and sent against THIS organisation. An unscoped
       duplicate check would have refused this outright; a missing trim would
       persist the padding into the name. */
    await expect(addSpeciality).toHaveBeenCalledTimes(1);
    await expect(addSpeciality).toHaveBeenCalledWith('Cardiology', ORG_ID);
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();
    // Only a successful add closes the dialog.
    await expect(args.setShowModal).toHaveBeenCalledWith(false);
  },
};

export const AddFails: Story = {
  name: 'The add is refused by the server',
  beforeEach: seed({ fails: true }),
  play: async ({ args }) => {
    const panel = await findDialog();
    const input = panel.getByLabelText('Speciality name');

    await userEvent.type(input, 'Oncology');
    await userEvent.click(panel.getByRole('button', { name: 'Add speciality' }));

    await expect(addSpeciality).toHaveBeenCalledWith('Oncology', ORG_ID);
    /* The failure is reported by a toast and nowhere else: the dialog stays open
       with the typed name intact so the user can retry, and no inline error
       appears. If `handleClose` ever moved out of the try block this would close
       on failure and drop what they typed. */
    await expect(args.setShowModal).not.toHaveBeenCalled();
    await expect(input).toHaveValue('Oncology');
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const Closed: Story = {
  name: 'Closed',
  args: { showModal: false },
  play: async () => {
    /* The parent never unmounts this - it flips `showModal` - so the closed dialog
       is still in the DOM, and `inert` is the only thing keeping it out of the
       way. Note what is NOT hiding it: `<dialog>` without `open` is
       `display: none` per the UA sheet, but CenterModal's own `flex flex-col`
       overrides that, so the panel is laid out and merely transparent. */
    const dialog = globalThis.document.querySelector('dialog.yc-modal-dialog') as HTMLElement;
    await expect(dialog).not.toBeNull();
    await expect(dialog).not.toHaveAttribute('open');
    await expect(dialog).toHaveAttribute('inert');
    await expect(getComputedStyle(dialog).opacity).toBe('0');
    await expect(getComputedStyle(dialog).pointerEvents).toBe('none');

    /* The consequence that actually strands someone: without `inert` the name
       field is a tab stop sitting invisibly on top of the page behind it. */
    await userEvent.tab();
    await expect(dialog.contains(globalThis.document.activeElement)).toBe(false);
  },
};
