import {renderHook} from '@testing-library/react-native';
import {
  isImageFile,
  isPdfFile,
  isDocViewerFile,
  resolveSourceUri,
  buildDocViewerUri,
  buildGoogleDocsViewerUri,
  resolveThumbLabel,
  resolveThumbSource,
  useThumbStyles,
  DOC_VIEWER_TYPES,
} from '../../../../src/features/documents/components/documentAttachmentUtils';
import {normalizeMimeType} from '../../../../src/shared/utils/mime';
import createAttachmentStyles from '../../../../src/shared/utils/attachmentStyles';
import {useTheme} from '@/hooks';

// --- Mocks ---

// 1. Mock Mime Utils
jest.mock('@/shared/utils/mime', () => ({
  normalizeMimeType: jest.fn(),
}));

// 2. Mock Style Creator
jest.mock('@/shared/utils/attachmentStyles', () => jest.fn());

// 3. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: jest.fn(),
}));

describe('documentAttachmentUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Type Checkers ---

  describe('isImageFile', () => {
    it('returns true if normalized mime starts with image/', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('image/png');
      expect(isImageFile('image/png')).toBe(true);
    });

    it('returns false if normalized mime does not start with image/', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('application/pdf');
      expect(isImageFile('application/pdf')).toBe(false);
    });

    it('returns false if mime is null/undefined', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue(undefined);
      expect(isImageFile(null)).toBe(false);
    });
  });

  describe('isPdfFile', () => {
    it('returns true for application/pdf', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('application/pdf');
      expect(isPdfFile('anything')).toBe(true);
    });

    it('returns false for other types', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('image/jpeg');
      expect(isPdfFile('image/jpeg')).toBe(false);
    });
  });

  describe('isDocViewerFile', () => {
    it('returns true for known doc viewer types', () => {
      const docType = 'application/msword';
      (normalizeMimeType as jest.Mock).mockReturnValue(docType);

      // Sanity check that the set has it
      expect(DOC_VIEWER_TYPES.has(docType)).toBe(true);

      expect(isDocViewerFile('whatever')).toBe(true);
    });

    it('returns false for unknown types', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('video/mp4');
      expect(isDocViewerFile('video/mp4')).toBe(false);
    });
  });

  // --- 2. URI Resolution Logic ---

  describe('resolveSourceUri', () => {
    it('prioritizes viewUrl', () => {
      const file = {
        id: '1',
        name: 'f',
        type: 't',
        viewUrl: 'http://view',
        s3Url: 'http://s3',
        downloadUrl: 'http://dl',
        uri: 'http://uri'
      };
      expect(resolveSourceUri(file as any)).toBe('http://view');
    });

    it('falls back to s3Url', () => {
      const file = {
        id: '1',
        name: 'f',
        type: 't',
        s3Url: 'http://s3',
        downloadUrl: 'http://dl',
        uri: 'http://uri'
      };
      expect(resolveSourceUri(file as any)).toBe('http://s3');
    });

    it('falls back to downloadUrl', () => {
        const file = {
            id: '1',
            name: 'f',
            type: 't',
            downloadUrl: 'http://dl',
            uri: 'http://uri'
          };
      expect(resolveSourceUri(file as any)).toBe('http://dl');
    });

    it('falls back to uri', () => {
        const file = {
            id: '1',
            name: 'f',
            type: 't',
            uri: 'http://uri'
          };
      expect(resolveSourceUri(file as any)).toBe('http://uri');
    });

    it('returns null if no sources available', () => {
        const file = { id: '1', name: 'f', type: 't' };
        expect(resolveSourceUri(file as any)).toBeNull();
    });
  });

  // --- 3. Viewer URI Builders ---

  describe('URI Builders', () => {
    const TEST_URI = 'http://example.com/file.doc';
    const ENCODED = encodeURIComponent(TEST_URI);

    it('buildDocViewerUri formats correctly for MS Office', () => {
      expect(buildDocViewerUri(TEST_URI)).toBe(
        `https://view.officeapps.live.com/op/embed.aspx?src=${ENCODED}`
      );
    });

    it('buildGoogleDocsViewerUri formats correctly for Google', () => {
      expect(buildGoogleDocsViewerUri(TEST_URI)).toBe(
        `https://docs.google.com/viewer?url=${ENCODED}&embedded=true`
      );
    });
  });

  // --- 4. Label & Thumb Source Helpers ---

  describe('resolveThumbLabel', () => {
    it('returns file name if present', () => {
      expect(resolveThumbLabel({id: '1', type: 'pdf', name: 'MyDoc.pdf'} as any)).toBe('MyDoc.pdf');
    });

    it('returns default "Document" if name missing', () => {
      expect(resolveThumbLabel({id: '1', type: 'pdf', name: ''} as any)).toBe('Document');
    });
  });

  describe('resolveThumbSource', () => {
    it('returns isImage=true and source when file is image', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('image/jpeg');

      const file = {id: '1', type: 'jpg', uri: 'http://img.jpg'};
      const result = resolveThumbSource(file as any);

      expect(result).toEqual({
        isImage: true,
        source: 'http://img.jpg',
      });
    });

    it('returns isImage=false when file is not image', () => {
      (normalizeMimeType as jest.Mock).mockReturnValue('application/pdf');

      const file = {id: '1', type: 'pdf', uri: 'http://doc.pdf'};
      const result = resolveThumbSource(file as any);

      expect(result).toEqual({
        isImage: false,
        source: 'http://doc.pdf',
      });
    });
  });

  // --- 5. Hook: useThumbStyles ---

  describe('useThumbStyles', () => {
    it('creates styles using the current theme', () => {
      const mockTheme = {colors: {primary: 'red'}};
      const mockGeneratedStyles = {container: {flex: 1}};

      (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
      (createAttachmentStyles as jest.Mock).mockReturnValue(mockGeneratedStyles);

      const {result} = renderHook(() => useThumbStyles());

      expect(useTheme).toHaveBeenCalled();
      expect(createAttachmentStyles).toHaveBeenCalledWith(mockTheme);

      expect(result.current).toEqual({
        styles: mockGeneratedStyles,
        theme: mockTheme,
      });
    });
  });
});