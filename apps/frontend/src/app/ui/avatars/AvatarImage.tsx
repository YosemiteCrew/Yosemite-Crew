'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type ReactNode } from 'react';

export type AvatarImageProps = {
  /** Photo URL, already sanitised by the caller (every call site runs `getSafeImageUrl`). */
  src?: string | null;
  alt: string;
  /** Rendered square, in CSS pixels. Also the intrinsic box next/image reserves. */
  size: number;
  className?: string;
  style?: CSSProperties;
  /** Forwarded to next/image for the few above-the-fold cards that preload their avatar. */
  priority?: boolean;
  /**
   * What stands in for the photo. The design rule is "initials fallback is
   * mandatory, never an empty circle", so this is required rather than optional:
   * a caller cannot forget it and ship a blank disc.
   */
  fallback: ReactNode;
};

/**
 * Mirrors the strings `getSafeImageUrl` refuses. The sanitiser already maps
 * these to a stock image, so this only matters for a caller that skipped it -
 * and then the fallback is still the right answer, not a broken `<img>`.
 */
const isRenderableSrc = (src: string): boolean => {
  if (!src || src === 'undefined' || src === 'null') return false;
  return !/\/(undefined|null)(\?.*)?$/.test(src);
};

/**
 * `next/image` that degrades to `fallback` instead of an empty circle.
 *
 * `next/image` has no failure state of its own: a photo URL that no longer
 * resolves (a deleted S3 object, a rotated CDN path) leaves the alt-less `<img>`
 * as a blank disc in every table that shows it. This wraps it with the one
 * thing missing - an `onError` that swaps in the caller's initials disc - and
 * treats an empty or obviously-bad `src` the same way so the fallback is
 * reached synchronously when there was never a photo to try.
 */
const AvatarImage = ({
  src,
  alt,
  size,
  className,
  style,
  priority,
  fallback,
}: AvatarImageProps) => {
  const resolvedSrc = typeof src === 'string' ? src.trim() : '';
  // Keyed on the URL rather than a boolean: when a dead photo is replaced by a
  // fresh upload the new URL gets its own attempt instead of staying on initials.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const errored = !isRenderableSrc(resolvedSrc) || failedSrc === resolvedSrc;

  if (errored) return <>{fallback}</>;

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={style}
      priority={priority}
      onError={() => setFailedSrc(resolvedSrc)}
    />
  );
};

export default AvatarImage;
