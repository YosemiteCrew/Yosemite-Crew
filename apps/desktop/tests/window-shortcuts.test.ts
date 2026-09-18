import {
  createWindowInputHandler,
  WINDOW_SHORTCUTS,
  type WindowInput,
} from '../src/ui/window-shortcuts';

const keyDown = (overrides: Partial<WindowInput> = {}): WindowInput => ({
  type: 'keyDown',
  key: '1',
  control: false,
  meta: true,
  alt: false,
  shift: false,
  ...overrides,
});

describe('createWindowInputHandler', () => {
  const run = (input: WindowInput, isMac = true) => {
    const activateTabByIndex = jest.fn();
    const preventDefault = jest.fn();
    createWindowInputHandler({ activateTabByIndex, isMac })({ preventDefault }, input);
    return { activateTabByIndex, preventDefault };
  };

  test('lists one accelerator per tab-jump key', () => {
    expect(WINDOW_SHORTCUTS).toEqual([
      'CommandOrControl+1',
      'CommandOrControl+2',
      'CommandOrControl+3',
      'CommandOrControl+4',
      'CommandOrControl+5',
      'CommandOrControl+6',
      'CommandOrControl+7',
      'CommandOrControl+8',
      'CommandOrControl+9',
    ]);
  });

  test('Cmd+1 through Cmd+9 activate the tab at that position', () => {
    for (let n = 1; n <= 9; n += 1) {
      const { activateTabByIndex, preventDefault } = run(keyDown({ key: String(n) }));
      expect(activateTabByIndex).toHaveBeenCalledWith(n - 1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  test('the modifier is Ctrl off macOS and Cmd on it', () => {
    expect(
      run(keyDown({ meta: false, control: true }), false).activateTabByIndex
    ).toHaveBeenCalled();
    expect(
      run(keyDown({ meta: true, control: false }), false).activateTabByIndex
    ).not.toHaveBeenCalled();
    expect(
      run(keyDown({ meta: false, control: true }), true).activateTabByIndex
    ).not.toHaveBeenCalled();
  });

  test('ignores key-up, so one press activates one tab', () => {
    const { activateTabByIndex, preventDefault } = run(keyDown({ type: 'keyUp' }));
    expect(activateTabByIndex).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test('leaves the key alone without the modifier, or with Alt or Shift held', () => {
    for (const input of [
      keyDown({ meta: false }),
      keyDown({ alt: true }),
      keyDown({ shift: true }),
    ]) {
      const { activateTabByIndex, preventDefault } = run(input);
      expect(activateTabByIndex).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  test('leaves every key outside 1-9 to the page', () => {
    for (const key of ['0', 'a', 'T', '/', 'F5', 'ArrowLeft', '10']) {
      const { activateTabByIndex, preventDefault } = run(keyDown({ key }));
      expect(activateTabByIndex).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
});
