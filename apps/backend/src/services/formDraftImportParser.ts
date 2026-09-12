/**
 * Deterministic parser for #3055's supplied-form-text import.
 *
 * There is no model/AI step here on purpose: #3049 (the provider-neutral
 * execution boundary every AI step in this epic must run through) is not
 * built yet, and this issue explicitly allows a deterministic slice to ship
 * ahead of it. A fixed, documented grammar also gives the "prompt injection"
 * acceptance criterion a trivial, checkable answer - field text is stored
 * verbatim as a label string and never interpreted as an instruction, because
 * nothing in this module or its caller reads the CONTENT of a label to decide
 * what to do. Only unrelated tooling (a future AI-assisted mapping step) has
 * a prompt to inject into, and it does not exist yet.
 *
 * Grammar, one field per line, `|`-delimited:
 *
 *   <label> | <type> [| required|optional [| option1, option2, ...]]
 *
 * - Blank lines and lines starting with `#` are ignored.
 * - <type> must be one of SUPPORTED_FIELD_TYPES (the same FieldType union the
 *   existing form renderer and FormField Prisma model already use - see
 *   packages/types/src/form.ts). Anything else is reported, not guessed at.
 * - The required/optional segment defaults to optional when omitted.
 * - dropdown/radio/checkbox require a comma-separated options segment;
 *   every other type must not carry one.
 * - Two lines that resolve to the same field id (a slug of the label) with a
 *   different type or required flag are a conflict: the first definition
 *   wins and the later one is reported, never silently overwritten.
 */

export const SUPPORTED_FIELD_TYPES = [
  "input",
  "textarea",
  "richtext",
  "number",
  "dropdown",
  "radio",
  "checkbox",
  "boolean",
  "date",
  "signature",
] as const;

export type SupportedFieldType = (typeof SUPPORTED_FIELD_TYPES)[number];

const CHOICE_FIELD_TYPES: ReadonlySet<string> = new Set([
  "dropdown",
  "radio",
  "checkbox",
]);

export interface ParsedFieldOption {
  label: string;
  value: string;
}

export interface ParsedDraftField {
  id: string;
  type: SupportedFieldType;
  label: string;
  required: boolean;
  options?: ParsedFieldOption[];
  sourceLine: number;
}

export interface UnsupportedConstruct {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseSuppliedFormTextResult {
  fields: ParsedDraftField[];
  unsupportedConstructs: UnsupportedConstruct[];
}

const isSupportedFieldType = (value: string): value is SupportedFieldType =>
  (SUPPORTED_FIELD_TYPES as readonly string[]).includes(value);

const trimDashes = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "-") start += 1;
  while (end > start && value[end - 1] === "-") end -= 1;
  return value.slice(start, end);
};

const slugify = (label: string): string =>
  trimDashes(
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),
  );

const optionFromRawSegment = (raw: string): ParsedFieldOption => {
  const trimmed = raw.trim();
  return { label: trimmed, value: slugify(trimmed) || trimmed };
};

interface LineParseSuccess {
  ok: true;
  field: ParsedDraftField;
}

interface LineParseFailure {
  ok: false;
  reason: string;
}

type SegmentResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const parseRequiredSegment = (rawRequired: string): SegmentResult<boolean> => {
  if (rawRequired === "") return { ok: true, value: false };
  const normalized = rawRequired.toLowerCase();
  if (normalized !== "required" && normalized !== "optional") {
    return {
      ok: false,
      reason: `third segment must be 'required' or 'optional', got '${rawRequired}'`,
    };
  }
  return { ok: true, value: normalized === "required" };
};

const parseOptionsSegment = (
  type: SupportedFieldType,
  rawOptions: string,
): SegmentResult<ParsedFieldOption[] | undefined> => {
  const isChoice = CHOICE_FIELD_TYPES.has(type);
  const hasOptionsSegment = rawOptions !== "";

  if (isChoice && !hasOptionsSegment) {
    return {
      ok: false,
      reason: `choice field type '${type}' requires a comma-separated options list as the 4th segment`,
    };
  }
  if (!isChoice && hasOptionsSegment) {
    return {
      ok: false,
      reason: `field type '${type}' does not accept an options list`,
    };
  }
  if (!hasOptionsSegment) return { ok: true, value: undefined };

  const options = rawOptions
    .split(",")
    .map((option) => option.trim())
    .filter((option) => option.length > 0)
    .map(optionFromRawSegment);

  if (options.length === 0) {
    return {
      ok: false,
      reason: `choice field type '${type}' requires at least one non-empty option`,
    };
  }
  return { ok: true, value: options };
};

const parseLine = (
  rawLine: string,
  lineNumber: number,
): LineParseSuccess | LineParseFailure => {
  const segments = rawLine.split("|").map((segment) => segment.trim());
  const label = segments[0] ?? "";
  const rawType = segments[1] ?? "";
  const rawRequired = segments[2] ?? "";
  const rawOptions = segments[3] ?? "";

  if (!label) {
    return { ok: false, reason: "missing a field label before the first '|'" };
  }
  if (!rawType) {
    return {
      ok: false,
      reason: "expected a label and a type separated by '|'",
    };
  }

  const type = rawType.toLowerCase();
  if (!isSupportedFieldType(type)) {
    return { ok: false, reason: `unsupported field type '${rawType}'` };
  }

  const requiredResult = parseRequiredSegment(rawRequired);
  if (!requiredResult.ok) return requiredResult;

  const optionsResult = parseOptionsSegment(type, rawOptions);
  if (!optionsResult.ok) return optionsResult;

  const id = slugify(label) || `field-${lineNumber}`;

  return {
    ok: true,
    field: {
      id,
      type,
      label,
      required: requiredResult.value,
      options: optionsResult.value,
      sourceLine: lineNumber,
    },
  };
};

const sameDefinition = (a: ParsedDraftField, b: ParsedDraftField): boolean =>
  a.type === b.type &&
  a.required === b.required &&
  JSON.stringify(a.options ?? null) === JSON.stringify(b.options ?? null);

export const parseSuppliedFormText = (
  suppliedText: string,
): ParseSuppliedFormTextResult => {
  const fields: ParsedDraftField[] = [];
  const unsupportedConstructs: UnsupportedConstruct[] = [];
  const fieldsById = new Map<string, ParsedDraftField>();

  const lines = suppliedText.split(/\r\n|\r|\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;

    const result = parseLine(trimmed, lineNumber);
    if (!result.ok) {
      unsupportedConstructs.push({
        line: lineNumber,
        raw: rawLine,
        reason: result.reason,
      });
      return;
    }

    const existing = fieldsById.get(result.field.id);
    if (existing) {
      if (sameDefinition(existing, result.field)) return;
      unsupportedConstructs.push({
        line: lineNumber,
        raw: rawLine,
        reason: `conflicting definition for field '${result.field.label}': first seen on line ${existing.sourceLine} as type=${existing.type} required=${existing.required}, redefined here as type=${result.field.type} required=${result.field.required}`,
      });
      return;
    }

    fieldsById.set(result.field.id, result.field);
    fields.push(result.field);
  });

  return { fields, unsupportedConstructs };
};
