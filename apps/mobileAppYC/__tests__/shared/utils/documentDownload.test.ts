import RNFS from 'react-native-fs';
import {
  downloadDocumentToAppStorage,
  isRemoteDocumentUri,
} from '../../../src/shared/utils/documentDownload';

describe('documentDownload Utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRemoteDocumentUri', () => {
    it('returns true for http URIs', () => {
      expect(isRemoteDocumentUri('http://example.com/file.pdf')).toBe(true);
    });

    it('returns true for https URIs', () => {
      expect(isRemoteDocumentUri('https://example.com/file.pdf')).toBe(true);
    });

    it('returns false for local file URIs', () => {
      expect(isRemoteDocumentUri('file:///storage/emulated/0/doc.pdf')).toBe(
        false,
      );
    });

    it('returns false for content URIs', () => {
      expect(
        isRemoteDocumentUri('content://com.android.providers/document/1'),
      ).toBe(false);
    });
  });

  describe('downloadDocumentToAppStorage', () => {
    it('downloads remote URIs via RNFS.downloadFile', async () => {
      const path = await downloadDocumentToAppStorage(
        'https://example.com/file.pdf',
        'file.pdf',
      );

      expect(RNFS.mkdir).toHaveBeenCalledWith(
        `${RNFS.DocumentDirectoryPath}/Downloads`,
      );
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: 'https://example.com/file.pdf',
          toFile: `${RNFS.DocumentDirectoryPath}/Downloads/file.pdf`,
        }),
      );
      expect(RNFS.copyFile).not.toHaveBeenCalled();
      expect(path).toBe(`${RNFS.DocumentDirectoryPath}/Downloads/file.pdf`);
    });

    it('copies local file:// URIs instead of downloading them', async () => {
      const path = await downloadDocumentToAppStorage(
        'file:///storage/emulated/0/picked.pdf',
        'picked.pdf',
      );

      expect(RNFS.copyFile).toHaveBeenCalledWith(
        'file:///storage/emulated/0/picked.pdf',
        `${RNFS.DocumentDirectoryPath}/Downloads/picked.pdf`,
      );
      expect(RNFS.downloadFile).not.toHaveBeenCalled();
      expect(path).toBe(`${RNFS.DocumentDirectoryPath}/Downloads/picked.pdf`);
    });

    it('copies local content:// URIs instead of downloading them', async () => {
      await downloadDocumentToAppStorage(
        'content://com.android.providers/document/1',
        'picked.docx',
      );

      expect(RNFS.copyFile).toHaveBeenCalledWith(
        'content://com.android.providers/document/1',
        `${RNFS.DocumentDirectoryPath}/Downloads/picked.docx`,
      );
      expect(RNFS.downloadFile).not.toHaveBeenCalled();
    });
  });
});
