import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import DocumentAttachmentViewer from '../../../../src/features/documents/components/DocumentAttachmentViewer';
import {Share, Alert, PermissionsAndroid, Platform, Image} from 'react-native';
import RNFS from 'react-native-fs';
import * as AttachmentUtils from '../../../../src/features/documents/components/documentAttachmentUtils';
// FIX 1: Use relative path instead of alias '@' to resolve module not found error
import * as MimeUtils from '../../../../src/shared/utils/mime';

// --- Mocks ---

// Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    documentIcon: {uri: 'icon_uri'},
    shareIcon: {uri: 'share_uri'},
    downloadIcon: {uri: 'download_uri'},
  },
}));

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      spacing: {6: 24},
      colors: {text: 'black'},
    },
  }),
}));

// Mock Utils (Styles)
jest.mock('@/shared/utils/attachmentStyles', () =>
  jest.fn(() => ({
    emptyStateContainer: {},
    emptyStateIcon: {},
    emptyStateTitle: {},
    emptyStateSubtitle: {},
    previewCard: {},
    previewCardHeader: {},
    pdfLabel: {},
    previewImage: {},
    actionRow: {},
    shareButton: {},
    shareIcon: {},
    downloadButton: {},
    downloadIcon: {},
    pdfPlaceholder: {},
    pdfIcon: {},
  })),
);

// Mock WebView
jest.mock('react-native-webview', () => {
  const ReactLib = require('react'); // FIX: Renamed to avoid shadowing
  const {View} = require('react-native');
  return {
    WebView: (props: any) => {
      return ReactLib.createElement(View, {...props, testID: 'MockWebView'});
    },
  };
});

// Mock Pdf
jest.mock('react-native-pdf', () => {
  const ReactLib = require('react'); // FIX: Renamed to avoid shadowing
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      if (props.renderActivityIndicator) {
        props.renderActivityIndicator();
      }
      return ReactLib.createElement(View, {...props, testID: 'MockPdf'});
    },
  };
});

// Mock RNFS
jest.mock('react-native-fs', () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve(),
  })),
  DownloadDirectoryPath: '/downloads',
  DocumentDirectoryPath: '/documents',
}));

// Mock Timers
jest.useFakeTimers();

// Spies
const alertSpy = jest.spyOn(Alert, 'alert');
const shareSpy = jest.spyOn(Share, 'share');
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

// --- Helper Data ---
const mockFilePdf = {
  id: '1',
  name: 'test.pdf',
  type: 'application/pdf',
  uri: 'http://test.com/test.pdf',
  size: 100,
};

const mockFileImage = {
  id: '2',
  name: 'image.png',
  type: 'image/png',
  uri: 'http://test.com/image.png',
  size: 200,
};

const mockFileDoc = {
  id: '3',
  name: 'doc.docx',
  type: 'application/msword',
  uri: 'http://test.com/doc.docx',
  size: 300,
};

const mockFileUnsupported = {
  id: '4',
  name: 'unknown.xyz',
  type: 'application/xyz',
  uri: 'http://test.com/unknown.xyz',
  size: 400,
};

// --- Tests ---

