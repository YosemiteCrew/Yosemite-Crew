import RNFS from 'react-native-fs';

const REMOTE_URI_PATTERN = /^https?:\/\//i;

export const isRemoteDocumentUri = (uri: string): boolean =>
  REMOTE_URI_PATTERN.test(uri);

/**
 * Saves a document into app-scoped storage (no storage permission required
 * on any Android version) instead of the public Downloads directory, which
 * needs different permissions across Android 10-12 (scoped storage) vs 13+.
 * Remote URIs are fetched over HTTP; local file:// or content:// URIs (e.g.
 * from a document picker) are copied directly instead of being handed to the
 * HTTP-oriented downloader.
 */
export const downloadDocumentToAppStorage = async (
  sourceUri: string,
  fileName: string,
): Promise<string> => {
  const downloadDir = `${RNFS.DocumentDirectoryPath}/Downloads`;
  await RNFS.mkdir(downloadDir);
  const downloadPath = `${downloadDir}/${fileName}`;

  if (isRemoteDocumentUri(sourceUri)) {
    await RNFS.downloadFile({
      fromUrl: sourceUri,
      toFile: downloadPath,
      discretionary: true,
    }).promise;
  } else {
    await RNFS.copyFile(sourceUri, downloadPath);
  }

  return downloadPath;
};
