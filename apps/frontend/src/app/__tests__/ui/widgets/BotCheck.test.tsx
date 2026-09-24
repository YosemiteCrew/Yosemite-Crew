import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BotCheck, TURNSTILE_UNAVAILABLE_ERROR } from '@/app/ui/widgets/BotCheck/BotCheck';
import { useBotCheck } from '@/app/ui/widgets/BotCheck/useBotCheck';
import {
  installTurnstileStub,
  removeTurnstileStub,
} from '@/app/__tests__/support/turnstileTestStub';

jest.mock('next/script', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/turnstileTestStub').NextScriptMock,
}));

const REQUIRED = 'Complete the check.';

describe('BotCheck', () => {
  let turnstile: ReturnType<typeof installTurnstileStub>;

  beforeEach(() => {
    turnstile = installTurnstileStub();
  });

  afterEach(() => {
    removeTurnstileStub();
  });

  it('renders only the unavailable message when it has no site key', () => {
    render(<BotCheck action="contact_form" resetCounter={0} onTokenChange={jest.fn()} />);

    expect(screen.getByText(TURNSTILE_UNAVAILABLE_ERROR)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load bot check' })).not.toBeInTheDocument();
  });

  it('renders the widget for the given action and reports tokens', () => {
    const onTokenChange = jest.fn();
    render(
      <BotCheck
        siteKey="site-key"
        action="contact_form"
        resetCounter={0}
        onTokenChange={onTokenChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));
    expect(turnstile.render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'site-key', action: 'contact_form' })
    );
    turnstile.solve('synthetic-widget-token');
    expect(onTokenChange).toHaveBeenLastCalledWith('synthetic-widget-token');
  });

  it('does not reset a widget on first render, only when the counter moves', () => {
    const props = {
      siteKey: 'site-key',
      action: 'contact_form',
      onTokenChange: jest.fn(),
    };
    const { rerender } = render(<BotCheck {...props} resetCounter={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));
    expect(turnstile.reset).not.toHaveBeenCalled();

    rerender(<BotCheck {...props} resetCounter={1} />);
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
  });
});

describe('useBotCheck', () => {
  it('is a no-op without a site key', () => {
    const { result } = renderHook(() => useBotCheck(undefined, REQUIRED));

    expect(result.current.required).toBe(false);
    let ready = false;
    act(() => {
      ready = result.current.ensureToken();
    });
    expect(ready).toBe(true);
    act(() => {
      expect(result.current.takeToken()).toBe('');
    });
    expect(result.current.widgetProps.resetCounter).toBe(0);
    expect(result.current.widgetProps.error).toBeUndefined();
  });

  it('requires a token, hands it over once and bumps the reset counter', () => {
    const { result } = renderHook(() => useBotCheck('site-key', REQUIRED));
    expect(result.current.required).toBe(true);

    let ready = true;
    act(() => {
      ready = result.current.ensureToken();
    });
    expect(ready).toBe(false);
    expect(result.current.widgetProps.error).toBe(REQUIRED);

    act(() => result.current.widgetProps.onTokenChange('synthetic-widget-token'));
    expect(result.current.widgetProps.error).toBeUndefined();

    let token = '';
    act(() => {
      ready = result.current.ensureToken();
      token = result.current.takeToken();
    });
    expect(ready).toBe(true);
    expect(token).toBe('synthetic-widget-token');
    expect(result.current.widgetProps.resetCounter).toBe(1);

    act(() => {
      ready = result.current.ensureToken();
    });
    expect(ready).toBe(false);
  });

  it('shows the widget error, or the required message when a token expires', () => {
    const { result } = renderHook(() => useBotCheck('site-key', REQUIRED));

    act(() => result.current.widgetProps.onTokenChange('', TURNSTILE_UNAVAILABLE_ERROR));
    expect(result.current.widgetProps.error).toBe(TURNSTILE_UNAVAILABLE_ERROR);

    act(() => result.current.widgetProps.onTokenChange(''));
    expect(result.current.widgetProps.error).toBe(REQUIRED);
  });
});
