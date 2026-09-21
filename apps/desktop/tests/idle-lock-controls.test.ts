/**
 * @jest-environment jsdom
 */

// The lock screen's controls are a plain browser script: the local pages load
// them over file:// under a strict CSP, so a compiled module would not reach
// them. It assigns `module.exports`, so it imports here - untyped, hence the
// surface restated below for the type checker.
import fs from 'node:fs';
import path from 'node:path';
import untypedControls from '../src/pages/idle-lock-controls.js';

interface Controls {
  init(doc: Document, bridge: unknown): void;
  VERIFYING: string;
  SIGNING_OUT: string;
  UNAVAILABLE: string;
  FAILED: string;
}

const controls = untypedControls as unknown as Controls;

const PAGE = path.join(__dirname, '..', 'src', 'pages', 'idle-lock.html');

type FailHandler = () => void;

interface Bridge {
  idleUnlock: jest.Mock<void, [string]>;
  onIdleUnlockFailed: jest.Mock<void, [FailHandler]>;
}

const loadPage = (): void => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!body) throw new Error('idle-lock.html no longer has a body to load');
  document.body.innerHTML = body[1]!;
};

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`idle-lock.html no longer has #${id}`);
  return found as T;
};

const setup = (): Bridge => {
  loadPage();
  const bridge: Bridge = { idleUnlock: jest.fn(), onIdleUnlockFailed: jest.fn() };
  controls.init(document, bridge);
  return bridge;
};

const fail = (bridge: Bridge): void => {
  const handler = bridge.onIdleUnlockFailed.mock.calls[0]?.[0];
  if (!handler) throw new Error('the controls never registered a failure handler');
  handler();
};

const escape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
};

const status = (): HTMLElement => el('lockStatus');
const panel = (): HTMLElement => el('signOutConfirm');

// The card's buttons are queried rather than listed by id, so a control added
// later has to be disabled with the rest, and the array is compared whole so an
// empty query cannot report a pass.
const disabledStates = (): boolean[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('#lockCard button')).map(
    (button) => button.disabled
  );

describe('idle lock controls', () => {
  test('the page still has the controls these tests drive', () => {
    // Guards every case below: they resolve ids out of the shipped HTML, and a
    // renamed id would otherwise make them fail loudly rather than silently -
    // this states the dependency once, in one place.
    loadPage();
    for (const id of [
      'lockCard',
      'unlock',
      'usePassword',
      'signOutConfirm',
      'confirmSignOut',
      'cancelSignOut',
      'lockStatus',
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  test('the sign-out button asks before it signs out', () => {
    const bridge = setup();
    expect(panel().hidden).toBe(true);

    el('usePassword').click();

    // Nothing has been sent and the status line has not claimed otherwise.
    expect(bridge.idleUnlock).not.toHaveBeenCalled();
    expect(status().textContent).toBe('');
    expect(panel().hidden).toBe(false);
    expect(el('usePassword').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(el('confirmSignOut'));
  });

  test('confirming sends the sign-out and says so', () => {
    const bridge = setup();
    el('usePassword').click();
    el('confirmSignOut').click();

    expect(bridge.idleUnlock).toHaveBeenCalledWith('password');
    expect(status().textContent).toBe(controls.SIGNING_OUT);
  });

  test('cancelling sends nothing and gives focus back', () => {
    const bridge = setup();
    el('usePassword').click();
    el('cancelSignOut').click();

    expect(bridge.idleUnlock).not.toHaveBeenCalled();
    expect(panel().hidden).toBe(true);
    expect(el('usePassword').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el('usePassword'));
  });

  test('a second press on the sign-out button closes the question again', () => {
    const bridge = setup();
    el('usePassword').click();
    el('usePassword').click();

    expect(panel().hidden).toBe(true);
    expect(bridge.idleUnlock).not.toHaveBeenCalled();
  });

  test('Escape closes the question instead of dismissing the card', () => {
    const bridge = setup();
    el('usePassword').click();
    escape();

    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(el('usePassword'));
    expect(bridge.idleUnlock).not.toHaveBeenCalled();
  });

  test('Escape is cancelled whether or not the question is open', () => {
    setup();
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    // A key that is not Escape is left alone.
    const other = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    document.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  test('a pending check disables every control and marks the card busy', () => {
    const bridge = setup();
    el('unlock').click();

    expect(bridge.idleUnlock).toHaveBeenCalledWith('biometric');
    expect(status().textContent).toBe(controls.VERIFYING);
    expect(el('lockCard').getAttribute('aria-busy')).toBe('true');
    expect(disabledStates()).toEqual([true, true, true, true]);
  });

  test('a sign-out pressed during a check is not sent and does not change the status', () => {
    const bridge = setup();
    el('usePassword').click();
    el('unlock').click();

    // The question closed for the check; the buttons behind it are inert, so
    // even a dispatched click cannot reach the main process. Closing it does
    // not pull focus off the button the user just pressed.
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).not.toBe(el('usePassword'));
    el('confirmSignOut').click();
    el('usePassword').click();

    expect(bridge.idleUnlock).toHaveBeenCalledTimes(1);
    expect(bridge.idleUnlock).toHaveBeenCalledWith('biometric');
    expect(status().textContent).toBe(controls.VERIFYING);
  });

  test('Escape leaves the question up while the sign-out is running', () => {
    const bridge = setup();
    el('usePassword').click();
    el('confirmSignOut').click();
    escape();

    // The sign-out is already on its way; hiding the question it belongs to
    // would leave the card saying "Signing out…" with nothing explaining it.
    expect(panel().hidden).toBe(false);
    expect(bridge.idleUnlock).toHaveBeenCalledTimes(1);
  });

  test('a failed check reads as an error and hands the controls back', () => {
    const bridge = setup();
    el('unlock').click();
    fail(bridge);

    expect(status().textContent).toBe(controls.FAILED);
    expect(status().classList.contains('is-error')).toBe(true);
    expect(el('lockCard').hasAttribute('aria-busy')).toBe(false);
    expect(disabledStates()).toEqual([false, false, false, false]);

    // And the next attempt is accepted, without the error style left behind.
    el('unlock').click();
    expect(bridge.idleUnlock).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe(controls.VERIFYING);
    expect(status().classList.contains('is-error')).toBe(false);
  });

  test('a page with no bridge says so rather than pretending to verify', () => {
    loadPage();
    controls.init(document, undefined);

    el('unlock').click();
    expect(status().textContent).toBe(controls.UNAVAILABLE);
    expect(status().classList.contains('is-error')).toBe(true);
    // Not busy: there is nothing to wait for, so the buttons stay usable.
    expect(el<HTMLButtonElement>('unlock').disabled).toBe(false);
    expect(el('lockCard').hasAttribute('aria-busy')).toBe(false);
  });
});
