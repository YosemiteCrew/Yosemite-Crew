import {useTheme} from '@/hooks';
import createAttachmentStyles from '@/shared/utils/attachmentStyles';
import type {DocumentFile} from '@/features/documents/types';
import {normalizeMimeType} from '@/shared/utils/mime';

export const DOC_VIEWER_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export const isImageFile = (mime?: string | null) => {
  const normalized = normalizeMimeType(mime);
  return Boolean(normalized?.startsWith('image/'));
};

export const isPdfFile = (mime?: string | null) =>
  normalizeMimeType(mime) === 'application/pdf';

export const isDocViewerFile = (mime?: string | null) =>
  DOC_VIEWER_TYPES.has(normalizeMimeType(mime));

export const resolveSourceUri = (file: DocumentFile) =>
  file.viewUrl ?? file.s3Url ?? file.downloadUrl ?? file.uri ?? null;

export const buildDocViewerUri = (uri: string) => {
  // Try Microsoft Office Online first
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(uri)}`;
};

export const buildGoogleDocsViewerUri = (uri: string) => {
  // Fallback to Google Docs Viewer for Office documents
  return `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`;
};

export const resolveThumbLabel = (file: DocumentFile) => file.name || 'Document';

export const resolveThumbSource = (file: DocumentFile) => {
  const source = resolveSourceUri(file);
  return {
    isImage: isImageFile(file.type),
    source,
  };
};

export const useThumbStyles = () => {
  const theme = useTheme().theme;
  return {
    styles: createAttachmentStyles(theme),
    theme,
  };
};
