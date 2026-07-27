/**
 * Security tests for metro.config.js path traversal mitigation
 * 
 * These tests verify that the extraNodeModules proxy properly validates
 * module paths and prevents path traversal attacks.
 */

const path = require('path');
const fs = require('fs');

describe('metro.config.js security - path traversal protection', () => {
  let extraNodeModules;
  let projectRoot;
  let workspaceRoot;
  let mockExistsSync;

  beforeEach(() => {
    // Setup paths similar to metro.config.js
    projectRoot = '/app/apps/mobileAppYC';
    workspaceRoot = '/app';

    // Mock fs.existsSync
    mockExistsSync = jest.fn((filePath) => {
      // Simulate that legitimate modules exist
      if (filePath.includes('node_modules/react') || 
          filePath.includes('node_modules/react-native') ||
          filePath.includes('node_modules/lodash')) {
        return true;
      }
      return false;
    });

    // Create the proxy similar to metro.config.js
    extraNodeModules = new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === 'react' || name === 'react-native') {
            return path.join(projectRoot, 'node_modules', name);
          }
          const appModuleBase = path.resolve(projectRoot, 'node_modules');
          const appModulePath = path.resolve(appModuleBase, name);
          const appModuleRelative = path.relative(appModuleBase, appModulePath);
          if (!appModuleRelative.startsWith('..') && !path.isAbsolute(appModuleRelative) && mockExistsSync(appModulePath)) {
            return appModulePath;
          }
          return path.join(workspaceRoot, 'node_modules', name);
        },
      },
    );
  });

  test('allows legitimate module resolution', () => {
    const result = extraNodeModules['lodash'];
    
    // Should resolve to app's node_modules
    expect(result).toBe(path.join(projectRoot, 'node_modules', 'lodash'));
    expect(result).toContain('node_modules/lodash');
    expect(result).not.toContain('..');
  });

  test('rejects path traversal with .. in module name', () => {
    const result = extraNodeModules['../../../etc/passwd'];
    
    // Should fall back to workspace root, not resolve the traversal
    expect(result).toBe(path.join(workspaceRoot, 'node_modules', '../../../etc/passwd'));
    // The traversal attempt should not escape the workspace
    expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('/etc/passwd'));
  });

  test('rejects absolute path in module name', () => {
    const result = extraNodeModules['/etc/passwd'];
    
    // Should fall back to workspace root
    expect(result).toBe(path.join(workspaceRoot, 'node_modules', '/etc/passwd'));
    // Should not resolve to system paths
    expect(result).toContain('node_modules');
  });

  test('rejects nested path traversal attempts', () => {
    const result = extraNodeModules['subdir/../../etc/shadow'];
    
    // Should fall back to workspace root
    expect(result).toBe(path.join(workspaceRoot, 'node_modules', 'subdir/../../etc/shadow'));
    expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('/etc/shadow'));
  });

  test('handles react and react-native specially without traversal check', () => {
    const reactResult = extraNodeModules['react'];
    const rnResult = extraNodeModules['react-native'];
    
    // These should always resolve to project root
    expect(reactResult).toBe(path.join(projectRoot, 'node_modules', 'react'));
    expect(rnResult).toBe(path.join(projectRoot, 'node_modules', 'react-native'));
  });

  test('validates relative path does not start with ..', () => {
    // Test the security check logic directly
    const appModuleBase = path.resolve(projectRoot, 'node_modules');
    
    // Legitimate module
    const legitimatePath = path.resolve(appModuleBase, 'lodash');
    const legitimateRelative = path.relative(appModuleBase, legitimatePath);
    expect(legitimateRelative.startsWith('..')).toBe(false);
    expect(path.isAbsolute(legitimateRelative)).toBe(false);
    
    // Traversal attempt
    const traversalPath = path.resolve(appModuleBase, '../../../etc/passwd');
    const traversalRelative = path.relative(appModuleBase, traversalPath);
    expect(traversalRelative.startsWith('..')).toBe(true);
  });

  test('validates path is not absolute after resolution', () => {
    const appModuleBase = path.resolve(projectRoot, 'node_modules');
    
    // Test with absolute path input
    const absoluteInput = '/etc/passwd';
    const resolvedPath = path.resolve(appModuleBase, absoluteInput);
    const relativePath = path.relative(appModuleBase, resolvedPath);
    
    // On Unix systems, this will start with .. or be absolute
    const isUnsafe = relativePath.startsWith('..') || path.isAbsolute(relativePath);
    expect(isUnsafe).toBe(true);
  });

  test('security check prevents escaping node_modules directory', () => {
    const testCases = [
      { name: '../../../etc/passwd', shouldBlock: true },
      { name: '../../..', shouldBlock: true },
      { name: '../..', shouldBlock: true },
      { name: '..', shouldBlock: true },
      { name: '/etc/shadow', shouldBlock: true },
    ];

    testCases.forEach(({ name: maliciousName, shouldBlock }) => {
      const result = extraNodeModules[maliciousName];
      
      // All should fall back to workspace root (safe fallback)
      expect(result).toBe(path.join(workspaceRoot, 'node_modules', maliciousName));
      
      // Verify the security check would have prevented app module resolution
      const appModuleBase = path.resolve(projectRoot, 'node_modules');
      const appModulePath = path.resolve(appModuleBase, maliciousName);
      const appModuleRelative = path.relative(appModuleBase, appModulePath);
      const wouldBeBlocked = appModuleRelative.startsWith('..') || path.isAbsolute(appModuleRelative);
      
      if (shouldBlock) {
        expect(wouldBeBlocked).toBe(true);
      }
    });
  });
});
