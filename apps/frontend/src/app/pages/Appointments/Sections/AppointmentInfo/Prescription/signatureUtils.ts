import { FormField } from "@/app/types/forms";

export const hasSignatureField = (schema: FormField[] = []): boolean =>
  schema.some((field) => {
    if (!field) return false;
    if (field.type === "signature") return true;
    if (field.type === "group" && Array.isArray(field.fields)) {
      return hasSignatureField(field.fields as FormField[]);
    }
    return false;
  });
