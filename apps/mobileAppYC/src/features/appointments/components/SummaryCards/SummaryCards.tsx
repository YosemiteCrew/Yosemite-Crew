import React from 'react';
import type {ViewStyle} from 'react-native';
import {BookingSummaryCard} from '@/features/appointments/components/BookingSummaryCard';
import type {VetBusiness, VetService, VetEmployee} from '@/features/appointments/types';
import {resolveCurrencySymbol} from '@/shared/utils/currency';

type Props = {
  business?: VetBusiness | null;
  businessSummary?: {
    name: string;
    address?: string | null;
    description?: string | null;
    photo?: any;
  } | null;
  service?: VetService | null;
  serviceName?: string | null;
  employee?: VetEmployee | null;
  employeeDepartment?: string | null;
  cardStyle?: ViewStyle;
};

export const SummaryCards: React.FC<Props> = ({
  business,
  businessSummary,
  service,
  serviceName,
  employee,
  employeeDepartment,
  cardStyle,
}) => {
  const resolvedBusiness =
    business && businessSummary
      ? {...business, ...businessSummary}
      : business ?? businessSummary ?? null;
  return (
    <>
      {resolvedBusiness && (
        <BookingSummaryCard
          title={resolvedBusiness.name}
          subtitlePrimary={resolvedBusiness.address ?? undefined}
          subtitleSecondary={resolvedBusiness.description ?? undefined}
          image={resolvedBusiness.photo}
          interactive={false}
          style={cardStyle}
        />
      )}

      {(service || serviceName) && (
        <BookingSummaryCard
          title={service?.name ?? serviceName ?? 'Requested service'}
          subtitlePrimary={service?.description}
          subtitleSecondary={undefined}
          badgeText={service?.basePrice ? `${resolveCurrencySymbol(service?.currency ?? 'USD')}${service.basePrice}` : null}
          image={undefined}
          showAvatar={false}
          interactive={false}
          style={cardStyle}
        />
      )}

      {employee && (
        <BookingSummaryCard
          title={employee.name}
          subtitlePrimary={employee.specialization}
          subtitleSecondary={employeeDepartment ?? employee.title}
          image={employee.avatar}
          interactive={false}
          style={cardStyle}
        />
      )}
    </>
  );
};

export default SummaryCards;
