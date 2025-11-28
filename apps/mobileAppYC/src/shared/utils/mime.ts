export const normalizeMimeType = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const [base] = value.split(';', 1);
  return base?.trim().toLowerCase() ?? '';
};
