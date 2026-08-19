import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';

import type { ChartKey } from './chartAxis';
import ChartCanvas, { type ChartCanvasProps } from './ChartCanvas';

const APPOINTMENT_KEYS: ChartKey[] = [
  { name: 'Completed', color: 'var(--cta)' },
  { name: 'Cancelled', color: 'var(--divider)' },
];

const APPOINTMENTS = [
  { month: 'Mon', Completed: 18, Cancelled: 3 },
  { month: 'Tue', Completed: 24, Cancelled: 1 },
  { month: 'Wed', Completed: 21, Cancelled: 5 },
  { month: 'Thu', Completed: 27, Cancelled: 2 },
  { month: 'Fri', Completed: 30, Cancelled: 4 },
  { month: 'Sat', Completed: 12, Cancelled: 2 },
  { month: 'Sun', Completed: 6, Cancelled: 0 },
];

/**
 * One `<rect>` per non-zero value: recharts skips a zero-height bar, so Sunday's
 * `Cancelled: 0` draws nothing. Derived from the fixture rather than hardcoded so
 * that editing a row above cannot quietly turn the count into a lie.
 */
const BAR_RECTANGLE_COUNT =
  APPOINTMENTS.filter((point) => point.Completed > 0).length +
  APPOINTMENTS.filter((point) => point.Cancelled > 0).length;

const REVENUE_KEYS: ChartKey[] = [{ name: 'Revenue', color: 'var(--blue)' }];

const REVENUE = [
  { month: 'Jan', Revenue: 12400 },
  { month: 'Feb', Revenue: 14850 },
  { month: 'Mar', Revenue: 11200 },
  { month: 'Apr', Revenue: 17600 },
  { month: 'May', Revenue: 19050 },
  { month: 'Jun', Revenue: 16300 },
];

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const CHART_HEIGHT = 240;

/**
 * The one shape of chart in this file whose canvas actually has a box on screen,
 * so it is the only one a tooltip story can be written against. Shared verbatim by
 * every line story below - they are the same render, differing only in what they
 * assert.
 */
const LINE_ARGS = {
  data: REVENUE,
  keys: REVENUE_KEYS,
  type: 'line',
  tooltipLabelFormatter: (label) => `Month of ${String(label)}`,
  yTickFormatter: (value: number) => `$${(value / 1000).toFixed(0)}k`,
} satisfies Partial<ChartCanvasProps>;

const wrapperOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.recharts-wrapper') as HTMLElement;

/**
 * The tooltip bubble is ALWAYS in the DOM - recharts keeps the wrapper mounted and
 * toggles `visibility` on it - so "the bubble exists" is never the question here.
 */
const bubbleOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.recharts-tooltip-wrapper') as HTMLElement;

/**
 * Moves the pointer over the plot.
 *
 * `userEvent.hover` is no use for a chart: recharts reads `clientX`/`clientY` off
 * the event and turns them into a data index, and hover dispatches no usable
 * coordinates. A native `mousemove` with real coordinates is what a chart tooltip
 * actually responds to - recharts takes it through React's delegated
 * `onMouseMove` on `.recharts-wrapper` and subtracts that element's
 * `getBoundingClientRect()`, so a bubbling event carrying real client
 * coordinates is indistinguishable from a hand on a mouse. Hoisted deliberately -
 * it mutates, so it must never be called from inside a `waitFor` callback.
 */
const movePointerOverPlot = (wrapper: HTMLElement, fraction: number) => {
  const rect = wrapper.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: Math.round(rect.left + rect.width * fraction),
    clientY: Math.round(rect.top + rect.height * 0.5),
  };
  // Sent three times: the first move can land before recharts has measured its
  // ResponsiveContainer, and a repeat costs nothing.
  for (let i = 0; i < 3; i += 1) {
    wrapper.dispatchEvent(new MouseEvent('mousemove', init));
  }
};

