import { createJumpList, createWindowsNiceties } from '../src/platform/windows-niceties';

describe('createJumpList', () => {
  test('creates a taskbar jump list template', () => {
    const jumpList = createJumpList('Yosemite Crew PIMS.exe');

    expect(jumpList[0].items).toHaveLength(2);
    expect(jumpList[0].items[0]).toMatchObject({
      title: 'Open Yosemite Crew PIMS',
      args: '',
    });
    expect(jumpList[0].items[1]).toMatchObject({
      title: 'Check for Updates',
      args: '--check-for-updates',
    });
  });
});

describe('createWindowsNiceties', () => {
  test('getWindowsVersion returns provided version', () => {
    const niceties = createWindowsNiceties({
      getWindowsVersion: () => '10.0.22621',
    });
    expect(niceties.getWindowsVersion()).toBe('10.0.22621');
  });

  test('getWindowsVersion defaults to 10.0.0', () => {
    const niceties = createWindowsNiceties();
    expect(niceties.getWindowsVersion()).toBe('10.0.0');
  });

  test('setTaskbarProgress does nothing when no mainWindow', () => {
    const niceties = createWindowsNiceties();
    expect(() => niceties.setTaskbarProgress(0.5)).not.toThrow();
  });

  test('setTaskbarProgress clamps progress to 0-1 and calls setProgressBar', () => {
    const setProgressBar = jest.fn();
    const niceties = createWindowsNiceties({
      mainWindow: { setProgressBar, flashFrame: jest.fn() },
    });
    niceties.setTaskbarProgress(0.5);
    expect(setProgressBar).toHaveBeenCalledWith(0.5);

    niceties.setTaskbarProgress(1.5);
    expect(setProgressBar).toHaveBeenCalledWith(1);

    niceties.setTaskbarProgress(-1);
    expect(setProgressBar).toHaveBeenCalledWith(0);
  });

  test('setTaskbarProgress handles setProgressBar throwing', () => {
    const setProgressBar = jest.fn(() => {
      throw new Error('fail');
    });
    const niceties = createWindowsNiceties({
      mainWindow: { setProgressBar, flashFrame: jest.fn() },
    });
    expect(() => niceties.setTaskbarProgress(0.5)).not.toThrow();
  });

  test('flashTaskbar does nothing when no mainWindow', () => {
    const niceties = createWindowsNiceties();
    expect(() => niceties.flashTaskbar()).not.toThrow();
  });

  test('flashTaskbar calls flashFrame(true) on mainWindow', () => {
    const flashFrame = jest.fn();
    const niceties = createWindowsNiceties({
      mainWindow: { setProgressBar: jest.fn(), flashFrame },
    });
    niceties.flashTaskbar();
    expect(flashFrame).toHaveBeenCalledWith(true);
  });

  test('flashTaskbar handles flashFrame throwing', () => {
    const flashFrame = jest.fn(() => {
      throw new Error('fail');
    });
    const niceties = createWindowsNiceties({
      mainWindow: { setProgressBar: jest.fn(), flashFrame },
    });
    expect(() => niceties.flashTaskbar()).not.toThrow();
  });
});
