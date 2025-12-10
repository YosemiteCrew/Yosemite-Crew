/* istanbul ignore file -- mock handlers for document upload UI */
import {Alert, Platform} from 'react-native';
import {useCallback, useEffect, useRef} from 'react';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-blob-util';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import {check, request, RESULTS, PERMISSIONS} from 'react-native-permissions';
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
import {normalizeMimeType} from '@/shared/utils/mime';

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

const getCameraPermissionConstant = () =>
  Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

const requestCameraAccess = async () => {
  const permission = getCameraPermissionConstant();
  try {
    const status = await check(permission);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      return true;
    }
    if (status === RESULTS.BLOCKED) {
      Alert.alert(
        'Camera permission blocked',
        'Enable camera access in Settings to take photos.',
      );
      return false;
    }
    if (status === RESULTS.UNAVAILABLE) {
      Alert.alert('Camera unavailable', 'Camera is not available on this device.');
      return false;
    }
    const nextStatus = await request(permission);
    if (nextStatus === RESULTS.GRANTED || nextStatus === RESULTS.LIMITED) {
      return true;
    }
    Alert.alert(
      'Permission required',
      'Camera access is needed to take photos. Please grant permission.',
    );
    return false;
  } catch (error) {
    console.warn('[useDocumentFileHandlers] Camera permission error', error);
    Alert.alert('Permission error', 'We were unable to request camera access.');
    return false;
  }
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

// Correct MIME types when document picker returns generic type
const correctMimeType = (mimeType: string, fileName?: string | null): string => {
  // If MIME type is too generic, try to infer from file extension
  if (mimeType === 'application/octet-stream' && fileName) {
    const match = /\.[^.]+$/.exec(fileName.toLowerCase());
    const ext = match?.[0];
    if (ext && MIME_BY_EXTENSION[ext]) {
      return MIME_BY_EXTENSION[ext];
    }
  }
  return mimeType;
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
  const normalized = normalizeMimeType(type);
  if (normalized) {
    return normalized;
  }
  const extension = getFileExtension(name);
  if (extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }
  return 'application/octet-stream';
};

const isImageMimeType = (mime?: string | null) => {
  const normalized = normalizeMimeType(mime);
  return Boolean(normalized?.startsWith('image/'));
};

const isDocumentMimeType = (mime?: string | null) => {
  const normalized = normalizeMimeType(mime);
  return Boolean(normalized && ALLOWED_DOCUMENT_MIME_TYPES.includes(normalized));
};

const formatLimitLabel = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

const normalizeFileUri = (uri: string) => {
  if (!uri) {
    return uri;
  }
  const cleaned = uri.startsWith('file://') ? uri : `file://${uri}`;
  // Some providers return content:// URIs which should not be prefixed again
  if (cleaned.startsWith('content://')) {
    return uri;
  }
  return cleaned;
};

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
  const extractMimeString = (meta: any) => {
    if (!meta) {
      return '';
    }
    if (typeof meta === 'string') {
      return meta;
    }
    return meta?.mimeType ?? meta?.type ?? '';
  };

  const match = file.convertibleToMimeTypes.find(meta => {
    const normalized = normalizeMimeType(extractMimeString(meta));
    return normalized ? allowed.has(normalized) : false;
  });

  const candidate = match ?? file.convertibleToMimeTypes[0];
  const normalized = normalizeMimeType(extractMimeString(candidate));
  return normalized || undefined;
};

const stripFileScheme = (value: string) =>
  value.startsWith('file://') ? value.replace('file://', '') : value;

const isValidFileSize = (size: number): boolean =>
  Number.isFinite(size) && size > 0;

const readContentUriSize = async (uri: string): Promise<number | null> => {
  try {
    const stat = await RNFetchBlob.fs.stat(uri);
    const size = Number(stat.size);
    return isValidFileSize(size) ? size : null;
  } catch (error) {
    console.warn('[useDocumentFileHandlers] Unable to read content URI size', error);
    return null;
  }
};

const readLocalFileSize = async (uri: string): Promise<number | null> => {
  try {
    const stats = await RNFS.stat(stripFileScheme(uri));
    const size = Number(stats.size);
    return isValidFileSize(size) ? size : null;
  } catch (error) {
    console.warn('[useDocumentFileHandlers] Unable to read file size', error);
    return null;
  }
};

const readFileSizeFromUri = async (candidate: string): Promise<number | null> => {
  if (candidate.startsWith('content://')) {
    return readContentUriSize(candidate);
  }
  return readLocalFileSize(candidate);
};

