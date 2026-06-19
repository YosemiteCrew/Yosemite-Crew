import { rotateLogIfNeeded, rotatedLogPath, shouldRotateLog } from '../src/utils/log-rotation';

const makeDeps = (sizes: Record<string, number>) => {
  const files = new Map(Object.entries(sizes));
  const calls: string[] = [];
  return {
    calls,
    existsSync: (path: string) => files.has(path),
    statSync: (path: string) => ({ size: files.get(path) || 0 }),
    renameSync: (from: string, to: string) => {
      calls.push(`rename:${from}->${to}`);
      files.set(to, files.get(from) || 0);
      files.delete(from);
    },
    unlinkSync: (path: string) => {
      calls.push(`unlink:${path}`);
      files.delete(path);
    },
  };
};

describe('log rotation', () => {
  test('builds stable rotated file names', () => {
    expect(rotatedLogPath('/tmp/desktop.log', 2)).toBe('/tmp/desktop.log.2');
  });

  test('rotates only when the active log reaches the byte cap', () => {
    const deps = makeDeps({ '/tmp/desktop.log': 99 });
    expect(shouldRotateLog('/tmp/desktop.log', 100, deps)).toBe(false);
    expect(shouldRotateLog('/tmp/desktop.log', 99, deps)).toBe(true);
    expect(shouldRotateLog('/tmp/missing.log', 100, deps)).toBe(false);
  });

  test('rolls existing rotated logs and removes the oldest', () => {
    const deps = makeDeps({
      '/tmp/desktop.log': 200,
      '/tmp/desktop.log.1': 100,
      '/tmp/desktop.log.2': 50,
    });

    expect(
      rotateLogIfNeeded({ filePath: '/tmp/desktop.log', maxBytes: 100, maxFiles: 2 }, deps)
    ).toBe(true);
    expect(deps.calls).toEqual([
      'unlink:/tmp/desktop.log.2',
      'rename:/tmp/desktop.log.1->/tmp/desktop.log.2',
      'rename:/tmp/desktop.log->/tmp/desktop.log.1',
    ]);
  });

  test('does nothing when rotation is disabled', () => {
    const deps = makeDeps({ '/tmp/desktop.log': 200 });
    expect(
      rotateLogIfNeeded({ filePath: '/tmp/desktop.log', maxBytes: 100, maxFiles: 0 }, deps)
    ).toBe(false);
    expect(deps.calls).toEqual([]);
  });

  test('returns false when maxBytes is 0', () => {
    const deps = makeDeps({ '/tmp/desktop.log': 200 });
    expect(shouldRotateLog('/tmp/desktop.log', 0, deps)).toBe(false);
  });

  test('rolls when some rotated files are missing', () => {
    const deps = makeDeps({
      '/tmp/desktop.log': 200,
      '/tmp/desktop.log.1': 100,
    });
    expect(
      rotateLogIfNeeded({ filePath: '/tmp/desktop.log', maxBytes: 100, maxFiles: 3 }, deps)
    ).toBe(true);
    expect(deps.calls).toEqual([
      'rename:/tmp/desktop.log.1->/tmp/desktop.log.2',
      'rename:/tmp/desktop.log->/tmp/desktop.log.1',
    ]);
  });
});
