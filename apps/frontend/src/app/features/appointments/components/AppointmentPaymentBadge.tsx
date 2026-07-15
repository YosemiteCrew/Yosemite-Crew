import { Appointment } from '@yosemite-crew/types';
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
    <div
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium font-satoshi"
      style={{
        backgroundColor: payment.badgeBackgroundColor,
        color: payment.badgeTextColor,
      }}
    >
      {payment.label}
    </div>
  );
};

export default AppointmentPaymentBadge;
