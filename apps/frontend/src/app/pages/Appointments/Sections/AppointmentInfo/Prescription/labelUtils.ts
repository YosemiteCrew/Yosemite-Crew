import { FormField } from "@/app/types/forms";

const flattenFields = (fields: FormField[] = []): FormField[] =>
  fields.flatMap((f) =>
    f.type === "group" && Array.isArray(f.fields)
      ? [f, ...(flattenFields(f.fields as FormField[]))]
      : [f],
  );

export const findFieldLabel = (
  schema: FormField[] | undefined,
  id: string,
): string | undefined => {
  if (!schema?.length) return undefined;
  const flat = flattenFields(schema);
  const match = flat.find((f) => f.id === id);
  return match?.label || (match as any)?.name;
};

export const humanizeKey = (key: string): string => {
  const withSpaces = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
