import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import SignatureRenderer from './SignatureRenderer';

type RendererProps = ComponentProps<typeof SignatureRenderer>;

const PLACEHOLDER = 'Please Save and Sign';
const SHORT_LABEL = 'Pet parent signature';

/** A saved signature field as the runtime renderer receives it. */
const CLIENT_SIGNATURE: FormField & { type: 'signature' } = {
  id: 'client_signature',
  type: 'signature',
  label: SHORT_LABEL,
  required: true,
};

/**
 * The wording a consent form actually carries. Long enough to wrap at the pinned
 * width, which is the case that decides whether the label pushes the signing box
 * around or clips.
 */
const LONG_LABEL =
  'Signature of the pet parent or authorised agent consenting to the procedure described above';

/* ------------------------------------------------------------------ *
 * Contrast measurement
 *
 * Nothing here paints a background of its own - the label, the dashed box and
 * the wrapper are all transparent - so reading `backgroundColor` on the element
 * returns `rgba(0, 0, 0, 0)` and proves nothing. The walk below finds the first
 * opaque layer above it, which for this component is the page ground the theme
 * flips.
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number; a: number };

const OPAQUE_WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

/**
 * Throws rather than guessing on anything that is not `rgb()`/`rgba()`. Chrome
 * serialises `oklch()` straight back as `oklch()`, and a silent misparse would
 * turn every number below into nonsense that still passes.
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

/** The opaque colour painted at `start`, including `start`'s own background. */
const groundAt = (start: HTMLElement | null): Rgb => {
  const layers: Rgb[] = [];
  let node = start;
  while (node) {
    const layer = parseRgb(globalThis.getComputedStyle(node).backgroundColor);
    if (layer.a > 0) layers.push(layer);
    if (layer.a === 1) break;
    node = node.parentElement;
  }
  return layers.reduceRight((under, layer) => composite(layer, under), OPAQUE_WHITE);
};

const channel = (value: number): number => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrastRatio = (ink: Rgb, ground: Rgb): number =>
  (Math.max(luminance(ink), luminance(ground)) + 0.05) /
  (Math.min(luminance(ink), luminance(ground)) + 0.05);

