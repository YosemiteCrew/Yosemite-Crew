import {Images} from '@/assets/images';
import type {ImageSourcePropType} from 'react-native';

export const resolveImageSource = (source?: ImageSourcePropType | number): ImageSourcePropType => {
  if (typeof source === 'number') {
    return source;
  }

  if (!source) {
    return Images.hospitalIcon;
  }

  if (typeof source === 'string') {
    return {uri: source};
  }

  if (Array.isArray(source) && source.length > 0) {
    return resolveImageSource(source[0] as ImageSourcePropType);
  }

  if (typeof source === 'object' && 'uri' in source && source.uri) {
    return source as ImageSourcePropType;
  }

  return Images.hospitalIcon;
};
