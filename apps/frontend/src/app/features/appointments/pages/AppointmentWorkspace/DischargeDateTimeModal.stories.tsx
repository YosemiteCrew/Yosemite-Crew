import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { WorkspaceFinalizationGate } from '@/app/features/appointments/types/workspace';

import { DischargeDateTimeModal } from './index';

type DischargeModalProps = ComponentProps<typeof DischargeDateTimeModal>;

/** Fixed so the two picker buttons carry stable accessible names in every story. */
const DISCHARGE_DATE = new Date(2026, 7, 19, 14, 30);
const DATE_BUTTON = 'Discharge date: Aug 19, 2026, toggle calendar';
const TIME_BUTTON = 'Discharge time: 14:30';
const OVERRIDE_LABEL = 'Override reason (required)';

const GATE_REASON =
  'Two lab results are still pending and the invoice has not been marked ready for billing.';

const BLOCKED_GATE: WorkspaceFinalizationGate = {
  enabled: false,
  disabledReason: GATE_REASON,
  requiredSoapOrDischargeComplete: true,
  requiredFormsSigned: true,
  pendingLabsResolved: false,
  billingReady: false,
};

const CLEAR_GATE: WorkspaceFinalizationGate = {
  enabled: true,
  requiredSoapOrDischargeComplete: true,
  requiredFormsSigned: true,
  pendingLabsResolved: true,
  billingReady: true,
};

/* ------------------------------------------------------------------ *
 * Contrast measurement
 *
 * `--color-danger-100` is a flat `#fdebea` in light but `rgba(234, 55, 41,
 * 0.18)` in dark, so in dark what the reader sees behind the override panel is
 * that red composited over the dialog's own `--color-neutral-0`. Reading one
 * `backgroundColor` therefore proves nothing there: it returns the declared
 * translucent value, not the colour on screen. These helpers composite the
 * layers in paint order, which is the only way to compare an ink against the
 * ground it actually lands on.
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number; a: number };

const OPAQUE_WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

/**
 * Throws rather than guessing on anything that is not `rgb()`/`rgba()`.
 * Chrome serializes `oklch()` back as `oklch()`, and a silent misparse of one
 * would turn every ratio below into a number that means nothing while still
 * passing - the exact failure mode this file exists to catch.
 */
const parseRgb = (value: string): Rgb => {
  if (!value.startsWith('rgb')) {
    throw new Error(`Expected an rgb()/rgba() computed colour, got "${value}"`);
  }
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
};

/** `top` painted over `bottom`, in sRGB, the way the compositor does it. */
const composite = (top: Rgb, bottom: Rgb): Rgb => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

/**
 * The opaque colour painted at `start`, including `start`'s own background.
 *
 * The walk deliberately begins at the element rather than at its parent. An
 * element's own background is part of the ground its text sits on, and the
 * override textarea here is one `bg-*` class away from having one: a parent-up
 * walk would then keep measuring the ink against the status tint it no longer
 * touches and report a ratio for a pairing that is not on screen.
 */
const groundAt = (start: HTMLElement | null): Rgb => {
  const layers: Rgb[] = [];
  let node = start;
  while (node) {
    const layer = parseRgb(getComputedStyle(node).backgroundColor);
    if (layer.a > 0) layers.push(layer);
    if (layer.a === 1) break;
    node = node.parentElement;
  }
  // layers[0] is nearest the element, so composite from the bottom of the stack up.
  return layers.reduceRight((under, layer) => composite(layer, under), OPAQUE_WHITE);
};

const channel = (value: number): number => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrastRatio = (ink: Rgb, ground: Rgb): number => {
  const inkL = luminance(ink);
  const groundL = luminance(ground);
  return (Math.max(inkL, groundL) + 0.05) / (Math.min(inkL, groundL) + 0.05);
};

/**
 * How far a ground leans red: how far the red channel outruns the other two.
 *
 * Used instead of a contrast ratio between the tint and the dialog, because in
 * light those two are `#fdebea` on `#f7f3ec` - 1.04:1, by design. A "they are
 * different colours" assertion therefore passes on a one-digit difference and
 * proves nothing. The hue lean is what actually separates a status tint from
 * the surface: 18.5 vs 7.5 in light, 44 vs 12.5 in dark. A `--color-danger-100`
 * that collapsed onto the neutral surface would land inside a point of it.
 */
const redness = ({ r, g, b }: Rgb): number => r - (g + b) / 2;

