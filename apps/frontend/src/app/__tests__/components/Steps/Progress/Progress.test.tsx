import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Progress from '@/app/features/onboarding/components/Steps/Progress/Progress';

const threeSteps = [
  { title: 'Personal', logo: <span data-testid="logo-0">P</span> },
  { title: 'Professional', logo: <span data-testid="logo-1">Q</span> },
  { title: 'Availability', logo: <span data-testid="logo-2">A</span> },
];

describe('Steps Progress', () => {
  test('marks completed, active and upcoming steps and fills connectors by progress', () => {
    const onStepSelect = jest.fn();
    const { container } = render(
      <Progress
        activeStep={1}
        steps={threeSteps}
        canSelectStep={(index) => index <= 1}
        onStepSelect={onStepSelect}
      />
    );

    // One badge per state.
    expect(container.querySelectorAll('.yc-step-badge.is-complete')).toHaveLength(1);
    expect(container.querySelectorAll('.yc-step-badge.is-active')).toHaveLength(1);
    expect(container.querySelectorAll('.yc-step-badge.is-upcoming')).toHaveLength(1);

    // Completed step swaps its logo for a checkmark icon; active/upcoming keep the logo.
    expect(container.querySelector('.yc-step-badge.is-complete svg')).toBeTruthy();
    expect(screen.queryByTestId('logo-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('logo-1')).toBeInTheDocument();
    expect(screen.getByTestId('logo-2')).toBeInTheDocument();

    // Active label is emphasised.
    expect(screen.getByText('Professional')).toHaveClass('is-active');

    // Two connectors: 100% behind the completed step, 50% behind the active step.
    const fills = container.querySelectorAll<HTMLElement>('.yc-step-connector-fill');
    expect(fills).toHaveLength(2);
    expect(fills[0].style.width).toBe('100%');
    expect(fills[1].style.width).toBe('50%');

    // Future step (index 2) is not selectable → disabled.
    const triggers = container.querySelectorAll<HTMLButtonElement>('.yc-step-trigger');
    expect(triggers[2]).toBeDisabled();
    expect(triggers[0]).not.toBeDisabled();

    fireEvent.click(triggers[0]);
    expect(onStepSelect).toHaveBeenCalledWith(0);
  });

  test('renders an empty connector ahead of the current step and never disables without canSelectStep', () => {
    const { container } = render(<Progress activeStep={0} steps={threeSteps} />);

    const fills = container.querySelectorAll<HTMLElement>('.yc-step-connector-fill');
    expect(fills).toHaveLength(2);
    expect(fills[0].style.width).toBe('50%');
    expect(fills[1].style.width).toBe('0%');

    const triggers = container.querySelectorAll<HTMLButtonElement>('.yc-step-trigger');
    triggers.forEach((trigger) => expect(trigger).not.toBeDisabled());

    // No onStepSelect handler provided — clicking must not throw.
    expect(() => fireEvent.click(triggers[1])).not.toThrow();
  });
});
