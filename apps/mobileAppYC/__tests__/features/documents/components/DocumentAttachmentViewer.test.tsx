import React from 'react';
import {Alert, Image, PermissionsAndroid, Platform, Share} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import RNFS from 'react-native-fs';
import DocumentAttachmentViewer from '../../../../src/features/documents/components/DocumentAttachmentViewer';
import * as AttachmentUtils from '../../../../src/features/documents/components/documentAttachmentUtils';
import * as MimeUtils from '../../../../src/shared/utils/mime';
import {mockTheme} from '../setup/mockTheme';

jest.mock('@/assets/images', () => ({
  Images: {
    documentIcon: {uri: 'icon_uri'},
    shareIcon: {uri: 'share_uri'},
    downloadIcon: {uri: 'download_uri'},
  },
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/utils/attachmentStyles', () =>
  jest.fn(() => ({
    emptyStateContainer: {},
    emptyStateIcon: {},
    emptyStateTitle: {},
    emptyStateSubtitle: {},
    previewCard: {},
    previewCardHeader: {},
    previewContentCard: {},
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

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('react-native-pdf', () => {
  const ReactLib = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      ReactLib.createElement(View, {...props, testID: 'MockPdf'}),
  };
});

jest.mock('react-native-fs', () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve(),
  })),
  DownloadDirectoryPath: '/downloads',
  DocumentDirectoryPath: '/documents',
}));

const alertSpy = jest.spyOn(Alert, 'alert');
const shareSpy = jest.spyOn(Share, 'share');
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

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

describe('DocumentAttachmentViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).DownloadDirectoryPath = '/downloads';
    (RNFS as any).DocumentDirectoryPath = '/documents';
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 34,
    });
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    jest
      .spyOn(AttachmentUtils, 'resolveSourceUri')
      .mockImplementation((file: any) => file.uri);
    jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(false);
    jest.spyOn(AttachmentUtils, 'isImageFile').mockReturnValue(false);
    jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(false);
    jest
      .spyOn(MimeUtils, 'normalizeMimeType')
      .mockImplementation((type?: string | null) => type || '');
  });

  it('renders empty state when attachments are missing', () => {
    const {getByText} = render(
      <DocumentAttachmentViewer attachments={null as any} />,
    );

    expect(getByText('No attachments available')).toBeTruthy();
  });

  it('renders an image preview for image files', () => {
    jest.spyOn(AttachmentUtils, 'isImageFile').mockReturnValue(true);

    const {UNSAFE_getAllByType} = render(
      <DocumentAttachmentViewer attachments={[mockFileImage]} />,
    );

    const previewImage = UNSAFE_getAllByType(Image).find(
      image => image.props.source?.uri === mockFileImage.uri,
    );
    expect(previewImage).toBeTruthy();
  });

  it('renders a PDF preview for pdf files', () => {
    jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);

    const {getByTestId} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    expect(getByTestId('MockPdf')).toBeTruthy();
  });

  it('disables embedded previews for office documents', () => {
    jest.spyOn(AttachmentUtils, 'isDocViewerFile').mockReturnValue(true);

    const {getByText} = render(
      <DocumentAttachmentViewer attachments={[mockFileDoc]} />,
    );

    expect(
      getByText(
        'Preview disabled for this file type. Download the file to view it securely.',
      ),
    ).toBeTruthy();
  });

  it('shows a broken-link placeholder when the source uri is missing', () => {
    jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);

    const {getByText} = render(
      <DocumentAttachmentViewer attachments={[mockFileImage]} />,
    );

    expect(getByText('File is missing or the link is broken.')).toBeTruthy();
  });

  it('shares the selected file', async () => {
    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer
        attachments={[mockFilePdf]}
        documentTitle="My Doc"
        companionName="Bob"
      />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Share attachment')[0]);
    });

    expect(shareSpy).toHaveBeenCalledWith({
      title: 'My Doc for Bob',
      message: 'My Doc for Bob\n\nhttp://test.com/test.pdf',
      url: 'http://test.com/test.pdf',
    });
  });

  it('downloads the selected file', async () => {
    jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(RNFS.mkdir).toHaveBeenCalledWith('/downloads');
    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUrl: 'http://test.com/test.pdf',
        toFile: '/downloads/test.pdf',
      }),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Download complete',
      expect.stringContaining('/downloads/test.pdf'),
    );
  });

  it('falls back when pdf rendering fails', () => {
    jest.spyOn(AttachmentUtils, 'isPdfFile').mockReturnValue(true);

    const {getByTestId, getByText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    act(() => {
      getByTestId('MockPdf').props.onError(new Error('PDF failed'));
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(
      getByText(
        'Preview unavailable right now. Try downloading or check back later.',
      ),
    ).toBeTruthy();
  });

  it('shows a generic share label when no title, companion, or url exists', async () => {
    jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer
        attachments={[{...mockFileDoc, name: ''} as any]}
      />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Share attachment')[0]);
    });

    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Document',
      message: 'Document',
      url: '',
    });
  });

  it('shows an alert when sharing fails', async () => {
    shareSpy.mockRejectedValueOnce(new Error('share failed'));

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Share attachment')[0]);
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'share failed');
  });

  it('falls back to a generic message when share fails with a non-error value', async () => {
    shareSpy.mockRejectedValueOnce('share exploded');

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Share attachment')[0]);
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to share');
  });

  it('blocks download when a source url is unavailable', async () => {
    jest.spyOn(AttachmentUtils, 'resolveSourceUri').mockReturnValue(null);

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Unavailable',
      'We could not find a download link for this file. Please try again later.',
    );
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
  });

  it('requests storage permission on legacy android and stops when denied', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 30,
    });
    (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce(
      PermissionsAndroid.RESULTS.DENIED,
    );

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Permission needed',
      'Please grant storage permission to download files.',
    );
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
  });

  it('falls back to document directory and inferred extension when downloading unknown file types', async () => {
    (RNFS as any).DownloadDirectoryPath = undefined;

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer
        attachments={[
          {
            ...mockFileDoc,
            name: 'folder/report',
            type: 'application/custom-type',
            uri: 'http://test.com/report',
          } as any,
        ]}
      />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(RNFS.mkdir).toHaveBeenCalledWith('/documents');
    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        toFile: '/documents/folder_report.custom-type',
      }),
    );
  });

  it('skips permission requests on android 13+ and falls back to bin filenames', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 34,
    });

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer
        attachments={[
          {
            ...mockFileDoc,
            name: '',
            type: undefined,
            uri: 'http://test.com/blob',
          } as any,
        ]}
      />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        toFile: '/downloads/document.bin',
      }),
    );
  });

  it('shows a failure alert when download throws', async () => {
    (RNFS.downloadFile as jest.Mock).mockReturnValueOnce({
      promise: Promise.reject(new Error('download failed')),
    });

    const {getAllByLabelText} = render(
      <DocumentAttachmentViewer attachments={[mockFilePdf]} />,
    );

    await act(async () => {
      fireEvent.press(getAllByLabelText('Download attachment')[0]);
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[DocumentAttachmentViewer] Download error',
      expect.any(Error),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Download failed',
      'Unable to download the file. Please check your connection and try again.',
    );
  });
});
