/* istanbul ignore file -- mock handlers for document upload UI */
import {Alert} from 'react-native';
import {useCallback} from 'react';
import RNFS from 'react-native-fs';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import {
  pick,
  keepLocalCopy,
  types as pickerTypes,
  isErrorWithCode,
  errorCodes,
  type DocumentPickerResponse,
} from '@react-native-documents/picker';
import type {DocumentFile} from '@/features/documents/types';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from '@/features/documents/constants';
import {generateId} from '@/shared/utils/helpers';

type FileUploadMode = 'mixed' | 'images-only' | 'documents-only';

export interface DocumentFileHandlerOptions {
  mode?: FileUploadMode;
  maxFileSizeInBytes?: number;
}

interface UseDocumentFileHandlersParams<T extends {id: string}> {
  files: T[];
  setFiles: (files: T[]) => void;
  clearError?: () => void;
  options?: DocumentFileHandlerOptions;
}

const DEFAULT_CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  quality: 0.8,
  saveToPhotos: false,
};

const DEFAULT_GALLERY_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  selectionLimit: 1,
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
};

const PICKER_DOCUMENT_TYPES = [
  pickerTypes.pdf,
  pickerTypes.doc,
  pickerTypes.docx,
  pickerTypes.xls,
  pickerTypes.xlsx,
  pickerTypes.ppt,
  pickerTypes.pptx,
  pickerTypes.plainText,
];

const PICKER_IMAGE_TYPES = [pickerTypes.images];

const getPickerTypes = (mode: FileUploadMode) => {
  switch (mode) {
    case 'images-only':
      return PICKER_IMAGE_TYPES;
    case 'documents-only':
      return PICKER_DOCUMENT_TYPES;
    default:
      return [...PICKER_IMAGE_TYPES, ...PICKER_DOCUMENT_TYPES];
  }
};

const getFileExtension = (name?: string | null) => {
  if (!name) {
    return null;
  }
  const match = /\.[^/.]+$/.exec(name);
  return match ? match[0].toLowerCase() : null;
};

const sanitizeFileName = (name?: string | null, fallbackExtension?: string) => {
  const safeName = name?.trim();
  if (safeName) {
    return safeName;
  }
  const extension = fallbackExtension && fallbackExtension.startsWith('.')
    ? fallbackExtension
    : '';
  return `document-${Date.now()}${extension}`;
};

const inferMimeType = (type?: string | null, name?: string | null) => {
  if (type) {
    return type;
  }
  const extension = getFileExtension(name);
  if (extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }
  return 'application/octet-stream';
};

const isImageMimeType = (mime?: string | null) =>
  Boolean(mime && mime.startsWith('image/'));

const isDocumentMimeType = (mime?: string | null) =>
  Boolean(mime && ALLOWED_DOCUMENT_MIME_TYPES.includes(mime));

const formatLimitLabel = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

const normalizeFileUri = (uri: string) =>
  uri.startsWith('file://') ? uri.replace('file://', '') : uri;

const resolveVirtualMime = (file: DocumentPickerResponse) => {
  if (!file.isVirtual || !file.convertibleToMimeTypes?.length) {
    return undefined;
  }

  const allowed = new Set(ALLOWED_FILE_TYPES);
  const match = file.convertibleToMimeTypes.find(meta =>
    allowed.has(meta.mimeType),
  );

  return match?.mimeType ?? file.convertibleToMimeTypes[0]?.mimeType;
};

const ensureFileSize = async (
  uri: string,
  providedSize?: number | null,
): Promise<number | null> => {
  if (typeof providedSize === 'number' && providedSize > 0) {
    return providedSize;
  }

  try {
    const stats = await RNFS.stat(normalizeFileUri(uri));
    const parsed = Number(stats.size);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    console.warn('[useDocumentFileHandlers] Unable to read file size', error);
    return null;
  }
};