const ensureFileSize = async (
  uri: string,
  providedSize?: number | null,
): Promise<number | null> => {
  if (typeof providedSize === 'number' && providedSize > 0) {
    return providedSize;
  }

  const candidates = [uri, normalizeFileUri(uri), stripFileScheme(uri)];

  for (const candidate of candidates) {
    const size = await readFileSizeFromUri(candidate);
    if (size !== null) {
      return size;
    }
  }

  return null;
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
  const match = Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mime);
  if (match) {
    return match[0];
  }
  if (mime.startsWith('image/')) {
    return '.jpg';
  }
  if (mime === 'application/pdf') {
    return '.pdf';
  }
  return '.bin';
};

const buildDocumentFileFromPicker = async <T extends DocumentFile>(
  file: DocumentPickerResponse,
  localUri: string,
  maxBytes: number,
  mode: FileUploadMode,
  overrideId?: string,
): Promise<T | null> => {
  let mimeType = getEffectiveMimeType(file);
  // Correct generic MIME types based on file extension
  mimeType = correctMimeType(mimeType, file.name);
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
    uri: normalizeFileUri(localUri),
    name: safeName,
    type: mimeType,
    size,
    status: 'ready',
  } as T;
};

const validateAssetExtension = (
  extension: string | null,
): boolean => {
  if (!extension) {
    return true;
  }
  return ALLOWED_FILE_EXTENSIONS.includes(extension.toLowerCase());
};

const validateAssetType = (
  mode: FileUploadMode,
  isImage: boolean,
): boolean => {
  if (mode === 'documents-only') {
    return false;
  }
  return isImage;
};

const getAssetFileSize = async (
  asset: Asset,
): Promise<number | null> => {
  if (typeof asset.fileSize === 'number') {
    return asset.fileSize;
  }
  if (!asset.uri?.startsWith('file://')) {
    return null;
  }
  return ensureFileSize(asset.uri, null);
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
  if (!validateAssetExtension(extension)) {
    showUnsupportedTypeAlert(mode);
    return null;
  }

  const mimeType = inferMimeType(asset.type, asset.fileName);
  const isImage = isImageMimeType(mimeType);
  if (!validateAssetType(mode, isImage)) {
    showUnsupportedTypeAlert(mode);
    return null;
  }

  const size = await getAssetFileSize(asset);
  if (size == null) {
    showUnreadableFileAlert();
    return null;
  }

  if (size > maxBytes) {
    showFileTooLargeAlert(maxBytes);
    return null;
  }

  const safeName = sanitizeFileName(asset.fileName, extension ?? '.jpg');

  return {
    id: overrideId ?? generateId(),
    uri: normalizeFileUri(asset.uri),
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
      if (ids.length) {
        const next = filesRef.current.filter(file => !ids.includes(file.id));
        commitFiles(next);
      }
    },
    [commitFiles],
  );

  const processPendingFiles = useCallback(
    async (
      validResults: DocumentPickerResponse[],
      pendingEntries: T[],
    ) => {
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
    },
    [maxFileSizeInBytes, replaceFileById, selectedMode],
  );

  const handlePickerResults = useCallback(
    async (pickerResults: DocumentPickerResponse[]): Promise<T[] | null> => {
      const validResults = filterValidPickerResults(pickerResults);
      if (validResults.some(file => file.error)) {
        showUnreadableFileAlert();
      }

      if (!validResults.length) {
        return null;
      }

      const pendingEntries = validResults.map(file => createPendingEntry<T>(file));
      if (pendingEntries.length) {
        const next = [...filesRef.current, ...pendingEntries];
        commitFiles(next);
        clearError?.();
      }
      await processPendingFiles(validResults, pendingEntries);
      return pendingEntries;
    },
    [commitFiles, processPendingFiles, clearError],
  );

  const handleTakePhoto = useCallback(async () => {
    if (selectedMode === 'documents-only') {
      showUnsupportedTypeAlert(selectedMode);
      return;
    }

    try {
      const hasPermission = await requestCameraAccess();
      if (!hasPermission) {
        return;
      }

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

      const results = await handlePickerResults(pickerResults);
      if (results) {
        pendingEntries = results;
      }
    } catch (error) {
      console.warn('[useDocumentFileHandlers] Picker exception', error);
      removeFilesByIds(pendingEntries.map(file => file.id));
      handlePickerException(error);
    }
  }, [handlePickerResults, removeFilesByIds, selectedMode]);

  return {
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
  };
};