/**
 * Takes the pointer off the plot.
 *
 * Dispatched as a bubbling `mouseout` with a `relatedTarget` outside the chart,
 * not as `mouseleave`: React synthesises `onMouseLeave` from the out/over pair at
 * the root container, so a hand-fired `mouseleave` - which does not bubble -
 * reaches nothing and the bubble stays open.
 */
const movePointerOffPlot = (wrapper: HTMLElement) => {
  wrapper.dispatchEvent(
    new MouseEvent('mouseout', {
      bubbles: true,
      cancelable: true,
      relatedTarget: document.body,
    })
  );
};

/**
 * A flat pause, for the one assertion shape `waitFor` cannot express: that
 * something STAYS shut. recharts answers a mousemove within a single animation
 * frame (its mousemove handling is `requestAnimationFrame`-throttled by default),
 * so a quarter of a second is generous.
 */
/** The label line of the open bubble. */
const bubbleLabel = (canvasElement: HTMLElement): string =>
  bubbleOf(canvasElement).querySelector('.recharts-tooltip-label')?.textContent?.trim() ?? '';

/** Series name -> printed value, for the open bubble. */
const bubbleItems = (canvasElement: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    [...bubbleOf(canvasElement).querySelectorAll('.recharts-tooltip-item')].map((item) => [
      item.querySelector('.recharts-tooltip-item-name')?.textContent?.trim() ?? '',
      item.querySelector('.recharts-tooltip-item-value')?.textContent?.trim() ?? '',
    ])
  );

const meta = {
  title: 'Widgets/ChartCanvas',
  component: ChartCanvas,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The recharts canvas itself, one level below `Widgets/DynamicChartCard`: the axes, the ' +
          'grid, the series, and the one surface those card stories can never reach - the ' +
          '**tooltip bubble**.\n\n' +
          '**The bar canvas in this file renders at 0x0 and paints nothing.** That is not a story ' +
          'bug, it is the component: `BarChartContent` hands `<BarChart>` a ' +
          '`style={{ width: "100%", height: "100%" }}`, recharts spreads that style onto ' +
          "`.recharts-wrapper` AFTER the pixel width and height it measured, and the wrapper's " +
          'parent is the deliberately zero-width `overflow: visible` div `ResponsiveContainer` ' +
          'uses so a chart can shrink. 100% of 0 is 0. recharts still computes the whole chart - ' +
          'the `<svg>` carries `width="620" height="240"`, every bar has real geometry - and CSS ' +
          'then collapses it to nothing, which is why no console warning fires. "Bars: the canvas ' +
          'hover opens the bubble" is the regression guard for it, and the other stories run on the LINE chart, which ' +
          'passes no `style` and therefore keeps the pixel size recharts gave it.\n\n' +
          'The bubble itself carries **no repo styling at all**. Both `<Tooltip />` elements here ' +
          'are bare (the line chart passes a label formatter and nothing else), so what a reader ' +
          'gets is the recharts default: a `#fff` box with a `1px solid #ccc` border and ' +
          'black-ish item text, sized in pixels and positioned by recharts. It does not read a ' +
          'single design token, which means it stays white on the espresso dark theme - switch ' +
          'the toolbar to Dark on any story below and the bubble is the one thing that does not ' +
          'move.\n\n' +
          'It also only exists while a pointer is over the plot, which is why no snapshot had ever ' +
          'contained it: the bubble wrapper is mounted at all times but sits at ' +
          '`visibility: hidden` until a `mousemove` lands, so a static frame of the chart and a ' +
          'frame with a broken tooltip are identical.\n\n' +
          'A note for anyone extending this file: the recharts element imports must stay static. ' +
          'Wrapping `Bar`/`XAxis`/`Tooltip` in `next/dynamic` makes recharts see anonymous loadable ' +
          'components, and it silently drops them and renders an empty chart. Code splitting ' +
          'happens one level up, where `DynamicChartCard` lazy-loads this whole module.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    data: APPOINTMENTS,
    type: 'bar',
    keys: APPOINTMENT_KEYS,
    chartHeight: CHART_HEIGHT,
    chartMargin: CHART_MARGIN,
    isVerticalLayout: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 620, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TooltipAtRest: Story = {
  name: 'At rest: mounted, hidden',
  args: LINE_ARGS,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());

    /* On a canvas that is really there - stated as an assertion because the story
       below is the same file's proof that "the surface exists" and "the chart is
       on screen" are two different claims. */
    await waitFor(() => {
      const wrapper = wrapperOf(canvasElement);
      expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(wrapper.getBoundingClientRect().height).toBe(CHART_HEIGHT);
    });

    /* The claim worth pinning: the bubble is in the DOM before anyone has touched
       the chart. Any story that asserted `.recharts-tooltip-wrapper` exists would
       therefore pass with the tooltip completely broken - the visibility is the
       only thing that separates open from closed. */
    const bubble = await waitFor(() => {
      const node = bubbleOf(canvasElement);
      expect(node).not.toBeNull();
      return node;
    });
    await expect(getComputedStyle(bubble).visibility).toBe('hidden');
    // And it never eats a click meant for the chart underneath it.
    await expect(getComputedStyle(bubble).pointerEvents).toBe('none');
    await expect(bubble.textContent?.trim()).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The frame every existing chart story shows, held here on purpose as the thing the ' +
          'stories below are different from: a chart with a real box, and a bubble mounted inside ' +
          'it with nothing in it. On the line chart, because the bar canvas has no box to show ' +
          'at rest - see the story below.',
      },
    },
  },
};

