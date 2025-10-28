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

