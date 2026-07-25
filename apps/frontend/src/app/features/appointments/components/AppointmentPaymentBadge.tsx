import { Appointment } from '@yosemite-crew/types';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  createInvoiceByAppointmentId,
  getAppointmentPaymentDisplay,
} from '@/app/lib/paymentStatus';

const AppointmentPaymentBadge = ({
  appointment,
  invoicesByAppointmentId,
}: {
  appointment: Appointment;
  invoicesByAppointmentId: ReturnType<typeof createInvoiceByAppointmentId>;
}) => {
  const payment = getAppointmentPaymentDisplay(appointment, invoicesByAppointmentId);
  return (
    <StatusPill
      label={payment.label}
      style={{
        backgroundColor: payment.badgeBackgroundColor,
        color: payment.badgeTextColor,
        borderColor: payment.badgeBackgroundColor,
      }}
    />
  );
};

export default AppointmentPaymentBadge;
