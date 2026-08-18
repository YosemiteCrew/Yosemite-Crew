import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api from '@/app/services/axios';
import type { NetworkColleague } from '../services/chatService';
import { NetworkDirectoryModal } from './NetworkDirectoryModal';

const COLLEAGUES: NetworkColleague[] = [
  {
    userId: 'user-1',
    name: 'Nadia Alvarez',
    role: 'Orthopaedic surgeon',
    organisationId: 'org-riverbend',
    organisationName: 'Riverbend Veterinary',
  },
  {
    userId: 'user-2',
    name: 'Tomas Lindqvist',
    role: 'Radiologist',
    organisationId: 'org-northgate',
    organisationName: 'Northgate Referrals',
  },
  {
    userId: 'user-3',
    name: 'Priya Raghavan',
    role: 'Internal medicine',
    organisationId: 'org-harbourside',
    organisationName: 'Harbourside Animal Hospital',
  },
];

/**
 * Both states worth reviewing here live behind `chatService`, which reaches the API
 * through the shared axios instance. Rather than mocking the service module - which
 * would need Storybook's module-mocking wiring and a `#mocks` alias this project does
 * not have - each story swaps that instance's *adapter*, the documented seam axios
 * exposes for exactly this. `beforeEach` returns the restore, so the real adapter is
 * back before the next story runs.
 */
const stubApi = (handler: (config: InternalAxiosRequestConfig) => Promise<unknown>) => () => {
  const previous = api.defaults.adapter;
  const adapter: AxiosAdapter = async (config) => ({
    data: await handler(config),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previous;
  };
};

const NEVER = () => new Promise<never>(() => {});

const meta = {
  title: 'Chat/NetworkDirectoryModal',
  component: NetworkDirectoryModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The cross-clinic colleague directory. The chat sidebar mounts it only while ' +
          '`networkModalOpen` is set, so it has no closed state and nothing had ever drawn it - ' +
          'and almost everything inside it is gated a second time, on what the network returns.\n\n' +
          'The list is a four-way branch that never shows two arms at once: `Searching…` while a ' +
          'request is in flight, `Search for a colleague at another clinic` when the field is ' +
          'empty, `No colleagues found` for a query with no matches, and the result rows. Only the ' +
          'second of those is reachable without a response, which is why the other three had never ' +
          'been rendered anywhere. Each story below drives one of them by swapping the axios ' +
          'adapter.\n\n' +
          'A result row is not a static row either. Pressing it sets `starting` to that ' +
          "colleague's id, which swaps the `--cta` pill's label from `Message` to `Starting…` and " +
          'disables the row (`disabled:opacity-60`) - a state that exists only while a POST is in ' +
          'flight. If that POST rejects, a `role="alert"` band appears *between* the search field ' +
          'and the list, pushing the list down inside a `max-h-80` scroller; it is the only element ' +
          'that changes the modal height, and it had never been composited with the rows above it.\n\n' +
          'The shell itself is a `fixed inset-0` `<dialog open>` over a `--scrim` wash, with a ' +
          'full-bleed transparent "Close directory" button behind the card as the backdrop, a ' +
          '38px `--field-bg` search pill (not an underlined row) that swaps its hairline for a ' +
          '`--blue` edge and a 3px glow on focus, and a fixed `--inset` footnote about what network ' +
          'messages share.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    organisationId: 'org-storybook',
    onClose: fn(),
    onStarted: fn(),
  },
  beforeEach: stubApi(async () => ({ colleagues: COLLEAGUES })),
} satisfies Meta<typeof NetworkDirectoryModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Types into the search pill. Each story uses its own query text on purpose: `getData`
 * de-duplicates in-flight GETs by endpoint + params, so a story that leaves a request
 * pending would hand that same promise to any later story searching the same term.
 */
const search = async (canvasElement: HTMLElement, query: string) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Search colleagues'), query);
  return canvas;
};

export const Idle: Story = {
  name: 'No query yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Search for a colleague at another clinic')).toBeInTheDocument();
    // The clear affordance is gated on there being something to clear.
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the modal opens: an autofocused empty field and the prompt line. No request has been ' +
          'made, so this is the one arm of the list that needs no response to reach.',
      },
    },
  },
};

