import { createSecondaryDisplayManager, generateWhiteboardHtml } from '../src/ui/secondary-display';

describe('createSecondaryDisplayManager', () => {
  let windowIds: string[] = [];
  let idCounter = 0;

  const mockGetDisplays = (): DisplayInfo[] => [
    {
      id: 'primary',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      isPrimary: true,
      scaleFactor: 2,
    },
    {
      id: 'secondary',
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      isPrimary: false,
      scaleFactor: 1,
    },
  ];

  const makeDeps = () => ({
    getDisplays: jest.fn(mockGetDisplays),
    createWindow: jest.fn(() => {
      const id = `win-${++idCounter}`;
      windowIds.push(id);
      return id;
    }),
    closeWindow: jest.fn((id: string) => {
      windowIds = windowIds.filter((w) => w !== id);
      return true;
    }),
    generateId: jest.fn(() => `disp-${++idCounter}`),
  });

  beforeEach(() => {
    windowIds = [];
    idCounter = 0;
  });

  test('openDisplay creates a window on non-primary display', () => {
    const deps = makeDeps();
    const mgr = createSecondaryDisplayManager(deps);

    const id = mgr.openDisplay({
      role: 'whiteboard',
      url: '/whiteboard',
      mode: 'extend',
      displayIndex: 1,
    });
    expect(id).toBe('disp-1');
    expect(deps.createWindow).toHaveBeenCalledTimes(1);
    expect(mgr.getDisplayIds()).toHaveLength(1);
  });

  test('closeDisplay removes a display', () => {
    const deps = makeDeps();
    const mgr = createSecondaryDisplayManager(deps);

    const id = mgr.openDisplay({
      role: 'whiteboard',
      url: '/whiteboard',
      mode: 'extend',
      displayIndex: 1,
    });
    expect(mgr.closeDisplay(id)).toBe(true);
    expect(mgr.getDisplayIds()).toHaveLength(0);
    // closeWindow must receive the real window id returned by createWindow
    // (win-N), not the generated display id (disp-N) the manager hands callers.
    // openDisplay calls generateId() (disp-1) before createWindow() (win-2).
    expect(deps.closeWindow).toHaveBeenCalledWith('win-2');
    expect(deps.closeWindow).not.toHaveBeenCalledWith(id);
  });

  test('closeAll closes the real window ids returned by createWindow', () => {
    const deps = makeDeps();
    const mgr = createSecondaryDisplayManager(deps);

    mgr.openDisplay({ role: 'whiteboard', url: '/wb1', mode: 'extend', displayIndex: 1 });
    mgr.openDisplay({ role: 'kiosk', url: '/kiosk', mode: 'extend', displayIndex: 1 });

    mgr.closeAll();
    const closedWith = deps.closeWindow.mock.calls.map((c: string[]) => c[0]);
    // First open: generateId disp-1, createWindow win-2. Second: disp-3, win-4.
    expect(closedWith).toEqual(expect.arrayContaining(['win-2', 'win-4']));
    expect(closedWith).not.toContain('disp-1');
  });

  test('closeDisplay returns false for unknown id', () => {
    const mgr = createSecondaryDisplayManager();
    expect(mgr.closeDisplay('nonexistent')).toBe(false);
  });

  test('closeAll closes all displays', () => {
    const deps = makeDeps();
    const mgr = createSecondaryDisplayManager(deps);

    mgr.openDisplay({
      role: 'whiteboard',
      url: '/wb1',
      mode: 'extend',
      displayIndex: 1,
    });
    mgr.openDisplay({
      role: 'kiosk',
      url: '/kiosk',
      mode: 'extend',
      displayIndex: 1,
    });

    mgr.closeAll();
    expect(mgr.getDisplayIds()).toHaveLength(0);
  });

  test('getDisplays returns current state', () => {
    const deps = makeDeps();
    const mgr = createSecondaryDisplayManager(deps);

    mgr.openDisplay({
      role: 'whiteboard',
      url: '/whiteboard',
      mode: 'extend',
      displayIndex: 0,
    });

    const displays = mgr.getDisplays();
    expect(displays).toHaveLength(1);
    expect(displays[0].config.role).toBe('whiteboard');
    expect(displays[0].status).toBe('open');
  });

  test('handles no secondary display available', () => {
    const deps = {
      getDisplays: jest.fn(() => []),
      createWindow: jest.fn(),
    };
    const mgr = createSecondaryDisplayManager(deps);

    mgr.openDisplay({
      role: 'whiteboard',
      url: '/whiteboard',
      mode: 'mirror',
      displayIndex: 0,
    });
    expect(deps.createWindow).toHaveBeenCalledTimes(1);
  });
});

describe('generateWhiteboardHtml', () => {
  test('generates HTML with patient cards', () => {
    const html = generateWhiteboardHtml([
      {
        name: 'Buddy',
        owner: 'John Smith',
        status: 'waiting',
        reason: 'Annual checkup',
        waitTime: 15,
      },
      {
        name: 'Max',
        owner: 'Jane Doe',
        status: 'checked-in',
        reason: 'Vaccination',
      },
      { name: 'Luna', status: 'in-treatment', reason: 'Surgery' },
    ]);

    expect(html).toContain('Exam Room Whiteboard');
    expect(html).toContain('Buddy');
    expect(html).toContain('Max');
    expect(html).toContain('Luna');
    expect(html).toContain('John Smith');
    expect(html).toContain('15m');
    expect(html).toContain('waiting');
    expect(html).toContain('checked-in');
    expect(html).toContain('in-treatment');
  });

  test('generates empty state when no patients', () => {
    const html = generateWhiteboardHtml([]);
    expect(html).toContain('No patients currently in the clinic');
  });

  test('escapes HTML in patient names', () => {
    const html = generateWhiteboardHtml([
      { name: '<script>alert("xss")</script>', status: 'waiting' },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