export const BarTooltip: Story = {
  name: 'Bars: hover opens the bubble',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());

    const container = canvasElement.querySelector('.recharts-responsive-container') as HTMLElement;
    const wrapper = wrapperOf(canvasElement);
    const surface = canvasElement.querySelector('.recharts-surface') as SVGSVGElement;

    /* recharts measured the room and laid out every bar in it. */
    await waitFor(() => {
      expect(container.getBoundingClientRect().height).toBe(CHART_HEIGHT);
      expect(canvasElement.querySelectorAll('.recharts-bar')).toHaveLength(APPOINTMENT_KEYS.length);
      expect(canvasElement.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(
        BAR_RECTANGLE_COUNT
      );
    });

    /* THE REGRESSION GUARD. This canvas used to lay out at 0x0 while those bar
       rectangles sat inside it, so every bar chart in the product - the dashboard
       default, since `DynamicChartCard`'s `type` defaults to 'bar' - painted an empty
       rectangle. The cause was a `style={{ width: '100%', height: '100%' }}` on
       `<BarChart>`: recharts spreads a caller's style LAST over the pixel size it
       measured, and `ResponsiveContainer` deliberately gives its inner div `width: 0`
       (its documented shrink trick - the chart is meant to overflow it). 100% of 0 is
       0, the SVG clipped at its own edge, and nothing warned, because recharts believed
       the chart was 620x240.

       Assert the BOX, not just the bars: bars in a zero-size box are exactly what the
       defect looked like. If that style ever returns, this fails here. */
    await waitFor(() => {
      expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(wrapper.getBoundingClientRect().height).toBe(CHART_HEIGHT);
      expect(surface.getBoundingClientRect().width).toBeGreaterThan(0);
    });
    await expect(wrapper.style.width).not.toBe('100%');

    /* And with a real box there is a real plot area, so a pointer position maps to a
       data index and the bubble opens - the surface this story was written for and
       could not reach while the canvas was collapsed. */
    movePointerOverPlot(wrapper, 0.5);
    await waitFor(() =>
      expect(getComputedStyle(bubbleOf(canvasElement)).visibility).toBe('visible')
    );
    const items = bubbleItems(canvasElement);
    await expect(Object.keys(items).length).toBeGreaterThan(0);
    await expect(bubbleLabel(canvasElement)).not.toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The bar canvas with its tooltip open. This story previously pinned a defect: the ' +
          'wrapper and the SVG laid out at 0x0 while thirteen bar rectangles sat inside them, so ' +
          'every bar chart in the product rendered as a blank frame. The `style` prop that caused ' +
          'it is gone from `BarChartContent`, and the box assertions above are what keep it gone - ' +
          'a chart can have all of its bars and still show nothing.',
      },
    },
  },
};

