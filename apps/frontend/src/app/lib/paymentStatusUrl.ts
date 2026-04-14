const PAYMENT_STATUS_ENDPOINT = '/fhir/v1/invoice/';

export const buildPaymentStatusUrl = (sessionId: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const requestPath = `${PAYMENT_STATUS_ENDPOINT}?session_id=${encodeURIComponent(sessionId)}`;

  if (!baseUrl) {
    return requestPath;
  }

  return new URL(requestPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
};
