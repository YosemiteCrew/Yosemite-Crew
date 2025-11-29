import {Images} from '@/assets/images';
import type {ImageSourcePropType} from 'react-native';

import {normalizeImageUri} from './imageUri';

export const resolveImageSource = (source?: ImageSourcePropType | number | string): ImageSourcePropType => {
  if (typeof source === 'number') {
    return source;
  }

  if (!source) {
    return Images.hospitalIcon;
  }

  if (typeof source === 'string') {
    const uri = normalizeImageUri(source);
    if (!uri) {
      return Images.hospitalIcon;
    }

    // For Google Places URLs, use a simple proxy approach
    // React Native Image can't load authenticated URLs directly
    // The backend should have a /proxy/image endpoint that handles this
    try {
      const url = new URL(uri);
      if (url.hostname === 'places.googleapis.com') {
        console.log('[resolveImageSource] Using proxy for Google Places image');
        // If you have a backend proxy, construct it here
        // return {uri: `/api/proxy/image?url=${encodeURIComponent(uri)}`};
        // For now, just return the URI as-is (fallback to onError handler)
      }
    } catch {
      // Invalid URL, continue with default handling
    }

    return {uri};
  }

  if (Array.isArray(source) && source.length > 0) {
    return resolveImageSource(source[0] as ImageSourcePropType);
  }

  if (typeof source === 'object' && 'uri' in source && source.uri) {
    return source as ImageSourcePropType;
  }

  return Images.hospitalIcon;
};