export const LineTooltipWithFormatter: Story = {
  name: 'Line: label through a formatter',
  args: LINE_ARGS,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());
    const wrapper = wrapperOf(canvasElement);

    /* The control for the story above: same component, same ResponsiveContainer,
       and a real box - because `LineChartContent` passes no `style` prop, so the
       pixel width and height recharts wrote onto the wrapper survive. If someone
       ever copies the bar chart's `style` across, this line fails first. */
    await waitFor(() => {
      expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(wrapper.getBoundingClientRect().height).toBe(CHART_HEIGHT);
    });

    movePointerOverPlot(wrapper, 0.5);

    await waitFor(() =>
      expect(getComputedStyle(bubbleOf(canvasElement)).visibility).toBe('visible')
    );

    // `tooltipLabelFormatter` is the ONE hook this file gives a caller over the
    // bubble, and it touches the label only - so the label is prefixed while the
    // value below it is still the raw, unformatted number, `yTickFormatter`
    // notwithstanding. That asymmetry is the point of this story.
    const label = bubbleLabel(canvasElement);
    await expect(label).toMatch(/^Month of /);
    const month = label.replace('Month of ', '');
    const datum = REVENUE.find((point) => point.month === month);
    await expect(datum).toBeDefined();
    await expect(bubbleItems(canvasElement)).toEqual({ Revenue: String(datum?.Revenue) });

    /* The unstyled part, asserted rather than described: recharts writes these as
       inline styles, so they win over every token in the design system and the
       bubble reads the same in dark mode. Polled rather than read once - the
       content element is re-rendered as the payload lands, and a single
       synchronous read can catch the frame before it carries its own style. */
    await waitFor(() => {
      const content = bubbleOf(canvasElement).querySelector(
        '.recharts-default-tooltip'
      ) as HTMLElement;
      expect(getComputedStyle(content).backgroundColor).toBe('rgb(255, 255, 255)');
      expect(getComputedStyle(content).borderColor).toBe('rgb(204, 204, 204)');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The revenue trend, and the only chart shape in this file that reaches the screen. The ' +
          'Y ticks are formatted to `$12k` by `yTickFormatter`, and the tooltip prints `12400` - ' +
          'two different renderings of one number, a step apart on the same chart. The white box ' +
          'and grey border are recharts defaults, asserted here rather than described.',
      },
    },
  },
};

export const TooltipClosesOnLeave: Story = {
  name: 'Leaving the plot closes it',
  args: LINE_ARGS,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());
    const wrapper = wrapperOf(canvasElement);
    await waitFor(() => expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(0));

    movePointerOverPlot(wrapper, 0.35);
    await waitFor(() =>
      expect(getComputedStyle(bubbleOf(canvasElement)).visibility).toBe('visible')
    );
    const openLabel = bubbleLabel(canvasElement);
    await expect(openLabel).toMatch(/^Month of /);
    await expect(REVENUE.some((point) => `Month of ${point.month}` === openLabel)).toBe(true);

    movePointerOffPlot(wrapper);

    /* Hidden again rather than unmounted. Going inactive also drops the payload -
       recharts substitutes an empty one, so `DefaultTooltipContent` renders no
       item rows and the label collapses to an empty `<p>` - which means the
       closed bubble is byte-for-byte the resting bubble from the first story, and
       neither the visibility nor the emptied content can be checked alone. */
    await waitFor(() =>
      expect(getComputedStyle(bubbleOf(canvasElement)).visibility).toBe('hidden')
    );
    await waitFor(() => expect(bubbleItems(canvasElement)).toEqual({}));
    await expect(bubbleOf(canvasElement).textContent?.trim()).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The close path, on the line chart - the bar canvas has no plot to leave. The wrapper ' +
          'keeps a `transform` transition while it is active, but nothing animates `visibility`, ' +
          'so there is no fade and no delay - on a dashboard of several charts the bubble ' +
          'disappears the instant the pointer crosses a card edge.',
      },
    },
  },
};