const rgbString = ({ r, g, b }: Rgb): string =>
  `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

const inkOf = (el: HTMLElement): Rgb =>
  composite(parseRgb(globalThis.getComputedStyle(el).color), groundAt(el));

/**
 * The two texts are the same size and the same weight; only the token separates
 * the field name from the instruction. So both have to clear AA on their own AND
 * stay distinguishable from one another - a token sweep that collapsed
 * `text-black-text` onto `text-grey-noti` would render one flat block of copy
 * with nothing marking where the label ends.
 *
 * `lighterThanGround` is the half that catches the real regression: the class is
 * literally named `black-text`, which invites a "tidy-up" to `text-black`, and
 * that reads fine in light and disappears entirely on the espresso ground.
 */
const assertInkSystem = async (
  canvasElement: HTMLElement,
  { lighterThanGround }: { lighterThanGround: boolean }
) => {
  const canvas = within(canvasElement);
  const label = canvas.getByText(SHORT_LABEL);
  const hint = canvas.getByText(PLACEHOLDER);
  const ground = groundAt(label);
  const labelInk = inkOf(label);
  const hintInk = inkOf(hint);

  await expect(contrastRatio(labelInk, ground)).toBeGreaterThanOrEqual(4.5);
  await expect(contrastRatio(hintInk, ground)).toBeGreaterThanOrEqual(4.5);
  await expect(rgbString(labelInk)).not.toBe(rgbString(hintInk));

  // Both inks sit on the same side of the ground, and it is the side the theme dictates.
  await expect(luminance(labelInk) > luminance(ground)).toBe(lighterThanGround);
  await expect(luminance(hintInk) > luminance(ground)).toBe(lighterThanGround);

  /* The dash is the only thing saying "not filled in yet", and its colour is a
     theme token too. A border that matched the ground would leave the
     instruction floating in empty space with no box around it. */
  const box = hint;
  const border = globalThis.getComputedStyle(box);
  await expect(border.borderTopStyle).toBe('dashed');
  await expect(border.borderTopWidth).toBe('2px');
  await expect(rgbString(composite(parseRgb(border.borderTopColor), ground))).not.toBe(
    rgbString(ground)
  );
};

/**
 * Pinned width so the wrap in `LongLabel` is decided by the fixture rather than
 * by whatever width the preview panel happens to be. `w-full` keeps it honest on
 * the phone story, where 420px is wider than the viewport.
 */
const Harness = (args: RendererProps) => (
  <div data-testid="renderer-host" className="w-full max-w-[420px]">
    <SignatureRenderer {...args} />
  </div>
);

const meta = {
  title: 'Forms/SignatureRenderer',
  component: SignatureRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime signature block - the `signature` entry in `runtimeComponentMap`, drawn ' +
          'wherever a saved form is filled in or previewed.\n\n' +
          '**Nothing here can be signed.** Every sibling in that map takes `value`, `onChange` ' +
          'and `readOnly`; this one takes `field` and nothing else. The map casts it to `any`, so ' +
          'the answer and the change handler `FormRenderer` passes are dropped on the floor with ' +
          'no type error. What is drawn is a dashed box containing the static sentence "Please ' +
          'Save and Sign" - an instruction pointing at the save action elsewhere in the flow, not ' +
          'a control. `Default` asserts the absence of any input, because that absence is the ' +
          'whole contract and is invisible in a screenshot.\n\n' +
          '**`readOnly` therefore has no effect.** A signature field renders identically in a ' +
          'live form and in a read-only preview. There is no disabled state to review and no ' +
          'story for one.\n\n' +
          '**`field.id` never reaches the DOM.** With no control there is no `name` to hang it ' +
          'on, so the only thing tying this block to its schema row is its position in the form.\n\n' +
          '**The label is a `div`, not a `<label>`.** Correct as it stands, since there is no ' +
          'control to point at - but it means the field name is plain text and carries no ' +
          'programmatic relationship to anything.\n\n' +
          'Visually the label and the instruction are the same 18px medium; only ' +
          '`text-black-text` versus `text-grey-noti` separates them, and both are theme tokens. ' +
          'The light and dark stories measure that pairing rather than assuming it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: CLIENT_SIGNATURE,
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof SignatureRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Awaiting a signature',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(SHORT_LABEL)).toBeInTheDocument();

    /* The contract, and the one thing no screenshot shows: there is no control
       in here at all. FormRenderer hands this component a value and an onChange
       through an `as any` cast and it accepts neither, so a signature field can
       never be answered from the rendered form. The day a pad is wired in, this
       is the assertion that reports it rather than the feature landing silently
       half-connected. */
    await expect(
      canvasElement.querySelectorAll(
        'input, textarea, select, button, canvas, svg, a, [contenteditable], [tabindex]'
      )
    ).toHaveLength(0);

    /* Fixed 120px, so a form containing a signature block reserves the same
       space whether or not anything has been signed and does not reflow. */
    const box = canvas.getByText(PLACEHOLDER);
    await expect(Math.round(box.getBoundingClientRect().height)).toBe(120);

    // Light: dark ink on a light ground, and the two inks stay distinct.
    await assertInkSystem(canvasElement, { lighterThanGround: false });
  },
};

export const LongLabel: Story = {
  name: 'A long label wraps above the box',
  args: { field: { ...CLIENT_SIGNATURE, label: LONG_LABEL } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText(LONG_LABEL);
    const fontSize = parseFloat(globalThis.getComputedStyle(label).fontSize);

    /* It wraps rather than clipping or scrolling sideways. The label carries no
       `truncate` today; adding one to "tidy" a long consent wording would cut
       the field name a signer is agreeing to. */
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);

    /* More than one line. Two lines of 18px cannot fit under 36px however tight
       the leading, and one line cannot exceed it - so this is a line-count
       assertion without hardcoding a leading the font file decides. */
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(fontSize * 2);

    /* ...and the box below is untouched by it. The 120px is a fixed height, not
       a share of the block, so a long label pushes the signing area down the
       page rather than squeezing it. */
    const box = canvas.getByText(PLACEHOLDER);
    await expect(Math.round(box.getBoundingClientRect().height)).toBe(120);
    await expect(box.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      label.getBoundingClientRect().bottom
    );
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    /* Same three tokens, inverted ground. `text-black-text` resolves to
       `--ink-body`, which is `#e6ddd0` here - a class with "black" in its name
       painting a near-white. Anyone replacing it with a literal `text-black`
       leaves the field name invisible on the espresso page, and only this
       direction check catches it. */
    await assertInkSystem(canvasElement, { lighterThanGround: true });
  },
};

export const Phone: Story = {
  name: 'Phone: the box keeps its height',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { field: { ...CLIENT_SIGNATURE, label: LONG_LABEL } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByText(PLACEHOLDER);
    const label = canvas.getByText(LONG_LABEL);

    /* 120px is absolute, so a phone gets exactly the laptop box - worth drawing,
       because this is the surface a pet parent meets a consent form on. */
    await expect(Math.round(box.getBoundingClientRect().height)).toBe(120);

    // The consent wording still reflows rather than being cut off in the column.
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(globalThis.getComputedStyle(label).fontSize) * 2
    );
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);

    /* Nothing widens the page. Weak under the headless runner, which loads
       iframe.html directly and so never gets the 375px frame the manager
       applies - the two assertions above are the ones that hold in both. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
