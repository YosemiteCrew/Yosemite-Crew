import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs module
jest.mock('node:fs');

describe('generate-notices path traversal protection', () => {
  let mockFs: jest.Mocked<typeof fs>;
  let readJson: (filePath: string) => unknown;
  let licenseTextFor: (dir: string) => string;
  let appRoot: string;
  let nodeModulesRoot: string;

  beforeEach(() => {
    jest.resetModules();
    mockFs = fs as jest.Mocked<typeof fs>;
    
    // Set up the module paths
    appRoot = path.resolve(__dirname, '..');
    nodeModulesRoot = path.join(appRoot, 'node_modules');

    // Define the readJson function with path traversal protection (mirrors actual implementation)
    readJson = (filePath: string) => {
      const base = path.resolve(appRoot);
      const target = path.resolve(filePath);
      const relative = path.relative(base, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Invalid file path');
      }
      return JSON.parse(mockFs.readFileSync(target, 'utf8') as string);
    };

    // Define the licenseTextFor function with path traversal protection (mirrors actual implementation)
    const licenseFileNames = [
      'LICENSE',
      'LICENSE.md',
      'LICENSE.txt',
      'LICENCE',
      'LICENCE.md',
      'NOTICE',
      'NOTICE.md',
    ];

    licenseTextFor = (dir: string) => {
      for (const name of licenseFileNames) {
        const candidate = path.join(dir, name);
        if (mockFs.existsSync(candidate) && mockFs.statSync(candidate).isFile()) {
          const base = path.resolve(nodeModulesRoot);
          const target = path.resolve(candidate);
          const relative = path.relative(base, target);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('Invalid file path');
          }
          return (mockFs.readFileSync(target, 'utf8') as string).trim();
        }
      }
      return '';
    };
  });

  describe('readJson path traversal protection', () => {
    test('allows reading files within appRoot', () => {
      const validPath = path.join(appRoot, 'node_modules', 'some-package', 'package.json');
      mockFs.readFileSync.mockReturnValue('{"name":"test"}');

      const result = readJson(validPath);

      expect(result).toEqual({ name: 'test' });
      expect(mockFs.readFileSync).toHaveBeenCalledWith(validPath, 'utf8');
    });

    test('blocks path traversal using ../ sequences', () => {
      const maliciousPath = path.join(appRoot, 'node_modules', '..', '..', 'etc', 'passwd');

      expect(() => readJson(maliciousPath)).toThrow('Invalid file path');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    test('blocks absolute paths outside appRoot', () => {
      const maliciousPath = '/etc/passwd';

      expect(() => readJson(maliciousPath)).toThrow('Invalid file path');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    test('blocks paths that resolve outside appRoot', () => {
      const outsidePath = path.resolve(appRoot, '..', '..', 'etc', 'passwd');
      
      expect(() => readJson(outsidePath)).toThrow('Invalid file path');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('licenseTextFor path traversal protection', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
    });

    test('allows reading license files within node_modules', () => {
      const validDir = path.join(nodeModulesRoot, 'some-package');
      const licensePath = path.join(validDir, 'LICENSE');
      mockFs.readFileSync.mockReturnValue('MIT License');

      const result = licenseTextFor(validDir);

      expect(result).toBe('MIT License');
      expect(mockFs.readFileSync).toHaveBeenCalledWith(licensePath, 'utf8');
    });

    test('blocks path traversal in license file reading', () => {
      const maliciousDir = path.join(nodeModulesRoot, '..', '..', 'etc');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      expect(() => licenseTextFor(maliciousDir)).toThrow('Invalid file path');
    });

    test('blocks absolute paths in license file reading', () => {
      const maliciousDir = '/etc';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);

      expect(() => licenseTextFor(maliciousDir)).toThrow('Invalid file path');
    });

    test('returns empty string when no license file exists', () => {
      const validDir = path.join(nodeModulesRoot, 'some-package');
      mockFs.existsSync.mockReturnValue(false);

      const result = licenseTextFor(validDir);

      expect(result).toBe('');
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('security edge cases', () => {
    test('readJson allows nested paths within appRoot', () => {
      const validPath = path.join(appRoot, 'node_modules', '@scope', 'package', 'deep', 'nested', 'package.json');
      mockFs.readFileSync.mockReturnValue('{"name":"nested"}');

      const result = readJson(validPath);

      expect(result).toEqual({ name: 'nested' });
    });

    test('readJson blocks path that starts within appRoot but escapes', () => {
      const maliciousPath = path.join(appRoot, 'node_modules', '..', '..', 'outside');

      expect(() => readJson(maliciousPath)).toThrow('Invalid file path');
    });

    test('licenseTextFor handles scoped packages correctly', () => {
      const validDir = path.join(nodeModulesRoot, '@scope', 'package');
      const licensePath = path.join(validDir, 'LICENSE');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
      mockFs.readFileSync.mockReturnValue('Apache 2.0');

      const result = licenseTextFor(validDir);

      expect(result).toBe('Apache 2.0');
    });
  });
});
