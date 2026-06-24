import React from 'react';
import Image from 'next/image';
import { getInitials } from './appointmentCentralModalUtils';
import { getSafeImageUrl } from '@/app/lib/urls';

type AppointmentAvatarProps = {
  name: string;
  photoUrl?: string;
  size?: number;
};

const AppointmentAvatar = ({ name, photoUrl, size = 32 }: AppointmentAvatarProps) => {
  const initials = getInitials(name);

  if (photoUrl) {
    const safePhotoUrl = getSafeImageUrl(photoUrl, 'person');
    return (
      <Image
        src={safePhotoUrl}
        alt={name}
        width={size}
        height={size}
        className="object-cover shrink-0"
        style={{ width: size, height: size, borderRadius: 16 }}
      />
    );
  }

  return (
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
          color: 'var(--color-primary-700)',
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
};

export default AppointmentAvatar;
