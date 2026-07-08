// Input parsing helpers shared by the calculator forms. Inputs are held as
// strings; blank optional fields become `undefined` so the engine applies its
// default, while blank required fields parse to NaN and are rejected by the
// engine's validation.

export const parseRequiredNumber = (value: string): number => Number.parseFloat(value);

export const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number.parseFloat(trimmed);
};
