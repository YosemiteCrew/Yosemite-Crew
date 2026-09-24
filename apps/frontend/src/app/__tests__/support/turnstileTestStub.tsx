import React from 'react';
import { act } from '@testing-library/react';

// Shared Turnstile stubs for forms that render <BotCheck>. Wire the script mock
// from a `jest.mock` factory via `jest.requireActual` (factories run before imports):
//
//   jest.mock('next/script', () => ({
//     __esModule: true,
//     default: jest.requireActual('@/app/__tests__/support/turnstileTestStub').NextScriptMock,
//   }));

/** Stands in for next/script: two buttons that fire its onReady / onError. */
export const NextScriptMock = ({
  onReady,
  onError,
}: {
  onReady: () => void;
  onError: () => void;
}) => (
  <>
    <button type="button" onClick={onReady}>
      Load bot check
    </button>
    <button type="button" onClick={onError}>
      Fail bot check script
    </button>
  </>
);

type WidgetOptions = Record<string, unknown>;

/** Installs a fake window.turnstile and returns its mocks plus token helpers. */
export function installTurnstileStub() {
  let options: WidgetOptions | undefined;
  const render = jest.fn((_container: HTMLElement, widgetOptions: WidgetOptions) => {
    options = widgetOptions;
    return 'widget-1';
  });
  const reset = jest.fn();
  const remove = jest.fn();
  (globalThis.window as Window & { turnstile?: unknown }).turnstile = { render, reset, remove };

  return {
    render,
    reset,
    remove,
    options: () => options,
    solve: (token: string) =>
      act(() => {
        (options?.callback as (value: string) => void)(token);
      }),
    expire: () =>
      act(() => {
        (options?.['expired-callback'] as () => void)();
      }),
  };
}

export function removeTurnstileStub() {
  delete (globalThis.window as Window & { turnstile?: unknown }).turnstile;
}
