import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import StaffField, { MetaFieldShell, MetaFieldValue } from './StaffField';

/**
 * A real asset on an allow-listed CDN host, so the photo branch renders what it
 * would in the app rather than the `getSafeImageUrl` fallback.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';

/* ------------------------------------------------------------------ *
 * Token + contrast probes
 *
 * Every colour in this component is a custom property, and several of them are
 * re-declared under `body:has([data-yc-app])` - the PIMS scope. A probe parked
 * outside the component reads the MARKETING value, so both helpers resolve
 * tokens from inside the field's own subtree.
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number; a: number };

const parseRgb = (value: string): Rgb => {
  if (!value.startsWith('rgb')) {
    throw new Error(`Expected an rgb()/rgba() computed colour, got "${value}"`);
  }
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b, a };
};

/**
 * What `var(token)` resolves to right here, serialized the same way a computed
 * `color` or `backgroundColor` is - so the two are directly comparable.
 */
const resolveToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const toLinear = (value: number): number => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/**
 * Ink against a ground. Both surfaces involved here (`--field-bg`, `--screen`)
 * are opaque in both themes, so a single layer is the whole story - unlike the
 * translucent tints elsewhere in this folder.
 */
const contrast = (ink: string, ground: string): number => {
  const inkLuminance = luminance(parseRgb(ink));
  const groundLuminance = luminance(parseRgb(ground));
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

/** The label span, its shell, and the value inside it. */
const partsOf = (canvasElement: HTMLElement, label: string) => {
  const labelEl = within(canvasElement).getByText(label);
  const shell = labelEl.parentElement as HTMLElement;
  return { labelEl, shell };
};

/** The initials chip AppointmentAvatar draws when there is no photo. */
const chipIn = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('div[aria-hidden="true"]');

const meta = {
  title: 'Appointments/StaffField',
  component: StaffField,
  decorators: [
    /* `--page`, which is what `body` actually paints and therefore the real ground
       under the meta bar - NOT `--screen`, which the old faked notch painted
       behind the label. Those two tokens differ in both themes (#efe8dc vs
       #f7f3ec light, #201c18 vs #2f271e dark), which is exactly why the patch was
       visible on the plain page and not only on cards. Rendering on the true
       ground keeps a mismatch visible here instead of only in the product. */
    (Story) => (
      <div className="w-[280px] p-6" style={{ background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The read-only staff box in the workspace meta bar, and - via its two named exports - ' +
          'the chrome every other field in that bar is built from. `MetaFieldShell` is the 46px ' +
          'box with the notched label; `MetaFieldValue` is the 13.5px/600 value text; ' +
          '`StaffField` is the two of them plus an avatar.\n\n' +
          'The notch is a real one: the box is a `fieldset` and the label is its `legend`, so ' +
          'the browser cuts the border where the text sits. It paints no background of its own ' +
          'and is therefore correct on every ground - card, modal or page, light or dark.\n\n' +
          'It did not always work that way. The label used to be an absolutely positioned span ' +
          'painting `--screen` behind itself to fake the gap - but `body` paints `--page`, a ' +
          'different token in both themes, so the patch never matched its ground and showed as a ' +
          'rectangle of the wrong shade over the border. The stories now render on `--page`, the ' +
          'real ground, so a mismatch shows up here rather than only in the product.\n\n' +
          'The surface is `--field-bg` rather than transparent, which is what makes the box read ' +
          'as filled instead of as a hole in the page - the two tokens are deliberately different ' +
          'values in both themes, and the stories assert that rather than assuming it.\n\n' +
          'The avatar branch has an accessibility asymmetry inherited from `AppointmentAvatar`: ' +
          'the initials chip is `aria-hidden`, but the photo carries `alt={name}`, so a staff ' +
          'member with a photo on file has their name announced twice - once as the field value ' +
          'and once as the image. The unassigned branch renders no avatar at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Assigned lead',
    name: 'Dr. Amara Weber',
  },
} satisfies Meta<typeof StaffField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Assigned: Story = {
  name: 'Assigned, with initials',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { labelEl, shell } = partsOf(canvasElement, 'Assigned lead');
    const value = canvas.getByText('Dr. Amara Weber');

    // 46px is the meta bar's row height; every field in that bar has to agree on it.
    await expect(Math.round(shell.getBoundingClientRect().height)).toBe(46);

    const shellStyle = globalThis.getComputedStyle(shell);
    await expect(shellStyle.borderRadius).toBe('14px');
    /* The hairline colour, not its width. `border-[1.5px]` is declared at 1.5 but
       Chrome reports the USED value, which is floored to 1px at DPR 1 - so a computed
       check cannot tell 1.5 from 1 and asserting it would only pin the browser's
       rounding. What is worth pinning is that the border takes `--hairline` rather
       than the theme's default border colour, which is a visibly heavier line. */
    await expect(shellStyle.borderTopColor).toBe(resolveToken(shell, '--hairline'));
    await expect(shellStyle.borderTopStyle).toBe('solid');

    /* The filled surface. `--field-bg` and `--screen` are different values in both
       themes; if the shell ever falls back to transparent the box still has its
       border and still looks plausible, it just stops reading as an input. */
    await expect(shellStyle.backgroundColor).toBe(resolveToken(shell, '--field-bg'));
    await expect(shellStyle.backgroundColor).not.toBe(resolveToken(shell, '--screen'));

    /* The notch: the label straddles the top border rather than sitting inside the
       box. `-top-[7px]` flipped to `top-[7px]` drops it into the field beside the
       value, which is a different component entirely. */
    const labelBox = labelEl.getBoundingClientRect();
    const shellBox = shell.getBoundingClientRect();
    await expect(labelBox.top).toBeLessThan(shellBox.top);
    await expect(labelBox.bottom).toBeGreaterThan(shellBox.top);
    // Inset from the corner, so the border still turns before the label starts.
    await expect(labelBox.left).toBeGreaterThan(shellBox.left);

    /* The legend must paint NOTHING. Any background here is the old bug: a patch
       that happens to match one ground and shows as a coloured rectangle on every
       other. A real notch needs no fill, which is the whole point of the fix. */
    await expect(globalThis.getComputedStyle(labelEl).backgroundColor).toBe('rgba(0, 0, 0, 0)');

    // 13.5px/600 is normal-size text, so the AA bar is 4.5 rather than 3.0.
    await expect(
      contrast(globalThis.getComputedStyle(value).color, shellStyle.backgroundColor)
    ).toBeGreaterThanOrEqual(4.5);

    const chip = chipIn(canvasElement) as HTMLElement;
    /* `size={30}` - the avatar has to clear the 46px box with room for the 1.5px
       border on both sides, and it is the only thing in the row that is not text. */
    await expect(chip.getBoundingClientRect().width).toBe(30);
    /* "DW", not "AW": `getInitials` takes the first and LAST word, and the honorific
       is the first word. Worth knowing before treating the chip as a person's
       initials - production passes `encounter.leadName`, which usually carries one. */
    await expect(chip).toHaveTextContent('DW');
    // The chip is decoration; the name beside it is what gets announced.
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};

export const WithPhoto: Story = {
  name: 'Assigned, with a photo on file',
  args: { photoUrl: CDN_PHOTO },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const photo = canvas.getByRole('img', { name: 'Dr. Amara Weber' });

    // Intrinsic width/height come off `size`; without them next/image reserves the
    // wrong box and the meta bar reflows once the file lands.
    await expect(photo).toHaveAttribute('width', '30');
    await expect(photo.getBoundingClientRect().width).toBe(30);
    // The photo replaces the monogram rather than layering over it.
    await expect(chipIn(canvasElement)).toBeNull();

    /* The name is still text in the field, not only the image's alt. Losing that
       would leave the value slot empty for anyone with a photo on file - and the
       row would still announce the name, so it would sound correct while reading
       as a blank field. */
    await expect(canvas.getByText('Dr. Amara Weber')).toBeInTheDocument();
    await expect(
      Math.round(partsOf(canvasElement, 'Assigned lead').shell.getBoundingClientRect().height)
    ).toBe(46);
  },
};

export const Unassigned: Story = {
  name: 'Nobody assigned',
  args: { label: 'Support staff', name: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { shell } = partsOf(canvasElement, 'Support staff');
    const placeholder = canvas.getByText('Unassigned');

    /* A word, not an em dash and not an empty box. The field is 46px tall whether or
       not it is filled, so an empty value slot reads as a rendering failure. */
    await expect(placeholder).toBeInTheDocument();
    await expect(Math.round(shell.getBoundingClientRect().height)).toBe(46);

    const ink = globalThis.getComputedStyle(placeholder).color;
    /* Faint ink, deliberately - "Unassigned" is a state, not a value, and must not
       read with the weight of a real name. The pair matters more than either half:
       `isPlaceholder` defaulting to false would render this in body ink and the
       field would claim someone called "Unassigned" is on the case. */
    await expect(ink).toBe(resolveToken(placeholder, '--ink-faint'));
    await expect(ink).not.toBe(resolveToken(placeholder, '--ink-body'));

    /* Faint is not the same as unreadable. `--ink-faint` is re-declared inside the
       PIMS scope precisely because the marketing value did not clear AA on a
       product surface, and this field is one of the places that showed. */
    await expect(
      contrast(ink, globalThis.getComputedStyle(shell).backgroundColor)
    ).toBeGreaterThanOrEqual(4.5);

    // No avatar of any kind - neither a monogram for a name that does not exist nor
    // a stock photo standing in for a person.
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(chipIn(canvasElement)).toBeNull();
  },
};

export const LongName: Story = {
  name: 'A name too long for the box',
  args: { name: 'Dr. Anneliese Marchetti-Vasquez' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { shell } = partsOf(canvasElement, 'Assigned lead');
    const value = canvas.getByText('Dr. Anneliese Marchetti-Vasquez');
    const chip = chipIn(canvasElement) as HTMLElement;

    // Actually clipped, so the story is exercising the truncation rather than
    // asserting a class on a name that happened to fit.
    await expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);

    /* One line, not two. `truncate` is what holds the box at 46px; drop it and the
       name wraps, the field grows, and it stops lining up with the four other
       fields in the meta bar row. */
    await expect(Math.round(shell.getBoundingClientRect().height)).toBe(46);

    /* And the avatar keeps its full width and stays inside the box. The value is
       `flex-1 min-w-0` for exactly this reason - without the min-width floor the
       text refuses to shrink and pushes the 30px chip out past the border. */
    const chipBox = chip.getBoundingClientRect();
    const shellBox = shell.getBoundingClientRect();
    await expect(chipBox.width).toBe(30);
    await expect(chipBox.right).toBeLessThanOrEqual(shellBox.right);
  },
};

export const Shell: Story = {
  name: 'MetaFieldShell with arbitrary children',
  render: () => (
    <div className="flex flex-col gap-6">
      <MetaFieldShell label="Consultation type">
        <MetaFieldValue>Inpatient admission</MetaFieldValue>
      </MetaFieldShell>
      <MetaFieldShell label="Room">
        <MetaFieldValue>Theatre A</MetaFieldValue>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase">
          Locked
        </span>
      </MetaFieldShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const label of ['Consultation type', 'Room']) {
      const { labelEl, shell } = partsOf(canvasElement, label);
      const shellBox = shell.getBoundingClientRect();
      const labelBox = labelEl.getBoundingClientRect();

      /* The shell is chrome, not a staff field: whatever it is given, it holds the
         same 46px box, the same 14px radius and the same notch. Four other fields in
         the meta bar sit in a row with these, and a single one drifting is visible
         as a step in the row rather than as a broken component. */
      await expect(Math.round(shellBox.height)).toBe(46);
      await expect(globalThis.getComputedStyle(shell).borderRadius).toBe('14px');
      await expect(labelBox.top).toBeLessThan(shellBox.top);
      await expect(labelBox.bottom).toBeGreaterThan(shellBox.top);
    }

    /* Extra children sit after the value rather than replacing it, and the value
       still takes the free space - `flex-1` on MetaFieldValue is what stops a
       trailing chip from being shoved against the text. */
    const locked = canvas.getByText('Locked');
    const room = canvas.getByText('Theatre A');
    await expect(room.getBoundingClientRect().right).toBeLessThanOrEqual(
      locked.getBoundingClientRect().left
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The exported chrome on its own - a plain value, and a value with a trailing element. ' +
          'This is what the read-only consultation-type and room fields in the meta bar are.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark: filled, not a hole in the page',
  globals: { theme: 'dark' },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <StaffField {...args} />
      <StaffField label="Support staff" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { labelEl, shell } = partsOf(canvasElement, 'Assigned lead');
    const shellStyle = globalThis.getComputedStyle(shell);

    /* The espresso theme is where a transparent field would be invisible: on the
       light bone ground a missing `--field-bg` still leaves a near-white box, but on
       `--screen` #2f271e the field would vanish into the page and only the border
       would remain. The two tokens must stay distinguishable. */
    await expect(shellStyle.backgroundColor).toBe(resolveToken(shell, '--field-bg'));
    await expect(shellStyle.backgroundColor).not.toBe(resolveToken(shell, '--screen'));

    // The notch still paints the page colour, which is a different value in dark.
    await expect(globalThis.getComputedStyle(labelEl).backgroundColor).toBe(
      resolveToken(labelEl, '--screen')
    );

    /* Three inks, three grounds, all of them theme-swapped. The 10.5px label is the
       tightest of them and the one that goes first when `--ink-faint` moves. */
    const labelInk = globalThis.getComputedStyle(labelEl).color;
    await expect(
      contrast(labelInk, globalThis.getComputedStyle(labelEl).backgroundColor)
    ).toBeGreaterThanOrEqual(4.5);
    await expect(
      contrast(
        globalThis.getComputedStyle(canvas.getByText('Dr. Amara Weber')).color,
        shellStyle.backgroundColor
      )
    ).toBeGreaterThanOrEqual(4.5);
    await expect(
      contrast(
        globalThis.getComputedStyle(canvas.getByText('Unassigned')).color,
        shellStyle.backgroundColor
      )
    ).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story: 'The assigned and unassigned fields together on the espresso ground.',
      },
    },
  },
};
