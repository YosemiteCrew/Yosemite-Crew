import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Stack from '@/app/ui/Stack';

describe('Stack', () => {
  it('uses defaults and numeric gap conversion', () => {
    render(
      <Stack data-testid="stack">
        <div>Child</div>
      </Stack>
    );

    const el = screen.getByTestId('stack');
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('items-start');
    expect(el.className).toContain('justify-start');
    expect((el as HTMLElement).style.gap).toBe('12px');
  });

  it('applies row direction, wrap, custom gap string, and extra classes', () => {
    render(
      <Stack
        data-testid="stack"
        direction="row"
        align="center"
        justify="between"
        wrap
        gap="2rem"
        className="custom"
      />
    );

    const el = screen.getByTestId('stack');
    expect(el.className).toContain('flex-row');
    expect(el.className).toContain('items-center');
    expect(el.className).toContain('justify-between');
    expect(el.className).toContain('flex-wrap');
    expect(el.className).toContain('custom');
    expect((el as HTMLElement).style.gap).toBe('2rem');
  });
});
