import { createReloadGuard } from '../src/core/reload-guard';

describe('createReloadGuard', () => {
  test('allows reloads up to the limit, then blocks within the window', () => {
    const t = 1000;
    const guard = createReloadGuard({
      maxReloads: 3,
      windowMs: 10000,
      now: () => t,
    });

    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(false);
    expect(guard.shouldReload()).toBe(false);
  });

  test('forgets attempts older than the window', () => {
    let t = 0;
    const guard = createReloadGuard({
      maxReloads: 2,
      windowMs: 5000,
      now: () => t,
    });

    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(false);

    t += 6000;
    expect(guard.shouldReload()).toBe(true);
  });

  test('reset clears the recorded attempts', () => {
    const t = 0;
    const guard = createReloadGuard({
      maxReloads: 1,
      windowMs: 10000,
      now: () => t,
    });

    expect(guard.shouldReload()).toBe(true);
    expect(guard.shouldReload()).toBe(false);
    guard.reset();
    expect(guard.shouldReload()).toBe(true);
  });

  test('uses sane defaults when no options are given', () => {
    const guard = createReloadGuard();
    expect(guard.shouldReload()).toBe(true);
    expect(typeof guard.reset).toBe('function');
  });
});
