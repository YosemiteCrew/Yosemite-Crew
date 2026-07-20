'use client';
import React, { useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { IoArrowForward, IoPawOutline } from 'react-icons/io5';

import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatTimeLabel } from '@/app/lib/forms';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

import {
  getAvatarPalette,
  getInClinicStatusMeta,
  getMonogram,
  getTodaysAppointments,
} from './companionsDirectory';

type BandCard = {
  key: string;
  name: string;
  subtitle: string;
  time: string;
  photoUrl?: string;
  species?: string;
  statusLabel: string;
  statusColor: string;
};

const buildBandCards = (
  appointments: AppointmentWithCompanion[],
  companions: CompanionParent[]
): BandCard[] => {
  const byId = new Map(companions.map((item) => [item.companion.id, item]));
  return getTodaysAppointments(appointments).map((appointment, index) => {
    const linked = appointment.companion?.id ? byId.get(appointment.companion.id) : undefined;
    const name = linked?.companion.name ?? appointment.companion?.name ?? '';
    const breed = linked?.companion.breed ?? appointment.companion?.breed ?? '';
    const reason = String(appointment.concern ?? '').trim();
    const subtitle = [breed, reason].filter(Boolean).join(' · ');
    const status = getInClinicStatusMeta(appointment.status);
    return {
      key: appointment.id ?? `${name}-${index}`,
      name,
      subtitle,
      time: formatTimeLabel(appointment.startTime ?? appointment.appointmentDate),
      photoUrl: linked?.companion.photoUrl,
      species: (linked?.companion.type ?? appointment.companion?.species ?? '').toLowerCase(),
      statusLabel: status.label,
      statusColor: status.color,
    };
  });
};

const BandMedia = ({ card }: { card: BandCard }) => {
  if (card.photoUrl) {
    return (
      <Image
        src={getSafeImageUrl(card.photoUrl, card.species as ImageType)}
        alt=""
        height={138}
        width={220}
        className="size-full object-cover"
      />
    );
  }
  const palette = getAvatarPalette(card.key);
  return (
    <span
      className="relative flex size-full items-center justify-center overflow-hidden"
      style={{ background: palette.bg }}
    >
      <IoPawOutline
        aria-hidden="true"
        className="absolute -bottom-[14px] -right-3 rotate-[-12deg] text-[72px] opacity-[0.14] md:-bottom-5 md:-right-4 md:text-[108px]"
        style={{ color: palette.ink }}
      />
      <span className="font-newsreader text-[34px] md:text-[54px]" style={{ color: palette.ink }}>
        {getMonogram(card.name)}
      </span>
    </span>
  );
};

const BandCardView = ({ card }: { card: BandCard }) => (
  <article className="w-[146px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)] md:w-auto md:rounded-[18px] md:shadow-[0_1px_2px_var(--sh03),0_10px_26px_var(--sh05)]">
    <div className="relative h-[84px] md:h-[138px]">
      <BandMedia card={card} />
      <span className="absolute left-2 top-2 z-[2] rounded-full bg-[rgba(29,28,27,0.55)] px-2 py-[3px] text-[10px] font-bold text-[#f7f3ec] tabular-nums backdrop-blur-[10px] md:left-2.5 md:top-2.5 md:px-2.5 md:py-1 md:text-[11px]">
        {card.time}
      </span>
    </div>
    <div className="flex items-center justify-between gap-2 px-[11px] pb-2.5 pt-2 md:px-3.5 md:pb-3 md:pt-2.5">
      <span className="min-w-0">
        <span className="block truncate font-newsreader text-[15px] tracking-[-0.01em] text-[var(--ink)] md:text-[17px]">
          {card.name}
        </span>
        {card.subtitle ? (
          <span className="block truncate text-[11.5px] text-[var(--ink-faint)]">
            {card.subtitle}
          </span>
        ) : null}
      </span>
      <span
        className="inline-flex shrink-0 items-center gap-[5px] text-[8.5px] font-bold uppercase tracking-[0.08em] md:gap-1.5 md:text-[9.5px] md:tracking-[0.09em]"
        style={{ color: card.statusColor }}
      >
        <span className="size-[5px] rounded-full bg-current md:size-1.5" aria-hidden="true" />
        {card.statusLabel}
      </span>
    </div>
  </article>
);

type InClinicTodayBandProps = {
  companions: CompanionParent[];
};

// Real data only: today's appointments mapped to their companion. Renders
// nothing when the clinic has no patients in today.
const InClinicTodayBand = ({ companions }: InClinicTodayBandProps) => {
  const router = useRouter();
  const terminologyText = useCompanionTerminologyText();
  const appointments = useAppointmentsForPrimaryOrg();
  const cards = useMemo(() => buildBandCards(appointments, companions), [appointments, companions]);

  if (cards.length === 0) return null;

  return (
    <section aria-label="In the clinic today" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-[7px] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
          {terminologyText('In the clinic today')}
        </span>
        <button
          type="button"
          onClick={() => router.push('/appointments')}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--blue-text)] transition-opacity hover:opacity-80"
        >
          Open today&apos;s schedule
          <IoArrowForward size={12} aria-hidden="true" />
        </button>
      </div>
      <div className="flex snap-x gap-2.5 overflow-x-auto scrollbar-hidden md:grid md:grid-cols-4 md:gap-3.5 md:overflow-visible">
        {cards.map((card) => (
          <BandCardView key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
};

export default InClinicTodayBand;
