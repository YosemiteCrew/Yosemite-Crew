import api from '@/app/services/axios';

export type PaymentActivityRow = {
  id: string;
  date: string;
  type: 'Payment' | 'Refund';
  status: string;
  provider: string;
  currency: string;
  amount: number;
  invoiceId: string;
};

export type PaymentActivityTotal = {
  currency: string;
  payments: number;
  refunds: number;
  net: number;
};

export type PaymentActivityReport = {
  rows: PaymentActivityRow[];
  totals: PaymentActivityTotal[];
};

const reportPath = (organisationId: string) =>
  `/v1/finance/organisation/${encodeURIComponent(organisationId)}/reports/payment-activity`;

export const fetchPaymentActivityReport = async (
  organisationId: string,
  from: string,
  to: string
): Promise<PaymentActivityReport> => {
  const response = await api.get<{ data: PaymentActivityReport }>(reportPath(organisationId), {
    params: { from, to },
  });
  return response.data.data;
};

export const downloadPaymentActivityReport = async (
  organisationId: string,
  from: string,
  to: string,
  format: 'csv' | 'pdf'
): Promise<Blob> => {
  const response = await api.get<Blob>(reportPath(organisationId), {
    params: { from, to, format },
    responseType: 'blob',
  });
  return response.data;
};