const rgbString = ({ r, g, b }: Rgb): string =>
  `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

/**
 * Asserts an ink is not the colour of the ground under it, and clears AA.
 *
 * Polled rather than read once: the dialog fades in on a `transition-opacity`
 * and several controls carry `transition-colors`, so a single synchronous read
 * can land on an interpolated frame and either pass or fail for the wrong
 * reason.
 */
const expectReadable = (el: HTMLElement, minRatio = 4.5) =>
  waitFor(() => {
    const ground = groundAt(el);
    const ink = composite(parseRgb(getComputedStyle(el).color), ground);
    expect(rgbString(ink)).not.toBe(rgbString(ground));
    expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(minRatio);
  });

/** `ModalBase` portals to `document.body`, so nothing here is in `canvasElement`. */
const openPanel = async (): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(document.querySelector('dialog[open]')).toBeInTheDocument();
  });
  return document.querySelector('dialog[open]') as HTMLElement;
};

/**
 * Real state behind the four setters the component drives.
 *
 * `showModal` stays arg-driven (the harness only records a dismissal) so the
 * Closed story still works from args alone, while the date, time and override
 * reason are held locally - without that the textarea is read-only and the
 * override branch cannot be reached at all.
 */
const Harness = ({
  showModal,
  setShowModal,
  dischargeDate,
  setDischargeDate,
  dischargeTime,
  setDischargeTime,
  overrideReason,
  setOverrideReason,
  ...rest
}: DischargeModalProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [date, setDate] = useState<Date | null>(dischargeDate);
  const [time, setTime] = useState(dischargeTime);
  const [reason, setReason] = useState(overrideReason);
  const isOpen = showModal && !dismissed;

  return (
    <div className="min-h-[560px] bg-[var(--page)] p-6">
      <p className="text-body-4 text-[var(--ink-muted)]">
        The Summary step behind the scrim. The dialog is opened from the terminal action there, so
        the backdrop tint and blur are part of what this surface looks like.
      </p>
      <DischargeDateTimeModal
        {...rest}
        showModal={isOpen}
        setShowModal={(next) => {
          const value = typeof next === 'function' ? next(isOpen) : next;
          setDismissed(!value);
          setShowModal(value);
        }}
        dischargeDate={date}
        setDischargeDate={(next) => {
          setDate(next);
          setDischargeDate(next);
        }}
        dischargeTime={time}
        setDischargeTime={(next) => {
          setTime(next);
          setDischargeTime(next);
        }}
        overrideReason={reason}
        setOverrideReason={(next) => {
          setReason(next);
          setOverrideReason(next);
        }}
      />
    </div>
  );
};

/**
 * The whole point of this file. Shared by the light and dark gate stories so
 * the two measure exactly the same inks against exactly the same grounds.
 */
const assertBlockedGate = async () => {
  const dialog = await openPanel();
  const panel = within(dialog);

  await expect(panel.getByRole('heading', { name: 'Discharge date & time' })).toBeInTheDocument();

  const reason = panel.getByText(GATE_REASON);
  const tint = reason.parentElement as HTMLElement;
  const label = panel.getByText(OVERRIDE_LABEL);
  // One field, and it is the one the label names - the textarea is wrapped by
  // the <label> rather than wired with htmlFor, which is easy to break silently.
  await expect(panel.getAllByRole('textbox')).toHaveLength(1);
  const field = panel.getByLabelText(OVERRIDE_LABEL);
  await expect(field).toHaveAttribute('rows', '2');

  /* Two children, stacked: the refusal sentence then the labelled field. A tint
     that lost its `flex-col` puts the sentence and the textarea side by side at
     roughly half width each, which no colour assertion would notice. */
  await expect(tint.children).toHaveLength(2);
  await expect(tint.children[0]).toBe(reason);
  await expect(tint.children[1]).toBe(label);
  await expect(getComputedStyle(tint).flexDirection).toBe('column');

  /* And it sits above the fields it is refusing, not under them. The panel is
     rendered before the picker column in JSX and nothing else enforces that. */
  const dateButton = panel.getByRole('button', { name: DATE_BUTTON });
  await expect(tint.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    dateButton.getBoundingClientRect().top
  );

  /* The tint has to read as its own ground. If `--color-danger-100` collapsed
     onto the dialog's `--color-neutral-0` the panel would still be in the tree,
     still hold its text, and be invisible - which is how PackageBreakdownTooltip
     shipped a seven-column table at 1.00:1 in both themes. Asserting only that
     the two differ is not enough here: in light they are legitimately 1.04:1
     apart, so that check passes on a single-digit drift. The hue lean is the
     thing that separates a status tint from a surface. */
  await waitFor(() => {
    const tintGround = groundAt(tint);
    const dialogGround = groundAt(tint.parentElement);
    expect(rgbString(tintGround)).not.toBe(rgbString(dialogGround));
    expect(redness(tintGround) - redness(dialogGround)).toBeGreaterThanOrEqual(8);
  });

  // Three separate inks, all of them on that tint rather than on the dialog.
  await expectReadable(reason);
  await expectReadable(label);

  // The confirm is relabelled and inert until a reason exists; cancel is not.
  await expect(panel.getByRole('button', { name: 'Override & discharge' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  await expect(panel.queryByRole('button', { name: 'Confirm discharge' })).not.toBeInTheDocument();

  await userEvent.type(field, 'Owner collecting early against advice.');
  await expect(field).toHaveValue('Owner collecting early against advice.');
  // The textarea declares no background of its own, so the typed ink lands
  // straight on the tint too - measured only now that there is real text in it.
  await expectReadable(field);
  await expect(panel.getByRole('button', { name: 'Override & discharge' })).toBeEnabled();
};

const meta = {
  title: 'Workspace/DischargeDateTimeModal',
  component: DischargeDateTimeModal,
  render: (args) => <Harness {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The confirmation dialog for discharging an inpatient encounter, and the only place in ' +
          "the product where a clinician can discharge against the backend's own readiness " +
          'gate.\n\n' +
          'It was declared as a module-private const inside `AppointmentWorkspace/index.tsx`, ' +
          'mounted from `sharedModals` behind `isSummaryDischargeModalOpen`. Reaching it through ' +
          'its parent means faking the entire workspace bootstrap aggregate - an appointment, an ' +
          'encounter in an inpatient state, a room unit, a catalog - so it is exported now and ' +
          'drawn directly.\n\n' +
          'The branch worth drawing is `gate.enabled === false`. When the backend says the ' +
          'encounter is not ready, the dialog grows a `bg-danger-100` panel carrying the refusal ' +
          'sentence, a required override-reason textarea, and a confirm button relabelled ' +
          '"Override & discharge" that stays disabled until the reason is non-blank. **Every ink ' +
          "in that panel sits on a status tint rather than on the dialog's own " +
          '`--color-neutral-0`**: the sentence is `text-text-error` (`--danger-text`), the field ' +
          'label is `text-text-secondary` (`--ink-muted`), and the textarea declares no ' +
          'background at all, so its `text-text-primary` (`--ink-body`) lands on the tint as ' +
          'well.\n\n' +
          'That is the same arrangement that broke `PackageBreakdownTooltip`, where `--ink` and ' +
          '`--screen` resolved to one value and a seven-column table rendered at 1.00:1 in both ' +
          'themes for months - undetected, because no story had ever opened it. Here the dark ' +
          'tint is not even opaque: `--color-danger-100` is `rgba(234, 55, 41, 0.18)`, so the ' +
          'ground is that red composited over `--screen`, and no class name says whether the ' +
          'result is legible.\n\n' +
          'So the stories measure it rather than describe it. They composite the translucent ' +
          'layers in paint order, starting at the ink-bearing element itself, and assert the ' +
          'resulting ground both differs from the ink and clears 4.5:1 - in light and in dark. ' +
          'Measured: light 6.23 / 6.05 / 11.6, dark 5.49 / **4.69** / 9.20. The field label in ' +
          'dark is the pairing with no headroom left.\n\n' +
          'The tint itself is checked by hue lean rather than by contrast against the dialog, ' +
          'because in light `#fdebea` on `#f7f3ec` is 1.04:1 on purpose - a "these are different ' +
          'colours" assertion would pass on a token that had drifted to within one digit of the ' +
          'surface.\n\n' +
          'Two behaviours are also only reachable from a play function. `isSaving` locks the ' +
          'pickers by inheritance (`pointer-events: none` on their column, not a `disabled` ' +
          'attribute), and the `isSaving` guard in `handleCancel` covers the Cancel and header ' +
          'close controls but **not** Escape: `ModalBase` sets `showModal` to false itself before ' +
          'calling `onClose`, so a discharge already in flight can still be dismissed with a ' +
          'keypress.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    dischargeDate: DISCHARGE_DATE,
    setDischargeDate: fn(),
    dischargeTime: '14:30',
    setDischargeTime: fn(),
    onConfirm: fn(),
    isSaving: false,
    gate: CLEAR_GATE,
    overrideReason: '',
    setOverrideReason: fn(),
  },
} satisfies Meta<typeof DischargeDateTimeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GateClear: Story = {
  name: 'Gate clear (ordinary discharge)',
  play: async ({ args }) => {
    const dialog = await openPanel();
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'Discharge date & time' })).toBeInTheDocument();
    // Both pickers carry the values passed in, not placeholders.
    await expect(panel.getByRole('button', { name: DATE_BUTTON })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: TIME_BUTTON })).toBeInTheDocument();

    // No tinted panel, no override field, and the plain confirm label.
    await expect(panel.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(panel.queryByText(OVERRIDE_LABEL)).not.toBeInTheDocument();
    const confirm = panel.getByRole('button', { name: 'Confirm discharge' });
    await expect(confirm).toBeEnabled();

    /* Two actions, in this order, on one row. The row is `flex-wrap` over a
       `min-w-30` cancel and a `min-w-36` confirm; at the 500px desktop width
       they have 474px of content box to share and must not wrap. */
    const actions = confirm.parentElement as HTMLElement;
    await expect(actions.children).toHaveLength(2);
    await expect(Array.from(actions.children).map((child) => child.textContent)).toEqual([
      'Cancel',
      'Confirm discharge',
    ]);
    await expect(getComputedStyle(actions).flexWrap).toBe('wrap');
    const [cancelTop, confirmTop] = Array.from(actions.children).map(
      (child) => child.getBoundingClientRect().top
    );
    await expect(Math.abs(cancelTop - confirmTop)).toBeLessThanOrEqual(1);

    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    /* Confirming does not close anything by itself - the parent dismisses the
       dialog once the discharge mutation resolves, which is what leaves room for
       the in-flight state below. */
    await expect(document.querySelector('dialog[open]')).toBeInTheDocument();
    await expect(args.setShowModal).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the dialog is 95% of the time: a header, a date and a time, and two pill actions. ' +
          'The date button reads `Aug 19, 2026` from the `MMM d, yyyy` format inside `Datepicker` ' +
          'while the time button reads the raw `14:30` string - the two pickers disagree on ' +
          'format, which is only visible with them stacked.',
      },
    },
  },
};

