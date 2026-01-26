export const getEnv = (key: string): string | undefined => {
  if (typeof process === "undefined" || !process.env) return undefined;
  const val = process.env[key];
  return typeof val === "string" ? val : undefined;
};
