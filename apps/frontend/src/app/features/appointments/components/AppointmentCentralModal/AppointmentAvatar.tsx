import React from 'react';
import { getInitials } from './appointmentCentralModalUtils';
import { getSafeImageUrl } from '@/app/lib/urls';
import AvatarImage from '@/app/ui/avatars/AvatarImage';

type AppointmentAvatarProps = {
  name: string;
  photoUrl?: string;
  size?: number;
};

const AppointmentAvatar = ({ name, photoUrl, size = 32 }: AppointmentAvatarProps) => {
  const initials = getInitials(name);
  const initialsDisc = (
    <div
      className="flex items-center justify-center shrink-0 select-none"
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        background: 'var(--color-primary-100)',
      }}
      aria-hidden="true"
    >
      <span
        style={{
          // --blue-text, not the 700 fill step: --color-primary-100 under it DOES
          // have a dark value (a 16% tint that composites dark), so the fixed dark
          // blue left these initials at 1.6:1 in dark.
          color: 'var(--blue-text)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-satoshi), sans-serif',
          lineHeight: 'normal',
          textAlign: 'center',
        }}
      >
        {initials}
      </span>
    </div>
  );

  if (!photoUrl) return initialsDisc;

  // A photo whose URL no longer resolves degrades to the same initials disc
  // rather than leaving an empty box beside the name.
  return (
    <AvatarImage
      src={getSafeImageUrl(photoUrl, 'person')}
      alt={name}
      size={size}
      className="object-cover shrink-0"
      style={{ width: size, height: size, borderRadius: 16 }}
      fallback={initialsDisc}
    />
  );
};

export default AppointmentAvatar;