export const GateBlocked: Story = {
  name: 'Gate blocked (override required)',
  args: { gate: BLOCKED_GATE },
  play: assertBlockedGate,
  parameters: {
    docs: {
      description: {
        story:
          'The branch nothing had drawn. A `rounded-2xl bg-danger-100 p-3` panel slides in above ' +
          "the pickers with the backend's own sentence, a two-row textarea and a relabelled " +
          'confirm. In light the tint is a flat `#fdebea` and the sentence is `#a6271d` on it, ' +
          'measured here at 6.23:1. The play function types a reason, so the field ink is checked ' +
          'against real text rather than against a placeholder, and the confirm is asserted to ' +
          'flip from disabled to enabled on the first non-blank character.',
      },
    },
  },
};

export const GateBlockedDark: Story = {
  name: 'Gate blocked (dark)',
  args: { gate: BLOCKED_GATE },
  globals: { theme: 'dark' },
  play: assertBlockedGate,
  parameters: {
    docs: {
      description: {
        story:
          'The same measurements against a ground that no longer exists as a single colour. ' +
          '`--color-danger-100` flips from `#fdebea` to `rgba(234, 55, 41, 0.18)`, so the panel ' +
          "is red at 18% over the dialog's `#2f271e` - `rgb(81, 42, 32)` once composited. " +
          'Against it the sentence reads 5.49:1, the field label 4.69:1 and the typed text ' +
          '9.20:1. The label is the one with no headroom left, which is exactly the pairing a ' +
          'token sweep would break silently.',
      },
    },
  },
};

