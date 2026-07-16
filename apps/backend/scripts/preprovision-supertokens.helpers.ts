import path from "node:path";

export function resolveSafeInputFilePath(file: string): string {
  if (path.isAbsolute(file)) {
    throw new Error("Invalid file path");
  }

  const normalized = path.normalize(file);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error("Invalid file path");
  }

  return path.resolve(process.cwd(), normalized);
}
