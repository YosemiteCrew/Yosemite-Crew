import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Progress from '@/app/features/onboarding/components/Steps/Progress/Progress';

describe('Steps Progress', () => {
  test('marks the active step', () => {
    const steps = [
      { title: 'Organisation', logo: '1' },
      { title: 'Address', logo: '2' },
    ];

    const { container } = render(<Progress activeStep={1} steps={steps} />);

    const titles = screen.getAllByText(/Organisation|Address/);
    expect(titles[1]).toHaveClass('activestep');

    const activeBadges = container.querySelectorAll('.activestepbackground');
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  test('renders a dash between steps but not after the last one', () => {
    const steps = [
      { title: 'One', logo: '1' },
      { title: 'Two', logo: '2' },
      { title: 'Three', logo: '3' },
    ];
    const { container } = render(<Progress activeStep={0} steps={steps} />);
    expect(container.querySelectorAll('.step-dash')).toHaveLength(2);
  });

  test('disables and marks non-clickable steps when canSelectStep returns false', () => {
    const steps = [
      { title: 'One', logo: '1' },
      { title: 'Two', logo: '2' },
    ];
    render(<Progress activeStep={0} steps={steps} canSelectStep={(index) => index === 0} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[0]).toHaveClass('stepclickable');
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).not.toHaveClass('stepclickable');
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
