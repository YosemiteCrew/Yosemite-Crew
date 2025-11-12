/* istanbul ignore file -- mock handlers for document upload UI */
import {Alert} from 'react-native';
import {useCallback, useEffect, useRef} from 'react';
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
  const extension = fallbackExtension?.startsWith('.')
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
  Boolean(mime?.startsWith('image/'));

const isDocumentMimeType = (mime?: string | null) =>
  Boolean(mime && ALLOWED_DOCUMENT_MIME_TYPES.includes(mime));

const formatLimitLabel = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

const normalizeFileUri = (uri: string) =>
  uri.startsWith('file://') ? uri.replace('file://', '') : uri;

const filterValidPickerResults = (pickerResults: DocumentPickerResponse[]) => {
  return pickerResults.filter(file => {
    if (file.error) {
      console.warn('[useDocumentFileHandlers] Picker error', file.error);
      return false;
    }
    return true;
  });
};

const createPendingEntry = <T extends DocumentFile>(file: DocumentPickerResponse): T => {
  const placeholderId = generateId();
  const mimeType = getEffectiveMimeType(file);
  const fallbackExtension = getFallbackExtension(file, mimeType);
  return {
    id: placeholderId,
    uri: '',
    name: sanitizeFileName(file.name, fallbackExtension),
    type: mimeType,
    size: file.size ?? 0,
    status: 'pending',
  } as T;
};

const prepareFilesForCopy = (validResults: DocumentPickerResponse[]) => {
  return validResults.map(file => {
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
};

const processCopyResult = async <T extends DocumentFile>(
  file: DocumentPickerResponse,
  copyResult: any,
  placeholderId: string | undefined,
  maxFileSizeInBytes: number,
  selectedMode: FileUploadMode,
  replaceFileById: (id: string, file: T | null) => void,
  showUnreadableFileAlert: () => void,
) => {
  if (!copyResult || copyResult.status === 'error') {
    console.warn(
      '[useDocumentFileHandlers] Failed to copy file',
      copyResult?.copyError,
    );
    showUnreadableFileAlert();
    if (placeholderId) {
      replaceFileById(placeholderId, null);
    }
    return;
  }

  const built = await buildDocumentFileFromPicker<T>(
    file,
    copyResult.localUri,
    maxFileSizeInBytes,
    selectedMode,
    placeholderId,
  );

  if (built) {
    replaceFileById(placeholderId ?? built.id, built);
  } else if (placeholderId) {
    replaceFileById(placeholderId, null);
  }
};

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

const getEffectiveMimeType = (file: DocumentPickerResponse) =>
  resolveVirtualMime(file) ?? inferMimeType(file.type, file.name);

const getFallbackExtension = (
  file: DocumentPickerResponse,
  mime: string,
) => {
  const extension = getFileExtension(file.name);
  if (extension) {
    return extension;
  }
  return mime.startsWith('image/') ? '.jpg' : '.pdf';
};

const buildDocumentFileFromPicker = async <T extends DocumentFile>(
  file: DocumentPickerResponse,
  localUri: string,
  maxBytes: number,
  mode: FileUploadMode,
  overrideId?: string,
): Promise<T | null> => {
  const mimeType = getEffectiveMimeType(file);
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
    id: overrideId ?? generateId(),
    uri: localUri,
    name: safeName,
    type: mimeType,
    size,
    status: 'ready',
  } as T;
};

const buildDocumentFileFromAsset = async <T extends DocumentFile>(
  asset: Asset,
  maxBytes: number,
  mode: FileUploadMode,
  overrideId?: string,
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
    id: overrideId ?? generateId(),
    uri: asset.uri,
    name: safeName,
    type: mimeType,
    size,
    status: 'ready',
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
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const commitFiles = useCallback(
    (nextFiles: T[]) => {
      filesRef.current = nextFiles;
      setFiles(nextFiles);
    },
    [setFiles],
  );

  const appendFiles = useCallback(
    (newFiles: T[]) => {
      if (!newFiles.length) {
        return;
      }
      const next = [...filesRef.current, ...newFiles];
      commitFiles(next);
      clearError?.();
    },
    [commitFiles, clearError],
  );

  const replaceFileById = useCallback(
    (fileId: string, nextFile: T | null) => {
      const current = filesRef.current;
      const next = nextFile
        ? current.map(file => (file.id === fileId ? nextFile : file))
        : current.filter(file => file.id !== fileId);
      commitFiles(next);
    },
    [commitFiles],
  );

  const removeFilesByIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) {
        return;
      }
      const next = filesRef.current.filter(file => !ids.includes(file.id));
      commitFiles(next);
    },
    [commitFiles],
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

    let pendingEntries: T[] = [];

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

      const validResults = filterValidPickerResults(pickerResults);
      if (validResults.some(file => file.error)) {
        showUnreadableFileAlert();
      }

      if (!validResults.length) {
        return;
      }

      pendingEntries = validResults.map(file => createPendingEntry<T>(file));

      if (pendingEntries.length) {
        const next = [...filesRef.current, ...pendingEntries];
        commitFiles(next);
        clearError?.();
      }

      const filesToCopy = prepareFilesForCopy(validResults);

      const copyResults = await keepLocalCopy({
        files: filesToCopy as any,
        destination: 'documentDirectory',
      });

      for (let index = 0; index < validResults.length; index += 1) {
        await processCopyResult<T>(
          validResults[index],
          copyResults[index],
          pendingEntries[index]?.id,
          maxFileSizeInBytes,
          selectedMode,
          replaceFileById,
          showUnreadableFileAlert,
        );
      }
    } catch (error) {
      console.warn('[useDocumentFileHandlers] Picker exception', error);
      if (pendingEntries.length) {
        removeFilesByIds(pendingEntries.map(file => file.id));
      }
      handlePickerException(error);
    }
  }, [
    clearError,
    commitFiles,
    maxFileSizeInBytes,
    removeFilesByIds,
    replaceFileById,
    selectedMode,
  ]);

  return {
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
  };
};
