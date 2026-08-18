import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import SoapNotesList, { type SoapNoteListItem } from './SoapNotesList';

/**
 * Registered per story so the width survives a Chromatic run as well as a local one.
 * The expanded card is the only responsive thing here - `grid-cols-1 lg:grid-cols-2` -
 * so a story that asserts a track count has to own the width it asserts at.
 */
const DESKTOP_VIEWPORT = {
  desktop: {
    name: 'Desktop (1440)',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
};
const MOBILE_VIEWPORT = {
  mobile: { name: 'Mobile (375)', styles: { width: '375px', height: '812px' }, type: 'mobile' },
};

const FIELDS: SoapNoteListItem['fields'] = [
  { label: 'Chief complaint', text: 'Limping on the left hind leg since Sunday.' },
  { label: 'Subjective', html: '<p>Owner reports reluctance to jump onto the sofa.</p>' },
  {
    label: 'Objective',
    html:
      '<ul><li>BCS 5/9, weight 12.4kg</li><li>Pain on hip extension, left</li>' +
      '<li>No effusion, full range of motion right</li></ul>',
  },
  { label: 'Assessment', html: '<p>Suspected <strong>soft tissue strain</strong>, left hip.</p>' },
  {
    label: 'Plan',
    html: '<ol><li>Meloxicam 0.1mg/kg PO SID x5d</li><li>Rest, recheck in 7 days</li></ol>',
  },
  { label: 'Follow up', text: 'Recheck 19 March, sooner if lameness worsens.' },
];

const ITEMS: SoapNoteListItem[] = [
  {
    id: 'soap-1',
    signedByName: 'Dr Elena Ruiz',
    date: '12 Mar 2026',
    time: '10:04',
    fields: FIELDS,
  },
  {
    id: 'soap-2',
    signedByName: 'Dr Amara Okonkwo',
    date: '02 Feb 2026',
    time: '16:41',
    fields: FIELDS.slice(0, 3),
  },
];

/** Opens one note and hands back the expanded card, found by the `grid` it is built on. */
const expand = async (canvasElement: HTMLElement, signedByName: string) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: `View SOAP note by ${signedByName}` }));
  const label = await canvas.findByText('Chief complaint');
  return label.closest('.grid') as HTMLElement;
};

const meta = {
  title: 'Appointments/SoapNotesList',
  component: SoapNotesList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "All SOAP notes" read-out on a finished visit. The list itself is cheap - a clipboard ' +
          'glyph, the signer, the date - but every one of those rows hides the note behind an eye ' +
          'button, and the note is where all the layout lives.\n\n' +
          'That expanded card is the surface no snapshot contained. It is held in `open` state ' +
          'inside `SoapNoteRow`, a component that is not exported and has no prop to force it, so ' +
          'the only way to draw it is to press the eye. It renders as ' +
          '`grid grid-cols-1 gap-x-8 ... lg:grid-cols-2` - one column on a phone, two side by side ' +
          'from `lg` up - which means the layout being reviewed depends on the viewport the story ' +
          'is pinned to. Each story below states which width it asserts at rather than inheriting ' +
          'one.\n\n' +
          'Asserting the computed `grid-template-columns` is the point of the exercise. A grid ' +
          'template the browser rejects does not fall back to something visibly broken: the ' +
          'declaration is simply dropped and every child stacks into a single column, which reads ' +
          'as a deliberate layout. That is precisely the bug this sweep exists for.\n\n' +
          'The values are rich-text HTML written through `dangerouslySetInnerHTML`, re-sanitized at ' +
          'render by `sanitizeRichText` even though the write path already sanitized. The list and ' +
          'ordered-list styling comes from arbitrary-variant classes on the value container ' +
          '(`[&_ul]:list-disc [&_ol]:list-decimal`, both `pl-5`), so bullets only appear when that ' +
          'container is the one holding the markup - another thing that has to be rendered to be ' +
          'seen.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items: ITEMS,
  },
} satisfies Meta<typeof SoapNotesList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed rows',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('SOAP Note')).toHaveLength(2);
    // Nothing of the note itself is in the DOM until the eye is pressed.
    await expect(canvas.queryByText('Chief complaint')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the workspace shows on arrival. The signer and the date/time are `sm:`-gated, so ' +
          'below 640px the row is glyph, "SOAP Note" and the eye alone.',
      },
    },
  },
};