describe('DocumentAttachmentViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default Utils behavior
    jest
      .spyOn(AttachmentUtils, 'resolveSourceUri')
      .mockImplementation((f: any) => f.uri);
    jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(false);
    jest.spyOn(AttachmentUtils, 'isImageFile').mockReturnValue(false);
    jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(false);
    jest
      .spyOn(AttachmentUtils, 'buildDocViewerUri')
      .mockImplementation(uri => `office:${uri}`);
    jest
      .spyOn(AttachmentUtils, 'buildGoogleDocsViewerUri')
      .mockImplementation(uri => `google:${uri}`);

    // FIX 2: Relaxed type signature to accept string | null | undefined
    // This fixes: "Argument of type '(t: string) => string' is not assignable..."
    jest
      .spyOn(MimeUtils, 'normalizeMimeType')
      .mockImplementation((t?: string | null) => t || '');

    // Reset console spies
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  describe('Empty State', () => {
    it('renders empty state when attachments is empty', () => {
      const {getByText} = render(<DocumentAttachmentViewer attachments={[]} />);
      expect(getByText('No attachments available')).toBeTruthy();
    });

    it('renders empty state when attachments is null/undefined', () => {
      // FIX 3: Cast to 'any' to bypass TS checking for null assignment
      // This fixes: "Type 'null' is not assignable to type 'DocumentFile[]'"
      const {getByText} = render(
        <DocumentAttachmentViewer attachments={null as any} />,
      );
      expect(getByText('No attachments available')).toBeTruthy();
    });
  });

  describe('Rendering Logic', () => {
    it('renders an Image component for image files', () => {
      jest.spyOn(AttachmentUtils, 'isImageFile').mockReturnValue(true);
      const {UNSAFE_getAllByType} = render(
        <DocumentAttachmentViewer attachments={[mockFileImage]} />,
      );

      const images = UNSAFE_getAllByType(Image);
      const previewImage = images.find(
        img => img.props.source && img.props.source.uri === mockFileImage.uri,
      );

      expect(previewImage).toBeTruthy();
    });

    it('renders PdfViewer for PDF files', () => {
      jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      expect(getByTestId('MockPdf')).toBeTruthy();
    });

    it('renders DocViewer for Office files', () => {
      jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(true);
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      expect(getByTestId('MockWebView')).toBeTruthy();
    });

    it('renders Placeholder for unsupported files', () => {
      const {getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFileUnsupported]} />,
      );
      expect(
        getByText(
          'Preview unavailable right now. Try downloading or check back later.',
        ),
      ).toBeTruthy();
    });

    it('renders broken link placeholder if source uri is missing', () => {
      jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);
      const {getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFileImage]} />,
      );
      expect(getByText('File is missing or the link is broken.')).toBeTruthy();
    });

    it('renders placeholder if file is DocViewer compatible but missing URI', () => {
      jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(true);
      jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);

      const {getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('File not previewable'),
        expect.anything(),
      );
      expect(getByText('File is missing or the link is broken.')).toBeTruthy();
    });

    it('renders placeholder if logic falls through', () => {
      jest.spyOn(AttachmentUtils, 'isImageFile').mockReturnValue(false);
      jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(false);
      jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(false);

      const {getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFileUnsupported]} />,
      );
      expect(
        getByText(
          'Preview unavailable right now. Try downloading or check back later.',
        ),
      ).toBeTruthy();
    });
  });

  describe('PdfViewer Component Logic', () => {
    it('renders PDF and handles loading indicator', () => {
      jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );

      const pdfComp = getByTestId('MockPdf');
      expect(pdfComp).toBeTruthy();
    });

    it('handles PDF error by showing fallback', () => {
      jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);
      const {getByTestId, getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );

      const pdfComp = getByTestId('MockPdf');
      act(() => {
        pdfComp.props.onError(new Error('PDF Load Failed'));
      });

      expect(
        getByText(
          'Preview unavailable right now. Try downloading or check back later.',
        ),
      ).toBeTruthy();
    });
  });

  describe('DocViewer Component Logic', () => {
    beforeEach(() => {
      jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(true);
    });

    it('initializes with Office URI', () => {
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      const webView = getByTestId('MockWebView');
      expect(webView.props.source.uri).toBe('office:http://test.com/doc.docx');
    });

    it('switches to Google Docs Viewer on timeout if content not loaded', () => {
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );

      act(() => {
        jest.runAllTimers();
      });

      const webView = getByTestId('MockWebView');
      expect(webView.props.source.uri).toBe('google:http://test.com/doc.docx');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Office Online Viewer appears blank'),
      );
    });

    it('does NOT switch to Google Viewer if content loads (onLoadEnd) before timeout', () => {
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      const webView = getByTestId('MockWebView');

      act(() => {
        webView.props.onLoadStart();
        webView.props.onLoadEnd();
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(webView.props.source.uri).toBe('office:http://test.com/doc.docx');
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Office Online Viewer appears blank'),
      );
    });

    it('does NOT switch to Google Viewer if content loads (onMessage) before timeout', () => {
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      const webView = getByTestId('MockWebView');

      act(() => {
        webView.props.onMessage({nativeEvent: {data: 'loaded'}});
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(webView.props.source.uri).toBe('office:http://test.com/doc.docx');
    });

    it('switches to Google Docs on WebView Error', async () => {
      const {getByTestId} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      const webView = getByTestId('MockWebView');

      expect(webView.props.source.uri).toContain('office:');

      await act(async () => {
        webView.props.onError('Office Error');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Doc viewer error'),
        expect.objectContaining({viewer: 'office-online'}),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('switching to Google Docs Viewer'),
      );

      const updatedWebView = getByTestId('MockWebView');
      expect(updatedWebView.props.source.uri).toContain('google:');
    });

    it('shows fallback when Google Docs Viewer also fails', async () => {
      const {getByTestId, getByText} = render(
        <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
      );
      const webView = getByTestId('MockWebView');

      await act(async () => {
        webView.props.onError('First Error');
      });

      const googleWebView = getByTestId('MockWebView');
      expect(googleWebView.props.source.uri).toContain('google:');

      await act(async () => {
        googleWebView.props.onError('Second Error');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Doc viewer error'),
        expect.objectContaining({viewer: 'google-docs'}),
      );

      expect(
        getByText(
          'Preview unavailable right now. Try downloading or check back later.',
        ),
      ).toBeTruthy();
    });
  });

  describe('Share Functionality', () => {
    it('shares the file successfully', async () => {
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer
          attachments={[mockFilePdf]}
          documentTitle="My Doc"
          companionName="Bob"
        />,
      );

      const shareBtn = getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledWith({
        title: 'My Doc for Bob',
        message: 'My Doc for Bob\n\nhttp://test.com/test.pdf',
        url: 'http://test.com/test.pdf',
      });
    });

    it('handles share error', async () => {
      shareSpy.mockRejectedValueOnce(new Error('Share failed'));
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );

      const shareBtn = getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });

      expect(alertSpy).toHaveBeenCalledWith('Error', 'Share failed');
    });

    it('builds share label defaults if no title/companion provided', async () => {
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const shareBtn = getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'test.pdf',
        }),
      );
    });

    it('uses fileName when title is missing', async () => {
      const renderer = render(
        <DocumentAttachmentViewer
          attachments={[mockFilePdf]}
          documentTitle={undefined}
        />,
      );
      const shareBtn = renderer.getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'test.pdf',
        }),
      );
    });

    it('defaults to "Document" when title and filename are missing', async () => {
      const namelessFile = {...mockFilePdf, name: undefined};
      // @ts-ignore
      const renderer = render(
        <DocumentAttachmentViewer attachments={[namelessFile]} />,
      );
      const shareBtn = renderer.getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Document',
        }),
      );
    });

    it('does not append companion text when missing', async () => {
      const renderer = render(
        <DocumentAttachmentViewer
          attachments={[mockFilePdf]}
          documentTitle="My Title"
          companionName={null}
        />,
      );
      const shareBtn = renderer.getAllByLabelText('Share attachment')[0];
      await act(async () => {
        fireEvent.press(shareBtn);
      });
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Title',
        }),
      );
    });
  });

  describe('Download Functionality', () => {
    it('alerts if source uri is missing', async () => {
      jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );

      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Unavailable',
        expect.stringContaining('could not find a download link'),
      );
    });

    it('Android < 33: Request Permission -> Granted -> Download', async () => {
      Platform.OS = 'android';
      Platform.Version = 30;
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];

      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(PermissionsAndroid.request).toHaveBeenCalled();
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: 'http://test.com/test.pdf',
          toFile: '/downloads/test.pdf',
        }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Download complete',
        expect.anything(),
      );
    });

    it('Android < 33: Request Permission -> Denied -> Alert', async () => {
      Platform.OS = 'android';
      Platform.Version = 30;
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];

      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        'Permission needed',
        expect.anything(),
      );
    });

    it('Android >= 33: No Permission Request -> Download', async () => {
      Platform.OS = 'android';
      Platform.Version = 33;
      jest.spyOn(PermissionsAndroid, 'request');

      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];

      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(RNFS.downloadFile).toHaveBeenCalled();
    });

    it('iOS: No Permission Request -> Download', async () => {
      Platform.OS = 'ios';

      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];

      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(RNFS.downloadFile).toHaveBeenCalled();
    });

    it('handles filenames already containing extensions', async () => {
      Platform.OS = 'ios';
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringMatching(/\/test\.pdf$/),
        }),
      );
    });

    it('appends extension from MIME map if missing', async () => {
      Platform.OS = 'ios';
      const noExtFile = {...mockFilePdf, name: 'testfile'};
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[noExtFile]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringMatching(/\/testfile\.pdf$/),
        }),
      );
    });

    it('derives extension from mime subtype if not in map', async () => {
      Platform.OS = 'ios';
      const exoticFile = {
        ...mockFileUnsupported,
        type: 'video/mp4',
        name: 'video',
      };
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[exoticFile]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringMatching(/\/video\.mp4$/),
        }),
      );
    });

    it('defaults extension to "bin" if no mime type', async () => {
      Platform.OS = 'ios';
      // @ts-ignore
      const binFile = {...mockFileUnsupported, type: null, name: 'data'};
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[binFile]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringMatching(/\/data\.bin$/),
        }),
      );
    });

    it('sanitizes filenames', async () => {
      Platform.OS = 'ios';
      const badFile = {...mockFilePdf, name: 'bad/file:name'};
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[badFile]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringContaining('bad_file_name.pdf'),
        }),
      );
    });

    it('uses "document" default name if file name is missing', async () => {
      Platform.OS = 'ios';
      // @ts-ignore
      const noNameFile = {...mockFilePdf, name: undefined};
      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[noNameFile]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          toFile: expect.stringContaining('document.pdf'),
        }),
      );
    });

    it('alerts on download exception', async () => {
      Platform.OS = 'ios';
      // @ts-ignore
      RNFS.downloadFile.mockImplementationOnce(() => {
        throw new Error('FS Error');
      });

      const {getAllByLabelText} = render(
        <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
      );
      const dlBtn = getAllByLabelText('Download attachment')[0];
      await act(async () => {
        fireEvent.press(dlBtn);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Download failed',
        expect.anything(),
      );
    });
  });
});
