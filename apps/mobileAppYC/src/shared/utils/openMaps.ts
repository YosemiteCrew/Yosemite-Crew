import {Linking, Platform} from 'react-native';

export const openMapsToAddress = async (address: string) => {
  const query = encodeURIComponent(address);
  const appleNative = `maps://?q=${query}`;
  const appleHttp = `http://maps.apple.com/?q=${query}`;
  const google = `https://www.google.com/maps/search/?api=1&query=${query}`;

  if (Platform.OS === 'ios') {
    const candidates = [appleNative, appleHttp, google];
    for (const candidate of candidates) {
      try {
        const supported = await Linking.canOpenURL(candidate);
        if (supported) {
          return Linking.openURL(candidate);
        }
      } catch {
        // Ignore and try next candidate
      }
    }
    return;
  }

  const supported = await Linking.canOpenURL(google);
  if (supported) {
    return Linking.openURL(google);
  }
};

const buildPlaceIdUrls = (placeId: string, fallbackAddress?: string) => {
  const queryPlaceId = encodeURIComponent(placeId);
  const label = fallbackAddress ? `&query=${encodeURIComponent(fallbackAddress)}` : '';
  const google = `https://www.google.com/maps/search/?api=1&query_place_id=${queryPlaceId}${label}`;
  const appleQuery = fallbackAddress
    ? `maps://?q=${encodeURIComponent(fallbackAddress)}`
    : `maps://?q=${queryPlaceId}`;
  const appleWeb = fallbackAddress
    ? `http://maps.apple.com/?q=${encodeURIComponent(fallbackAddress)}`
    : `http://maps.apple.com/?q=${queryPlaceId}`;

  return {google, appleQuery, appleWeb};
};

const tryOpenUrl = async (url: string): Promise<boolean> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // Ignore and return false
  }
  return false;
};

const tryOpenMultipleUrls = async (urls: string[]): Promise<boolean> => {
  for (const url of urls) {
    if (await tryOpenUrl(url)) {
      return true;
    }
  }
  return false;
};

export const openMapsToPlaceId = async (placeId: string, fallbackAddress?: string) => {
  if (!placeId) {
    if (fallbackAddress) return openMapsToAddress(fallbackAddress);
    return;
  }

  const urls = buildPlaceIdUrls(placeId, fallbackAddress);

  if (Platform.OS === 'ios') {
    const candidates = [urls.appleQuery, urls.appleWeb, urls.google];
    const opened = await tryOpenMultipleUrls(candidates);
    if (!opened && fallbackAddress) {
      return openMapsToAddress(fallbackAddress);
    }
    return;
  }

  const opened = await tryOpenUrl(urls.google);
  if (!opened && fallbackAddress) {
    return openMapsToAddress(fallbackAddress);
  }
};
