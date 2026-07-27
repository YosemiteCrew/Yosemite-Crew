import { createBackupService } from '../src/utils/backup';

describe('createBackupService', () => {
  let mockFs: Record<string, string> = {};
  let mockDirs: Record<string, string[]> = {};
  let mockStats: Record<
    string,
    { size: number; isFile: () => boolean; isDirectory: () => boolean }
  > = {};
  let createdZipPaths: string[] = [];

  const makeDeps = (nowVal = 1000) => ({
    readdirSync: jest.fn((dirPath: string) => {
      if (mockDirs[dirPath]) return [...mockDirs[dirPath]];
      return [];
    }),
    readFileSync: jest.fn((filePath: string) => {
      if (mockFs[filePath] !== undefined) return mockFs[filePath];
      throw new Error('ENOENT');
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      mockFs[filePath] = data;
    }),
    mkdirSync: jest.fn(),
    existsSync: jest.fn(
      (filePath: string) =>
        mockFs[filePath] !== undefined ||
        mockDirs[filePath] !== undefined ||
        createdZipPaths.includes(filePath)
    ),
    statSync: jest.fn((filePath: string) => {
      if (mockStats[filePath]) return mockStats[filePath];
      return { size: 100, isFile: () => true, isDirectory: () => false };
    }),
    unlinkSync: jest.fn((filePath: string) => {
      delete mockFs[filePath];
      const idx = createdZipPaths.indexOf(filePath);
      if (idx >= 0) createdZipPaths.splice(idx, 1);
    }),
    now: jest.fn(() => nowVal),
    createArchive: jest.fn(async (zipPath: string) => {
      // simulate archiver: "write" the zip to mockFs
      createdZipPaths.push(zipPath);
      mockFs[zipPath] = 'fake-zip-content';
      mockStats[zipPath] = {
        size: 16,
        isFile: () => true,
        isDirectory: () => false,
      };
    }),
  });

  beforeEach(() => {
    mockFs = {};
    mockDirs = {};
    mockStats = {};
    createdZipPaths = [];
  });

  test('createBackup creates zip backup with correct structure', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockFs['/data/patients.json'] = '[{"id":"p1"}]';
    mockFs['/data/settings.json'] = '{"theme":"dark"}';
    mockStats['/data/patients.json'] = {
      size: 20,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockStats['/data/settings.json'] = {
      size: 18,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data/patients.json', '/data/settings.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^backup-/);
    expect(result.fileCount).toBe(2);
    expect(result.size).toBe(16);
    expect(result.path).toMatch(/\.zip$/);
  });

  test('createBackup handles directory sources', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockDirs['/data'] = ['patients.json', 'settings.json'];
    mockFs['/data/patients.json'] = '{"patients":[]}';
    mockFs['/data/settings.json'] = '{"theme":"dark"}';
    mockStats['/data'] = {
      size: 0,
      isFile: () => false,
      isDirectory: () => true,
    };
    mockStats['/data/patients.json'] = {
      size: 16,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockStats['/data/settings.json'] = {
      size: 16,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(2);
  });

  test('createBackup recurses into nested subdirectories', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockDirs['/data'] = ['settings.json', 'document-vault'];
    mockDirs['/data/document-vault'] = ['manifest.json', 'doc1.enc'];
    mockStats['/data'] = {
      size: 0,
      isFile: () => false,
      isDirectory: () => true,
    };
    mockStats['/data/document-vault'] = {
      size: 0,
      isFile: () => false,
      isDirectory: () => true,
    };
    mockStats['/data/settings.json'] = {
      size: 10,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockStats['/data/document-vault/manifest.json'] = {
      size: 10,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockStats['/data/document-vault/doc1.enc'] = {
      size: 10,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockFs['/data/settings.json'] = '{}';
    mockFs['/data/document-vault/manifest.json'] = '[]';
    mockFs['/data/document-vault/doc1.enc'] = 'enc';

    const result = await svc.createBackup({
      sourcePaths: ['/data'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(true);
    // settings.json + the two files inside document-vault (the buggy version
    // skipped the nested directory and would report only 1).
    expect(result.fileCount).toBe(3);
  });

  test('createBackup returns failure when archive fails', async () => {
    const deps = makeDeps();
    deps.createArchive = jest.fn(async () => {
      throw new Error('Archive failed');
    });
    const svc = createBackupService(deps);

    mockFs['/data/patients.json'] = 'data';
    mockStats['/data/patients.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data/patients.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('createBackup skips broken symlinks in directory', async () => {
    const deps = makeDeps();
    deps.statSync = jest.fn((filePath: string) => {
      if (filePath === '/data/broken-link') throw new Error('ENOENT');
      if (mockStats[filePath]) return mockStats[filePath];
      if (filePath === '/data') return { size: 0, isFile: () => false, isDirectory: () => true };
      return { size: 100, isFile: () => true, isDirectory: () => false };
    }) as any;
    const svc = createBackupService(deps);

    mockDirs['/data'] = ['good-file.json', 'broken-link'];
    mockFs['/data/good-file.json'] = 'good-data';
    mockStats['/data/good-file.json'] = {
      size: 9,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(1);
  });

  test('createBackup encrypts when encrypt flag set and encryptString provided', async () => {
    const encryptString = jest.fn((plain: string) => Buffer.from(`encrypted:${plain}`));
    const deps = { ...makeDeps(), encryptString };
    // remove default createArchive since we want the default zip one
    const svc = createBackupService(deps);

    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
      encrypt: true,
    });

    expect(result.success).toBe(true);
    expect(result.path).toMatch(/\.enc$/);
    expect(encryptString).toHaveBeenCalled();
    // the original zip should be removed
    expect(deps.existsSync(result.path.replace(/\.enc$/, '.zip'))).toBe(false);
  });

  test('createBackup does not encrypt when encryptString not provided', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
      encrypt: true,
    });

    expect(result.success).toBe(true);
    expect(result.path).toMatch(/\.zip$/);
  });

  test('createBackup passes compressionLevel', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
      compressionLevel: 9,
    });

    expect(result.success).toBe(true);
    expect(deps.createArchive).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 9);
  });

  test('listBackups returns backups sorted by timestamp descending', async () => {
    const deps1 = makeDeps(1000);
    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };
    const svc1 = createBackupService(deps1);
    await svc1.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    const deps2 = makeDeps(2000);
    deps2.readFileSync = deps1.readFileSync;
    deps2.writeFileSync = deps1.writeFileSync;
    deps2.mkdirSync = deps1.mkdirSync;
    deps2.existsSync = deps1.existsSync;
    deps2.statSync = deps1.statSync;
    deps2.createArchive = deps1.createArchive;
    deps2.readdirSync = deps1.readdirSync;
    const svc2 = createBackupService(deps2);
    await svc2.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    const list = svc2.listBackups('/backups');
    expect(list).toHaveLength(2);
    expect(list[0].timestamp).toBe(2000);
    expect(list[1].timestamp).toBe(1000);
  });

  test('pruneOldBackups removes excess backups', async () => {
    const deps = makeDeps(1000);
    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };
    const svc = createBackupService(deps);

    await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });
    await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });
    await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    const removed = svc.pruneOldBackups('/backups', 1);
    expect(removed).toBe(2);
    expect(svc.listBackups('/backups')).toHaveLength(1);
  });

  test('deleteBackup removes backup file', () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockFs['/backup-test-1.zip'] = 'zipdata';

    expect(svc.deleteBackup('/backup-test-1.zip')).toBe(true);
    expect(deps.unlinkSync).toHaveBeenCalledWith('/backup-test-1.zip');
  });

  test('deleteBackup returns false for non-existent path', () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);
    expect(svc.deleteBackup('/nonexistent')).toBe(false);
  });

  test('setSchedule and getSchedule work correctly', () => {
    const deps = makeDeps(1000);
    const svc = createBackupService(deps);

    svc.setSchedule({ enabled: true, intervalMs: 3600000 });
    const sched = svc.getSchedule();
    expect(sched.enabled).toBe(true);
    expect(sched.intervalMs).toBe(3600000);
    expect(sched.nextRun).toBe(3601000);
  });

  test('getSchedule returns default disabled schedule', () => {
    const svc = createBackupService();
    const sched = svc.getSchedule();
    expect(sched.enabled).toBe(false);
    expect(sched.intervalMs).toBe(86400000);
  });

  test('listBackups without deps returns empty', () => {
    const svc = createBackupService();
    const list = svc.listBackups('/nonexistent-dir');
    expect(list).toEqual([]);
  });

  test('deleteBackup without deps returns false for non-existent', () => {
    const svc = createBackupService();
    expect(svc.deleteBackup('/nonexistent')).toBe(false);
  });

  test('createBackup uses default compressionLevel when not provided', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockFs['/data/db.json'] = 'data';
    mockStats['/data/db.json'] = {
      size: 4,
      isFile: () => true,
      isDirectory: () => false,
    };

    await svc.createBackup({
      sourcePaths: ['/data/db.json'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(deps.createArchive).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 6);
  });

  test('createBackup skips non-file entries in directory', async () => {
    const deps = makeDeps();
    const svc = createBackupService(deps);

    mockDirs['/data'] = ['patients.json', 'subdir'];
    mockFs['/data/patients.json'] = '{"patients":[]}';
    mockStats['/data'] = {
      size: 0,
      isFile: () => false,
      isDirectory: () => true,
    };
    mockStats['/data/patients.json'] = {
      size: 16,
      isFile: () => true,
      isDirectory: () => false,
    };
    mockStats['/data/subdir'] = {
      size: 0,
      isFile: () => false,
      isDirectory: () => true,
    };

    const result = await svc.createBackup({
      sourcePaths: ['/data'],
      destinationDir: '/backups',
      maxBackups: 5,
    });

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(1);
  });

  // Security tests for path traversal vulnerability mitigation
  describe('path traversal security', () => {
    test('rejects path traversal with .. in entry name', async () => {
      const deps = makeDeps();
      const svc = createBackupService(deps);

      // Simulate a directory with a malicious entry containing ..
      mockDirs['/data'] = ['safe.json', '..', '../etc/passwd'];
      mockFs['/data/safe.json'] = '{"safe":true}';
      mockStats['/data'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/safe.json'] = {
        size: 14,
        isFile: () => true,
        isDirectory: () => false,
      };

      const result = await svc.createBackup({
        sourcePaths: ['/data'],
        destinationDir: '/backups',
        maxBackups: 5,
      });

      expect(result.success).toBe(true);
      // Only the safe file should be included, traversal attempts should be skipped
      expect(result.fileCount).toBe(1);
      
      // Verify createArchive was called with only safe files
      const archiveCall = deps.createArchive.mock.calls[0];
      const files = archiveCall[1];
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('safe.json');
    });

    test('rejects absolute path in entry name', async () => {
      const deps = makeDeps();
      const svc = createBackupService(deps);

      // Simulate a directory with absolute path entries
      mockDirs['/data'] = ['safe.json', '/etc/passwd', '/tmp/malicious'];
      mockFs['/data/safe.json'] = '{"safe":true}';
      mockStats['/data'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/safe.json'] = {
        size: 14,
        isFile: () => true,
        isDirectory: () => false,
      };

      const result = await svc.createBackup({
        sourcePaths: ['/data'],
        destinationDir: '/backups',
        maxBackups: 5,
      });

      expect(result.success).toBe(true);
      // Only the safe file should be included
      expect(result.fileCount).toBe(1);
      
      const archiveCall = deps.createArchive.mock.calls[0];
      const files = archiveCall[1];
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('safe.json');
    });

    test('rejects nested path traversal attempts', async () => {
      const deps = makeDeps();
      const svc = createBackupService(deps);

      // Simulate nested directories with traversal attempts
      mockDirs['/data'] = ['subdir', 'safe.json'];
      mockDirs['/data/subdir'] = ['nested.json', '../../etc/passwd'];
      mockFs['/data/safe.json'] = '{"safe":true}';
      mockFs['/data/subdir/nested.json'] = '{"nested":true}';
      
      mockStats['/data'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/safe.json'] = {
        size: 14,
        isFile: () => true,
        isDirectory: () => false,
      };
      mockStats['/data/subdir'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/subdir/nested.json'] = {
        size: 16,
        isFile: () => true,
        isDirectory: () => false,
      };

      const result = await svc.createBackup({
        sourcePaths: ['/data'],
        destinationDir: '/backups',
        maxBackups: 5,
      });

      expect(result.success).toBe(true);
      // Should include safe.json and nested.json, but not the traversal attempt
      expect(result.fileCount).toBe(2);
      
      const archiveCall = deps.createArchive.mock.calls[0];
      const files = archiveCall[1];
      expect(files).toHaveLength(2);
      
      // Verify no paths contain traversal sequences
      const relativePaths = files.map(f => f.relativePath);
      expect(relativePaths).toContain('safe.json');
      expect(relativePaths).toContain('subdir/nested.json');
      
      // Ensure no path escapes the base directory
      for (const file of files) {
        expect(file.relativePath).not.toMatch(/\.\./);
        expect(file.relativePath).not.toMatch(/^\//);
      }
    });

    test('allows legitimate subdirectory traversal', async () => {
      const deps = makeDeps();
      const svc = createBackupService(deps);

      // Legitimate nested structure should work fine
      mockDirs['/data'] = ['level1'];
      mockDirs['/data/level1'] = ['level2'];
      mockDirs['/data/level1/level2'] = ['deep.json'];
      mockFs['/data/level1/level2/deep.json'] = '{"deep":true}';
      
      mockStats['/data'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/level1'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/level1/level2'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/level1/level2/deep.json'] = {
        size: 14,
        isFile: () => true,
        isDirectory: () => false,
      };

      const result = await svc.createBackup({
        sourcePaths: ['/data'],
        destinationDir: '/backups',
        maxBackups: 5,
      });

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);
      
      const archiveCall = deps.createArchive.mock.calls[0];
      const files = archiveCall[1];
      expect(files[0].relativePath).toBe('level1/level2/deep.json');
    });

    test('rejects mixed traversal patterns', async () => {
      const deps = makeDeps();
      const svc = createBackupService(deps);

      // Test various obfuscated traversal attempts
      mockDirs['/data'] = ['safe.json', '..\\..\\etc\\passwd', './../secret', 'subdir/../../../etc/shadow'];
      mockFs['/data/safe.json'] = '{"safe":true}';
      mockStats['/data'] = {
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
      };
      mockStats['/data/safe.json'] = {
        size: 14,
        isFile: () => true,
        isDirectory: () => false,
      };

      const result = await svc.createBackup({
        sourcePaths: ['/data'],
        destinationDir: '/backups',
        maxBackups: 5,
      });

      expect(result.success).toBe(true);
      // Only safe file should be included
      expect(result.fileCount).toBe(1);
      
      const archiveCall = deps.createArchive.mock.calls[0];
      const files = archiveCall[1];
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('safe.json');
    });
  });
});