const showUnsupportedTypeAlert = (mode: FileUploadMode) => {
  if (mode === 'images-only') {
    Alert.alert(
      'Images only',
      'This section only accepts image files (PNG, JPG, JPEG, HEIC).',
    );
    return;
  }
  if (mode === 'documents-only') {
    Alert.alert(
      'Documents only',
      'Please upload a document such as PDF, DOC, XLS, or PPT.',
    );
    return;
  }
  Alert.alert(
    'Unsupported file',
    'Allowed formats are PDF, DOC, XLS, PPT, PNG, JPG, JPEG, or HEIC.',
  );
};

const showUnreadableFileAlert = () => {
  Alert.alert(
    'Unable to read file',
    'We could not read the selected file. Please try picking it again.',
  );
};

const showFileTooLargeAlert = (maxBytes: number) => {
  Alert.alert(
    'File too large',
    `Each file must be ${formatLimitLabel(maxBytes)} or smaller.`,
  );
};

const buildDocumentFileFromPicker = async <T extends DocumentFile>(
  file: DocumentPickerResponse,
  localUri: string,
  maxBytes: number,
  mode: FileUploadMode,
): Promise<T | null> => {
  const mimeType = inferMimeType(file.type, file.name);
  const isImage = isImageMimeType(mimeType);
  const isDocument = isDocumentMimeType(mimeType);
  if (
    (mode === 'images-only' && !isImage) ||
    (mode === 'documents-only' && !isDocument)
  ) {
    showUnsupportedTypeAlert(mode);
    return null;
  }

  const size = await ensureFileSize(localUri, file.size);
  if (size == null) {
    showUnreadableFileAlert();
    return null;
  }

  if (size > maxBytes) {
    showFileTooLargeAlert(maxBytes);
    return null;
  }

  const extension = getFileExtension(file.name);
  const safeName = sanitizeFileName(
    file.name,
    extension ?? (isImage ? '.jpg' : '.pdf'),
  );

  return {
    id: generateId(),
    uri: localUri,
    name: safeName,
    type: mimeType,
    size,
  } as T;
};

const buildDocumentFileFromAsset = async <T extends DocumentFile>(
  asset: Asset,
  maxBytes: number,
  mode: FileUploadMode,
): Promise<T | null> => {
  if (!asset.uri) {
    showUnreadableFileAlert();
    return null;
  }

  const extension = getFileExtension(asset.fileName);
  if (
    extension &&
    !ALLOWED_FILE_EXTENSIONS.includes(extension.toLowerCase())
  ) {
    showUnsupportedTypeAlert(mode);
    return null;
  }

  const mimeType = inferMimeType(asset.type, asset.fileName);
  const isImage = isImageMimeType(mimeType);
  if (mode === 'documents-only' || !isImage) {
    showUnsupportedTypeAlert(mode);
    return null;
  }

  const size =
    (typeof asset.fileSize === 'number' ? asset.fileSize : null) ??
    (asset.uri.startsWith('file://')
      ? await ensureFileSize(asset.uri, null)
      : null);

  if (size == null) {
    showUnreadableFileAlert();
    return null;
  }

  if (size > maxBytes) {
    showFileTooLargeAlert(maxBytes);
    return null;
  }

  const safeName = sanitizeFileName(
    asset.fileName,
    extension ?? '.jpg',
  );

  return {
    id: generateId(),
    uri: asset.uri,
    name: safeName,
    type: mimeType,
    size,
  } as T;
};

const handlePickerException = (error: unknown) => {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case errorCodes.OPERATION_CANCELED:
        return;
      case errorCodes.UNABLE_TO_OPEN_FILE_TYPE:
        Alert.alert('Unsupported file', 'Unable to open this file on your device.');
        return;
      case errorCodes.IN_PROGRESS:
        Alert.alert('Please wait', 'File selection is already in progress.');
        return;
      default:
        break;
    }
  }
  Alert.alert(
    'Upload failed',
    'We were unable to process the selected file. Please try again.',
  );
};

