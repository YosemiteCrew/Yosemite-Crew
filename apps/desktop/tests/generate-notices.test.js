const fs = require('node:fs');
const path = require('node:path');

// Recreate the readJson and licenseTextFor functions with security checks for testing
const nodeModulesRoot = path.join(__dirname, '..', 'node_modules');

const readJson = (filePath) => {
  const base = path.resolve(nodeModulesRoot);
  const target = path.resolve(filePath);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
};

const licenseTextFor = (dir) => {
  const licenseFileNames = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'LICENCE.md',
    'NOTICE',
    'NOTICE.md',
  ];
  
  for (const name of licenseFileNames) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const base = path.resolve(nodeModulesRoot);
      const target = path.resolve(candidate);
      const relative = path.relative(base, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Invalid file path');
      }
      return fs.readFileSync(target, 'utf8').trim();
    }
  }
  return '';
};

describe('generate-notices path traversal protection', () => {
  const testDataDir = path.join(__dirname, 'test-notices-data');
  const testNodeModules = path.join(testDataDir, 'node_modules');
  const testPackageDir = path.join(testNodeModules, 'test-package');

  beforeAll(() => {
    // Create test directory structure
    if (!fs.existsSync(testPackageDir)) {
      fs.mkdirSync(testPackageDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(testPackageDir, 'package.json'),
      JSON.stringify({ name: 'test-package', version: '1.0.0', license: 'MIT' })
    );
    fs.writeFileSync(
      path.join(testPackageDir, 'LICENSE'),
      'MIT License\n\nTest license text'
    );
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('readJson security validation', () => {
    it('should reject path traversal with double dots', () => {
      expect(() => {
        readJson('../../../etc/passwd');
      }).toThrow('Invalid file path');
    });

    it('should reject path traversal in middle of path', () => {
      expect(() => {
        readJson('node_modules/../../../etc/passwd');
      }).toThrow('Invalid file path');
    });

    it('should reject absolute Unix paths', () => {
      expect(() => {
        readJson('/etc/passwd');
      }).toThrow('Invalid file path');
    });

    it('should reject absolute Windows paths', () => {
      const windowsPath = 'C:\\Windows\\System32\\config\\sam';
      if (path.isAbsolute(windowsPath)) {
        expect(() => {
          readJson(windowsPath);
        }).toThrow('Invalid file path');
      } else {
        // On Unix, this would fail with ENOENT, which is acceptable
        expect(() => {
          readJson(windowsPath);
        }).toThrow();
      }
    });

    it('should reject URL-encoded path traversal', () => {
      expect(() => {
        readJson('..%2F..%2F..%2Fetc%2Fpasswd');
      }).toThrow('Invalid file path');
    });
  });

  describe('licenseTextFor security validation', () => {
    it('should reject path traversal attempts in license file reading', () => {
      expect(() => {
        licenseTextFor('../../../etc');
      }).toThrow('Invalid file path');
    });

    it('should reject absolute paths in license file reading', () => {
      expect(() => {
        licenseTextFor('/etc');
      }).toThrow('Invalid file path');
    });

    it('should reject backslash path traversal', () => {
      expect(() => {
        licenseTextFor('..\\..\\..\\windows\\system32');
      }).toThrow('Invalid file path');
    });
  });
});
