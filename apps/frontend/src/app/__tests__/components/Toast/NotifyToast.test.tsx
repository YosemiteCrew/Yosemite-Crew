import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import NotifyToast, { type NotifyTone } from '@/app/ui/widgets/Toast/NotifyToast';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock('react-icons/io5', () => ({
  IoCheckmarkCircle: () => <span data-testid="icon-success" />,
  IoAlertCircle: () => <span data-testid="icon-error" />,
  IoInformationCircle: () => <span data-testid="icon-info" />,
  IoWarning: () => <span data-testid="icon-warning" />,
}));

const renderToast = (
  tone: NotifyTone,
  data: { title: string; text?: string },
  closeToast = jest.fn()
) => {
  const view = render(
    <NotifyToast
      tone={tone}
      data={data}
      closeToast={closeToast}
      isPaused={false}
      toastProps={{} as any}
    />
  );
  return { ...view, closeToast };
};

describe('NotifyToast', () => {
  /* The four tones were four near-copies of the same markup before this
     component existed, which is how they drifted apart: different type sizes,
     different icon sets, one of them with no dismiss control. Naming each tone's
     glyph here pins that they still come from one recipe. */
  it.each([
    ['success' as const, 'icon-success'],
    ['error' as const, 'icon-error'],
    ['info' as const, 'icon-info'],
    ['warning' as const, 'icon-warning'],
  ])('renders the %s glyph and marks the tone on the body', (tone, iconTestId) => {
    renderToast(tone, { title: 'Slot unavailable', text: 'Pick another time.' });

    expect(screen.getByTestId(iconTestId)).toBeInTheDocument();
    expect(screen.getByText('Slot unavailable')).toBeInTheDocument();
    expect(screen.getByText('Pick another time.')).toBeInTheDocument();
    // data-tone is what a theme or a test can key off; without it the tone is
    // only expressible as an inline colour.
    expect(document.querySelector(`[data-tone="${tone}"]`)).toBeInTheDocument();
  });

  it('omits the detail line entirely when a toast carries only a title', () => {
    /* Not "renders an empty div": a title-only toast must not leave a 12.5px
       muted line behind, or the card keeps the height of a two-line toast and
       the title floats above dead space. */
    const { container } = renderToast('success', { title: 'Saved' });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    const column = container.querySelector('[data-tone="success"] > div');
    expect(column).not.toBeNull();
    expect(column?.children).toHaveLength(1);
  });

  it('renders the detail line when there is text', () => {
    const { container } = renderToast('success', { title: 'Saved', text: 'Two rooms updated.' });

    const column = container.querySelector('[data-tone="success"] > div');
    expect(column?.children).toHaveLength(2);
    expect(screen.getByText('Two rooms updated.')).toBeInTheDocument();
  });

  it('dismisses through the shared Close control', () => {
    const { closeToast } = renderToast('error', { title: 'Could not save' });

    fireEvent.click(screen.getByText('Close'));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });

  it('hides the tone glyph from assistive technology', () => {
    // The glyph repeats what the title already says, so a screen reader that
    // announced it would read the state twice.
    const { container } = renderToast('warning', { title: 'Check the dose' });

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
