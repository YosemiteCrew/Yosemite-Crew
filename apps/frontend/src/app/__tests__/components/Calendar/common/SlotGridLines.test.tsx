import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';

describe('SlotGridLines', () => {
  it('renders top boundary and minute lines', () => {
    const { container } = render(
      <SlotGridLines userId="u1" hour={9} lastVisibleHour={10} slotOffsetMinutes={[15, 30, 45]} />
    );

    const lines = container.querySelectorAll('.border-t');
    expect(lines).toHaveLength(4);

    const minuteLine = Array.from(lines).find((line) =>
      (line as HTMLElement).style.top.includes('25%')
    ) as HTMLElement;
    expect(minuteLine).toBeTruthy();
  });

  it('renders bottom boundary when current hour is last visible', () => {
    const { container } = render(
      <SlotGridLines userId="u2" hour={10} lastVisibleHour={10} slotOffsetMinutes={[]} />
    );

    const lines = container.querySelectorAll('.border-t');
    expect(lines).toHaveLength(2);
  });
});