export const useDocumentFileHandlers = <T extends DocumentFile>({
  files,
  setFiles,
  clearError,
  options,
}: UseDocumentFileHandlersParams<T>) => {
  const selectedMode: FileUploadMode = options?.mode ?? 'mixed';
  const maxFileSizeInBytes = options?.maxFileSizeInBytes ?? MAX_FILE_SIZE;

  const appendFiles = useCallback(
    (newFiles: T[]) => {
      if (!newFiles.length) {
        return;
      }
      setFiles([...files, ...newFiles]);
      clearError?.();
    },
    [files, setFiles, clearError],
  );

  const handleTakePhoto = useCallback(async () => {
    if (selectedMode === 'documents-only') {
      showUnsupportedTypeAlert(selectedMode);
      return;
    }

    try {
      const response = await launchCamera(DEFAULT_CAMERA_OPTIONS);
      if (response.didCancel || !response.assets?.length) {
        return;
      }

      const file = await buildDocumentFileFromAsset<T>(
        response.assets[0],
        maxFileSizeInBytes,
        selectedMode,
      );
      if (file) {
        appendFiles([file]);
      }
    } catch (error) {
      console.warn('[useDocumentFileHandlers] Camera error', error);
      Alert.alert(
        'Camera unavailable',
        'We were unable to open the camera. Please try again or pick from gallery.',
      );
    }
  }, [appendFiles, maxFileSizeInBytes, selectedMode]);

  const handleChooseFromGallery = useCallback(async () => {
    if (selectedMode === 'documents-only') {
      showUnsupportedTypeAlert(selectedMode);
      return;
    }

    try {
      const response = await launchImageLibrary(DEFAULT_GALLERY_OPTIONS);
      if (response.didCancel || !response.assets?.length) {
        return;
      }

      const file = await buildDocumentFileFromAsset<T>(
        response.assets[0],
        maxFileSizeInBytes,
        selectedMode,
      );
      if (file) {
        appendFiles([file]);
      }
    } catch (error) {
      console.warn('[useDocumentFileHandlers] Gallery error', error);
      Alert.alert(
        'Unable to open gallery',
        'We were unable to open your photo library. Please try again.',
      );
    }
  }, [appendFiles, maxFileSizeInBytes, selectedMode]);

  const handleUploadFromDrive = useCallback(async () => {
    if (selectedMode === 'images-only') {
      showUnsupportedTypeAlert(selectedMode);
      return;
    }

    try {
      const pickerResults = await pick({
        allowMultiSelection: true,
        presentationStyle: 'formSheet',
        transitionStyle: 'coverVertical',
        type: getPickerTypes(selectedMode),
      });

      if (!pickerResults?.length) {
        return;
      }

      const validResults = pickerResults.filter(file => {
        if (file.error) {
          console.warn('[useDocumentFileHandlers] Picker error', file.error);
          showUnreadableFileAlert();
          return false;
        }
        return true;
      });

      if (!validResults.length) {
        return;
      }

      const filesToCopy = validResults.map(file => {
        const extension = getFileExtension(file.name);
        const virtualMime = resolveVirtualMime(file);
        return {
          uri: file.uri,
          fileName: sanitizeFileName(
            file.name,
            extension ?? (virtualMime?.startsWith('image/') ? '.jpg' : '.pdf'),
          ),
          ...(virtualMime ? {convertVirtualFileToType: virtualMime} : {}),
        };
      });

      const copyResults = await keepLocalCopy({
        files: filesToCopy as any,
        destination: 'documentDirectory',
      });

      const processedFiles: T[] = [];

      for (let index = 0; index < validResults.length; index += 1) {
        const file = validResults[index];
        const copyResult = copyResults[index];

        if (!copyResult || copyResult.status === 'error') {
          console.warn(
            '[useDocumentFileHandlers] Failed to copy file',
            copyResult?.copyError,
          );
          showUnreadableFileAlert();
          continue;
        }

        const built = await buildDocumentFileFromPicker<T>(
          file,
          copyResult.localUri,
          maxFileSizeInBytes,
          selectedMode,
        );
        if (built) {
          processedFiles.push(built);
        }
      }

      appendFiles(processedFiles);
    } catch (error) {
      console.warn('[useDocumentFileHandlers] Picker exception', error);
      handlePickerException(error);
    }
  }, [appendFiles, maxFileSizeInBytes, selectedMode]);

  return {
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
  };
};
