import Image from 'next/image';

import {
  getAvatarPalette,
  getMonogram,
} from '@/app/features/companions/pages/Companions/companionsDirectory';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';

type CompanionAvatarProps = {
  /** The companion's real photo. Absent means the companion has no photo. */
  photoUrl?: string | null;
  name?: string | null;
  /** Companion species, used to pick the image fallback pool for real photos. */
  speciesType?: string | null;
  size: number;
  /** Type scale for the monogram disc, e.g. 'text-body-1'. */
  textClassName?: string;
  /** Stable palette seed. Falls back to the name so colour stays put per companion. */
  seed?: string | null;
  alt?: string;
};

/**
 * Photo when the companion actually has one, otherwise a Newsreader monogram on
 * a tinted disc. The monogram is deliberate: auto-assigning a stock species
 * photo reads as a real picture of the pet and misleads staff.
 */
const CompanionAvatar = ({
  photoUrl,
  name,
  speciesType,
  size,
  textClassName = '',
  seed,
  alt = '',
}: CompanionAvatarProps) => {
  if (photoUrl) {
    return (
      <span
        className="shrink-0 overflow-hidden rounded-full shadow-[0_0_0_1px_var(--hairline-soft)]"
        style={{ width: size, height: size }}
      >
        <Image
          src={getSafeImageUrl(photoUrl, speciesType?.toLowerCase() as ImageType)}
          alt={alt}
          height={size}
          width={size}
          className="size-full object-cover"
        />
      </span>
    );
  }

  const palette = getAvatarPalette(seed || name);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-newsreader shadow-[0_0_0_1px_var(--hairline-soft)] ${textClassName}`}
      style={{ width: size, height: size, background: palette.bg, color: palette.ink }}
    >
      {/* The monogram is decoration. `alt` carries the accessible name so a reader
          announces the companion rather than spelling out the initials; with no
          alt the disc stays silent beside the name that is already on screen. */}
      <span aria-hidden="true">{getMonogram(name)}</span>
      {alt ? <span className="sr-only">{alt}</span> : null}
    </span>
  );
};

export default CompanionAvatar;
