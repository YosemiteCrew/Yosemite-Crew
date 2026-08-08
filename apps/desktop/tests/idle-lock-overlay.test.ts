'use strict';

import { createIdleLockOverlay } from '../src/ui/idle-lock-overlay';

describe('createIdleLockOverlay', () => {
  const makeDeps = () => ({ mount: jest.fn(), unmount: jest.fn() });

  test('starts hidden', () => {
    const overlay = createIdleLockOverlay(makeDeps());
    expect(overlay.isVisible()).toBe(false);
  });

  test('show() mounts once and marks visible', () => {
    const deps = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });

  test('show() is idempotent while already visible', () => {
    const deps = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });

  test('hide() unmounts once and marks hidden', () => {
    const deps = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    expect(deps.unmount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(false);
  });

  test('hide() is a no-op when not visible', () => {
    const deps = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.hide();
    expect(deps.unmount).not.toHaveBeenCalled();
    expect(overlay.isVisible()).toBe(false);
  });

  test('supports repeated show/hide cycles', () => {
    const deps = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(2);
    expect(deps.unmount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });
});
