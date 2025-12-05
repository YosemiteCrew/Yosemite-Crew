import {Linking, Platform} from 'react-native';

export const openMapsToAddress = async (address: string) => {
  const query = encodeURIComponent(address);
  const apple = `http://maps.apple.com/?q=${query}`;
  const google = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const url = Platform.select({ios: apple, android: google, default: google});
  if (url) {
    const supported = await Linking.canOpenURL(url);
    if (supported) return Linking.openURL(url);
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
  const url = Platform.select({ios: google, android: google, default: google});
  try {
    const supported = url ? await Linking.canOpenURL(url) : false;
    if (supported && url) {
      return Linking.openURL(url);
    }
  } catch {
    // fall through to address fallback
  }
  if (fallbackAddress) {
    return openMapsToAddress(fallbackAddress);
  }
};