export const Searching: Story = {
  name: 'Searching (request in flight)',
  beforeEach: stubApi(NEVER),
  play: async ({ canvasElement }) => {
    const canvas = await search(canvasElement, 'lind');
    // Held open by a request that never settles, so the state stays on screen for
    // review instead of flickering past inside the 300ms debounce.
    await expect(await canvas.findByText('Searching…')).toBeInTheDocument();
    await expect(canvas.queryByText('No colleagues found')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`searching` is set the moment the query changes - not when the request leaves - so this ' +
          'state covers the 300ms debounce as well as the round trip. Nothing else renders while it ' +
          'holds, which is what stops the previous results flashing under a new query.',
      },
    },
  },
};

export const Results: Story = {
  name: 'Results',
  play: async ({ canvasElement }) => {
    const canvas = await search(canvasElement, 'ra');
    const first = await canvas.findByRole('button', { name: /Nadia Alvarez/ });
    // Assert the rows carry their content, not merely that the list stopped saying
    // "Searching…" - an empty list would satisfy that on its own.
    const list = first.closest('ul') as HTMLElement;
    await expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await expect(
      within(list).getByText('Orthopaedic surgeon · Riverbend Veterinary')
    ).toBeInTheDocument();
    await expect(within(list).getByText('Radiologist · Northgate Referrals')).toBeInTheDocument();
    await expect(within(list).getAllByText('Message')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three colleagues at three different practices. The clinic name is the point of the ' +
          'second line: without it the row is indistinguishable from an in-house colleague, and the ' +
          'whole reason this modal exists is that these people are not in your organization. The ' +
          'name truncates and the clinic line truncates independently, so a long practice name ' +
          'never pushes the `Message` pill off the row.',
      },
    },
  },
};

export const NoResults: Story = {
  name: 'No colleagues found',
  beforeEach: stubApi(async () => ({ colleagues: [] })),
  play: async ({ canvasElement }) => {
    const canvas = await search(canvasElement, 'zzz');
    await expect(await canvas.findByText('No colleagues found')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query the network cannot match. The empty line sits in the same `px-3 py-6` centred ' +
          'row as the other two placeholders, so the modal keeps its height as the arms swap.',
      },
    },
  },
};

export const Starting: Story = {
  name: 'Starting a conversation',
  beforeEach: stubApi(async (config) => {
    if (config.method === 'post') return NEVER();
    return { colleagues: COLLEAGUES };
  }),
  play: async ({ canvasElement }) => {
    const canvas = await search(canvasElement, 'nad');
    const row = await canvas.findByRole('button', { name: /Nadia Alvarez/ });
    await userEvent.click(row);
    // Only the pressed row changes: the pill relabels and the row disables while the
    // POST is open, so a second press cannot open two channels.
    await expect(row).toBeDisabled();
    await expect(within(row).getByText('Starting…')).toBeInTheDocument();
    await expect(canvas.getAllByText('Message')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held on a POST that never settles. `starting` stores the colleague id rather than a ' +
          'boolean, which is what keeps the other two rows live and labelled `Message` while this ' +
          'one waits.',
      },
    },
  },
};

export const StartFailed: Story = {
  name: 'Could not start the conversation',
  beforeEach: stubApi(async (config) => {
    if (config.method === 'post') throw new Error('network directory unavailable');
    return { colleagues: COLLEAGUES };
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = await search(canvasElement, 'tom');
    await userEvent.click(await canvas.findByRole('button', { name: /Tomas Lindqvist/ }));
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not start the conversation. Please try again.');
    // The modal must stay open and the rows must stay usable - a failed start is
    // retryable, and dismissing here would lose the query.
    await expect(args.onClose).not.toHaveBeenCalled();
    await expect(args.onStarted).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: /Tomas Lindqvist/ })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only failure surface in the modal, and the only element that changes its height: the ' +
          'alert band is inserted between the search pill and the `max-h-80` list, so everything ' +
          'below it shifts down. It is drawn in `--danger-text` on the plain card background rather ' +
          'than in a tinted panel, which is worth seeing against the rows it sits above.',
      },
    },
  },
};

export const Cleared: Story = {
  name: 'Query cleared',
  play: async ({ canvasElement }) => {
    const canvas = await search(canvasElement, 'pri');
    await expect(await canvas.findByRole('button', { name: /Priya Raghavan/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    // Clearing empties the results synchronously rather than waiting on a request,
    // so the prompt line comes back rather than "No colleagues found".
    await expect(
      await canvas.findByText('Search for a colleague at another clinic')
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Priya Raghavan')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The clear glyph appears inside the pill only once there is a query. Clearing resets to ' +
          'the prompt state in the same render - the results are dropped in the derived-state guard ' +
          'at the top of the component, not in the effect - so no request is fired for an empty ' +
          'query.',
      },
    },
  },
};