export const ExpandedDesktop: Story = {
  name: 'Expanded note (1440 - two columns)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    viewport: {
      options: DESKTOP_VIEWPORT,
      viewports: DESKTOP_VIEWPORT,
      defaultViewport: 'desktop',
    },
    chromatic: { viewports: [1440] },
    docs: {
      description: {
        story:
          'Pinned at 1440, above the `lg` breakpoint, so `lg:grid-cols-2` applies and the six ' +
          'label/value rows pair up into two columns with a 32px `gap-x-8` between them. The play ' +
          'function asserts the computed template really resolves to two tracks holding all six ' +
          'children - a dropped or malformed template collapses them into one column and still ' +
          'looks intentional.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const card = await expand(canvasElement, 'Dr Elena Ruiz');
    await expect(card).toBeInTheDocument();
    // Content first: an empty card would satisfy "the panel opened" on its own.
    const scope = within(card);
    await expect(scope.getByText('Limping on the left hind leg since Sunday.')).toBeInTheDocument();
    await expect(scope.getByText(/left hip/)).toBeInTheDocument();
    await expect(scope.getByText('soft tissue strain')).toBeInTheDocument();
    await expect(scope.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    await expect(card.children).toHaveLength(6);
    // Two tracks at this width, and the eye has flipped to its hide label.
    await expect(getComputedStyle(card).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(
      within(canvasElement).getByRole('button', { name: 'Hide SOAP note by Dr Elena Ruiz' })
    ).toBeInTheDocument();
  },
};

export const ExpandedMobile: Story = {
  name: 'Expanded note (375 - one column)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    viewport: { options: MOBILE_VIEWPORT, viewports: MOBILE_VIEWPORT, defaultViewport: 'mobile' },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The same note at 375, below `lg`, where the card is a single column and each label ' +
          'stacks above its value (the row itself is `flex-col` until `sm`). The assertion here is ' +
          'that the template resolves to exactly one *measured* track: a grid whose template was ' +
          'dropped computes to `none`, which is the failure this story is meant to catch, and it ' +
          'would otherwise be indistinguishable from the intended single column.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const card = await expand(canvasElement, 'Dr Elena Ruiz');
    const tracks = getComputedStyle(card).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(1);
    await expect(tracks[0]).toMatch(/px$/);
    await expect(card.children).toHaveLength(6);
  },
};

export const Sanitized: Story = {
  name: 'Rich text is re-sanitized at render',
  args: {
    items: [
      {
        id: 'soap-untrusted',
        signedByName: 'Dr Elena Ruiz',
        date: '12 Mar 2026',
        time: '10:04',
        fields: [
          { label: 'Chief complaint', text: 'Stored note replayed from the API.' },
          {
            label: 'Assessment',
            html:
              '<p>Stable on <strong>meloxicam</strong>.</p>' +
              '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">tap</a>',
          },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const card = await expand(canvasElement, 'Dr Elena Ruiz');
    await expect(within(card).getByText('meloxicam')).toBeInTheDocument();
    // `sanitizeRichText` allows only p/br/strong/b/em/i/u/s/ul/ol/li, so the image and
    // the anchor are gone while the prose around them survives. This is the second
    // sanitization pass - the write path already ran one - and it is the one that
    // protects a note that reached the database before the allow-list tightened.
    await expect(card.querySelector('img')).toBeNull();
    await expect(card.querySelector('a')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every value is injected with `dangerouslySetInnerHTML`, so what the allow-list drops is ' +
          'worth seeing rather than assuming. Anything outside p/br/strong/b/em/i/u/s/ul/ol/li is ' +
          'stripped at render, leaving the surrounding prose intact.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No notes recorded',
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No SOAP notes recorded yet.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A visit with nothing signed yet: the `<ul>` is replaced by a filled `--neutral-100` ' +
          'block rather than an empty bordered section, so the card never reads as broken.',
      },
    },
  },
};

export const CustomEmptyLabel: Story = {
  name: 'No notes (caller copy)',
  args: { items: [], emptyLabel: 'No SOAP notes for this visit yet.' },
};