export const GateBlockedNoReason: Story = {
  name: 'Gate blocked, no reason supplied',
  args: { gate: { enabled: false } },
  play: async () => {
    const dialog = await openPanel();
    const panel = within(dialog);

    // The fallback sentence, not an empty tinted box - and not a stale render of
    // the seeded reason the other gate stories use.
    const fallback = panel.getByText('This encounter is not ready for discharge.');
    await expect(panel.queryByText(GATE_REASON)).not.toBeInTheDocument();
    await expectReadable(fallback);

    // Same two-child panel as the reasoned variant, so only the sentence changed.
    const tint = fallback.parentElement as HTMLElement;
    await expect(tint.children).toHaveLength(2);
    await expect(tint.children[0]).toBe(fallback);
    await expect(panel.getByLabelText(OVERRIDE_LABEL)).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Override & discharge' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A gate that refuses without saying why. The backend contract makes `disabledReason` ' +
          'optional, so the panel falls back to "This encounter is not ready for discharge." - ' +
          'the clinician is asked to justify an override against a requirement the dialog cannot ' +
          'name. Worth seeing, because it is the state that makes the override reason field ' +
          'unanswerable.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Discharge in flight',
  args: { isSaving: true, gate: BLOCKED_GATE, overrideReason: 'Owner collecting against advice.' },
  play: async ({ args }) => {
    const dialog = await openPanel();
    const panel = within(dialog);

    // The label is the progress indicator - there is no spinner anywhere here.
    const confirm = panel.getByRole('button', { name: 'Discharging...' });
    const cancel = panel.getByRole('button', { name: 'Cancel' });
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();
    // `isDisabled` on these pills is a real `disabled` plus `opacity-60`, so the
    // dim is measurable rather than a claim about a class name.
    await waitFor(() => {
      expect(getComputedStyle(confirm).opacity).toBe('0.6');
      expect(getComputedStyle(cancel).opacity).toBe('0.6');
    });

    /* The pickers are not disabled elements, and they are not dimmed either.
       Their column carries `pointer-events-none` and the property inherits, so
       the buttons compute `none` while keeping every resting style including
       full opacity - the combination that reads as clickable and is not. */
    const dateButton = panel.getByRole('button', { name: DATE_BUTTON });
    const timeButton = panel.getByRole('button', { name: TIME_BUTTON });
    await expect(getComputedStyle(dateButton).pointerEvents).toBe('none');
    await expect(getComputedStyle(timeButton).pointerEvents).toBe('none');
    await expect(getComputedStyle(dateButton).opacity).toBe('1');
    await expect(dateButton).toBeEnabled();

    /* The header close is NOT disabled - `ModalHeader` is called without
       `isCloseDisabled` - so it stays a live, focusable control that swallows
       its own click. Clicking it must leave the dialog open. */
    const close = panel.getByRole('button', { name: 'Close' });
    await expect(close).toBeEnabled();
    await userEvent.click(close);
    await expect(document.querySelector('dialog[open]')).toBeInTheDocument();
    await expect(args.setShowModal).not.toHaveBeenCalled();
    // Still the in-flight label, so nothing re-rendered its way out of the state.
    await expect(panel.getByRole('button', { name: 'Discharging...' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state between clicking confirm and the encounter closing. The two footer pills go ' +
          'to `opacity-60` and take a real `disabled`; the pickers do neither. They go inert by ' +
          'inheriting `pointer-events: none` from their column, so they keep full-contrast ' +
          'resting styling and stay in the tab order while refusing the pointer - a combination ' +
          'that reads as "clickable" and is not. The header close is the sharper problem: it is ' +
          'enabled, focusable and does nothing.',
      },
    },
  },
};

export const SavingEscapes: Story = {
  name: 'Escape dismisses a discharge in flight',
  args: { isSaving: true, gate: BLOCKED_GATE, overrideReason: 'Owner collecting against advice.' },
  play: async ({ args }) => {
    await openPanel();
    await userEvent.keyboard('{Escape}');

    /* A closed dialog stays MOUNTED without its `open` attribute, so this has
       to be asserted against `dialog[open]` rather than against the text. */
    await waitFor(() => {
      expect(document.querySelector('dialog[open]')).toBeNull();
    });
    await expect(args.setShowModal).toHaveBeenCalledWith(false);

    /* Dismissed, not unmounted, and not cancelled either: the shell, the gate
       panel and the typed override reason are all still there, held out of the
       tab order by `inert` alone while the discharge request keeps running. */
    const dialog = document.querySelector('dialog') as HTMLElement;
    await expect(dialog).toHaveAttribute('inert');
    await expect(within(dialog).getByText(GATE_REASON)).toBeInTheDocument();
    await expect(within(dialog).getByLabelText(OVERRIDE_LABEL)).toHaveValue(
      'Owner collecting against advice.'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gap in the guard. `handleCancel` returns early while `isSaving`, which is why the ' +
          'Cancel button and the header close do nothing - but Escape never reaches it in a ' +
          'state to be refused. `ModalBase.closeModal` calls `setShowModal(false)` first and ' +
          '`onClose` second, so the dialog is already gone by the time the guard runs. The ' +
          'request is still in flight; only its confirmation UI has left. Asserted as current ' +
          'behaviour, not as intended behaviour.',
      },
    },
  },
};

export const GateBlockedPhone: Story = {
  name: 'Gate blocked at 375',
  args: { gate: BLOCKED_GATE },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    const dialog = await openPanel();
    const panel = within(dialog);

    // Proves the viewport global took: an unpinned story renders at 1280 here.
    await expect(window.innerWidth).toBeLessThanOrEqual(375);

    /* `CenterModal` is `w-[90%] sm:w-[500px]`, so below the 640px breakpoint the
       panel tracks the viewport instead of the fixed desktop width. */
    const width = dialog.getBoundingClientRect().width;
    await expect(width).toBeLessThan(375);
    await expect(width).toBeGreaterThan(320);

    await expect(panel.getByText(GATE_REASON)).toBeInTheDocument();
    await expect(panel.getByLabelText(OVERRIDE_LABEL)).toHaveAttribute('rows', '2');

    /* Both pickers stay stacked and full-bleed. Each is `w-full` inside a
       `flex-col` column, so a dropped width class shows up here as two unequal
       buttons or as a pair that shares a row. */
    const dateBox = panel.getByRole('button', { name: DATE_BUTTON }).getBoundingClientRect();
    const timeBox = panel.getByRole('button', { name: TIME_BUTTON }).getBoundingClientRect();
    await expect(Math.abs(dateBox.width - timeBox.width)).toBeLessThanOrEqual(1);
    await expect(dateBox.width).toBeGreaterThan(280);
    await expect(timeBox.top).toBeGreaterThanOrEqual(dateBox.bottom);

    /* Nothing may spill sideways. The action row is `flex-wrap` over a
       `min-w-30` cancel and a `min-w-36` confirm whose label is the longest
       string in the component, and those minimums do not shrink. */
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);

    /* And the footer has to stay on screen. The dialog is centred with
       `-translate-y-1/2` and owns no scroll container, so a confirm below the
       fold is simply unreachable rather than scrolled to. */
    const confirm = panel
      .getByRole('button', { name: 'Override & discharge' })
      .getBoundingClientRect();
    await expect(confirm.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(Math.round(confirm.right)).toBeLessThanOrEqual(
      Math.round(dialog.getBoundingClientRect().right)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tallest variant on the shortest viewport. `CenterModal` drops from its fixed 500px ' +
          'to `w-[90%]` below 640px, and the dialog is centred with `top-1/2 -translate-y-1/2` ' +
          'with no scroll container of its own - so once the tinted panel, the textarea and both ' +
          'pickers are stacked, the footer is the first thing at risk of leaving the screen with ' +
          'no way to reach it. This asserts the confirm is still inside the viewport and that ' +
          'nothing in the panel overflows sideways at 337px.',
      },
    },
  },
};

