import {
  isSafeUploadFile,
  partitionUploadFiles,
  extensionOf,
  BLOCKED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
} from '@/app/features/chat/lib/uploadSafety';

const fileOf = (name: string, size = 1000): File => {
  const file = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('uploadSafety', () => {
  describe('extensionOf', () => {
    it('returns the lowercased extension', () => {
      expect(extensionOf('Report.PDF')).toBe('pdf');
      expect(extensionOf('archive.tar.gz')).toBe('gz');
    });
    it('returns an empty string when there is no extension', () => {
      expect(extensionOf('README')).toBe('');
    });
  });

  describe('isSafeUploadFile', () => {
    it('allows a normal document', () => {
      expect(isSafeUploadFile(fileOf('xray.pdf'))).toBe(true);
    });
    it('blocks executable, script and active-content extensions', () => {
      expect(isSafeUploadFile(fileOf('malware.exe'))).toBe(false);
      expect(isSafeUploadFile(fileOf('payload.JS'))).toBe(false);
      expect(isSafeUploadFile(fileOf('icon.svg'))).toBe(false);
    });
    it('blocks files over the size limit', () => {
      expect(isSafeUploadFile(fileOf('big.pdf', MAX_UPLOAD_SIZE_BYTES + 1))).toBe(false);
    });
    it('allows a file exactly at the size limit', () => {
      expect(isSafeUploadFile(fileOf('edge.pdf', MAX_UPLOAD_SIZE_BYTES))).toBe(true);
    });
  });

  describe('partitionUploadFiles', () => {
    it('splits allowed and rejected files', () => {
      const files = [fileOf('a.pdf'), fileOf('b.exe'), fileOf('c.png')];
      const { allowed, rejected } = partitionUploadFiles(files);
      expect(allowed.map((f) => f.name)).toEqual(['a.pdf', 'c.png']);
      expect(rejected.map((f) => f.name)).toEqual(['b.exe']);
    });
  });

  it('covers common malware extensions', () => {
    for (const ext of ['exe', 'bat', 'sh', 'js', 'jar', 'html', 'svg']) {
      expect(BLOCKED_UPLOAD_EXTENSIONS.has(ext)).toBe(true);
    }
  });
});
