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

export const openMapsToPlaceId = async (placeId: string, fallbackAddress?: string) => {
  if (!placeId) {
    if (fallbackAddress) return openMapsToAddress(fallbackAddress);
    return;
  }
  const queryPlaceId = encodeURIComponent(placeId);
  const label = fallbackAddress ? `&query=${encodeURIComponent(fallbackAddress)}` : '';
  // Use official Maps URL param for place IDs
  const google = `https://www.google.com/maps/search/?api=1&query_place_id=${queryPlaceId}${label}`;
  const appleQuery = fallbackAddress
    ? `maps://?q=${encodeURIComponent(fallbackAddress)}`
    : `maps://?q=${queryPlaceId}`;
  const appleWeb = fallbackAddress
    ? `http://maps.apple.com/?q=${encodeURIComponent(fallbackAddress)}`
    : `http://maps.apple.com/?q=${queryPlaceId}`;

  if (Platform.OS === 'ios') {
    const candidates = [appleQuery, appleWeb, google];
    for (const candidate of candidates) {
      try {
        const supported = await Linking.canOpenURL(candidate);
        if (supported) {
          return Linking.openURL(candidate);
        }
      } catch {
        // fall through to next option
      }
    }
    if (fallbackAddress) {
      return openMapsToAddress(fallbackAddress);
    }
    return;
  }

  try {
    const supported = await Linking.canOpenURL(google);
    if (supported) {
      return Linking.openURL(google);
    }
  } catch {
    // fall through to address fallback
  }
  if (fallbackAddress) return openMapsToAddress(fallbackAddress);
};