export const Closed: Story = {
  name: 'Closed (shell still mounted)',
  args: { showModal: false, gate: BLOCKED_GATE },
  play: async () => {
    /* Not unmounted: `ModalBase` keeps the portal and drops `open`. Asserting
       absence against the copy would pass on a dialog that is merely
       transparent and still tabbable. */
    await expect(document.querySelector('dialog[open]')).toBeNull();
    const dialog = document.querySelector('dialog') as HTMLElement;
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAttribute('inert');

    /* `dialog:not([open])` is `display: none` in the UA sheet, but the
       container carries `flex`, which is an author style and wins - so this
       dialog is laid out and painted at zero alpha rather than removed. The
       `inert` and `pointer-events-none` above are the only things keeping it
       out of reach, which is worth seeing measured. */
    await waitFor(() => {
      expect(getComputedStyle(dialog).display).toBe('flex');
      expect(getComputedStyle(dialog).opacity).toBe('0');
      expect(getComputedStyle(dialog).pointerEvents).toBe('none');
    });

    // The override field and the gate copy are still in the tree behind all that.
    const panel = within(dialog);
    await expect(panel.getByText(GATE_REASON)).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Override & discharge' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What "closed" means for this dialog: a `<dialog>` without `open` that is still laid ' +
          "out - the container's `flex` beats the UA `dialog:not([open]) { display: none }` - " +
          'carrying `inert` and `pointer-events-none` at zero opacity behind a faded backdrop, ' +
          'with the gate panel and the typed override reason still in the DOM. Nothing resets ' +
          'that state on close - the parent holds `dischargeOverrideReason` across openings - so ' +
          'reopening shows whatever was typed last time.',
      },
    },
  },
};
