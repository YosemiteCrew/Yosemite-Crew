/**
 * Client-side guard that mirrors the server-side Stream upload policy
 * (configureStreamUploadPolicy on the backend). It stops executable, script and
 * browser-active files — and oversized files — from being attached before they
 * reach Stream. The Stream app policy is the authoritative control (it cannot be
 * bypassed by a token holder); this is fast-fail UX so users get clear feedback.
 */

export const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  // Windows executables / installers
  'exe',
  'com',
  'dll',
  'scr',
  'pif',
  'cpl',
  'msi',
  'msp',
  'mst',
  'bat',
  'cmd',
  'jar',
  // macOS / Linux executables, libraries & packages
  'app',
  'dmg',
  'pkg',
  'deb',
  'rpm',
  'elf',
  'so',
  'dylib',
  // Scripts
  'sh',
  'bash',
  'zsh',
  'ps1',
  'psm1',
  'psd1',
  'vbs',
  'vbe',
  'js',
  'mjs',
  'cjs',
  'jse',
  'wsf',
  'wsh',
  'hta',
  'reg',
  'py',
  'pyc',
  'rb',
  'pl',
  'php',
  'phtml',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'ahk',
  'scpt',
  // Markup / active content a browser may execute when opened from the CDN
  'html',
  'htm',
  'xhtml',
  'shtml',
  'svg',
  'svgz',
  'swf',
  'mht',
  'mhtml',
  // Shortcuts / misc dangerous launchers
  'lnk',
  'url',
  'scf',
  'inf',
  'gadget',
  'msc',
  'jnlp',
]);

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export const isSafeUploadFile = (file: File): boolean => {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return false;
  return !BLOCKED_UPLOAD_EXTENSIONS.has(extensionOf(file.name));
};

export const partitionUploadFiles = (
  files: FileList | File[]
): { allowed: File[]; rejected: File[] } => {
  const allowed: File[] = [];
  const rejected: File[] = [];
  for (const file of Array.from(files)) {
    if (isSafeUploadFile(file)) {
      allowed.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { allowed, rejected };
};
