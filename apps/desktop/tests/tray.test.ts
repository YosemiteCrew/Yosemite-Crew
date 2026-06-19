import { createTrayMenuTemplate } from '../src/ui/tray';

describe('createTrayMenuTemplate', () => {
  const makeDeps = (visible: boolean) => ({
    isVisible: jest.fn(() => visible),
    show: jest.fn(),
    hide: jest.fn(),
    checkForUpdates: jest.fn(),
    quit: jest.fn(),
  });

  test('shows a hide command when the app window is visible', () => {
    const deps = makeDeps(true);
    const menu = createTrayMenuTemplate(deps);

    expect(menu[0].label).toBe('Hide Yosemite Crew PIMS');
    menu[0].click?.();
    expect(deps.hide).toHaveBeenCalledTimes(1);
    expect(deps.show).not.toHaveBeenCalled();
  });

  test('shows a show command when the app window is hidden', () => {
    const deps = makeDeps(false);
    const menu = createTrayMenuTemplate(deps);

    expect(menu[0].label).toBe('Show Yosemite Crew PIMS');
    menu[0].click?.();
    expect(deps.show).toHaveBeenCalledTimes(1);
    expect(deps.hide).not.toHaveBeenCalled();
  });

  test('exposes update and quit actions', () => {
    const deps = makeDeps(true);
    const menu = createTrayMenuTemplate(deps);

    menu.find((item) => item.id === 'check-for-updates')?.click?.();
    menu.find((item) => item.id === 'quit')?.click?.();

    expect(deps.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(deps.quit).toHaveBeenCalledTimes(1);
    expect(menu.find((item) => item.type === 'separator')).toBeDefined();
  });

  test('includes quick actions when provided', () => {
    const deps = {
      ...makeDeps(true),
      quickActions: [
        { id: 'new-appointment', label: 'New appointment', click: jest.fn() },
        { id: 'find-patient', label: 'Find patient', click: jest.fn() },
      ],
    };
    const menu = createTrayMenuTemplate(deps);

    const newAppt = menu.find((item) => item.id === 'quick-new-appointment');
    expect(newAppt).toBeDefined();
    expect(newAppt!.label).toBe('New appointment');

    const findPt = menu.find((item) => item.id === 'quick-find-patient');
    expect(findPt).toBeDefined();
    expect(findPt!.label).toBe('Find patient');
  });

  test('omits quick actions section when empty', () => {
    const deps = { ...makeDeps(true), quickActions: [] };
    const menu = createTrayMenuTemplate(deps);

    const quickSep = menu.find((item) => item.id === 'quick-actions-sep');
    expect(quickSep).toBeUndefined();
  });
});
