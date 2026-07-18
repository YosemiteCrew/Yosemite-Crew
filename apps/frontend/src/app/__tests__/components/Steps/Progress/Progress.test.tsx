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

  test('renders a connector between steps but not after the last one', () => {
    const steps = [
      { title: 'One', logo: '1' },
      { title: 'Two', logo: '2' },
      { title: 'Three', logo: '3' },
    ];
    const { container } = render(<Progress activeStep={0} steps={steps} />);
    expect(container.querySelectorAll('.yc-step-connector')).toHaveLength(2);
  });

  test('disables and marks non-clickable steps when canSelectStep returns false', () => {
    const steps = [
      { title: 'One', logo: '1' },
      { title: 'Two', logo: '2' },
    ];
    render(<Progress activeStep={0} steps={steps} canSelectStep={(index) => index === 0} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[0]).toHaveClass('is-clickable');
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).not.toHaveClass('is-clickable');
  });

  test('is not disabled by default when canSelectStep is not provided', () => {
    const steps = [{ title: 'One', logo: '1' }];
    render(<Progress activeStep={0} steps={steps} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  test('calls onStepSelect with the clicked step index', () => {
    const onStepSelect = jest.fn();
    const steps = [
      { title: 'One', logo: '1' },
      { title: 'Two', logo: '2' },
    ];
    render(
      <Progress
        activeStep={0}
        steps={steps}
        canSelectStep={() => true}
        onStepSelect={onStepSelect}
      />
    );
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onStepSelect).toHaveBeenCalledWith(1);
  });

  test('does not throw when a step is clicked and onStepSelect is not provided', () => {
    const steps = [{ title: 'One', logo: '1' }];
    render(<Progress activeStep={0} steps={steps} />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });
});
