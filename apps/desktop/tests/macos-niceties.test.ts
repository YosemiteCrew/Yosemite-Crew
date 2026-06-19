import {
  createDockMenuTemplate,
  normalizeLoginItemSettings,
  notificationActionCategories,
} from '../src/platform/macos-niceties';

describe('macOS niceties', () => {
  test('normalizes open-at-login settings', () => {
    expect(normalizeLoginItemSettings(true)).toEqual({
      openAtLogin: true,
      openAsHidden: true,
    });
    expect(normalizeLoginItemSettings(false)).toEqual({
      openAtLogin: false,
      openAsHidden: false,
    });
  });

  test('creates a dock menu template from injected actions', () => {
    const deps = {
      show: jest.fn(),
      checkForUpdates: jest.fn(),
      newWindow: jest.fn(),
    };
    const menu = createDockMenuTemplate(deps);

    expect(menu.map((item) => item.id)).toEqual(['show', 'check-for-updates', 'new-window']);
    menu[0].click();
    menu[1].click();
    menu[2].click();
    expect(deps.show).toHaveBeenCalledTimes(1);
    expect(deps.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(deps.newWindow).toHaveBeenCalledTimes(1);
  });

  test('defines notification action categories', () => {
    expect(notificationActionCategories()).toEqual([
      {
        id: 'pims-message',
        actions: [
          { id: 'open', title: 'Open' },
          { id: 'dismiss', title: 'Dismiss' },
        ],
      },
    ]);
  });
});
