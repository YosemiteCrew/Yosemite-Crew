import { FormField } from "@yosemite-crew/types";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export interface PdfField {
  label: string;
  value: string;
}

export interface PdfSection {
  title: string;
  fields: PdfField[];
}

export interface PdfViewModel {
  title: string;
  submittedAt: string;
  sections: PdfSection[];
}

const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return "[function]";
  }

  return "";
};

const formatValue = (value: unknown, field?: FormField): string => {
  if (value === undefined || value === null) return "";

  if (Array.isArray(value)) {
    return value.map((v) => formatValue(v, field)).join(", ");
  }

  switch (field?.type) {
    case "boolean":
      return value === true ? "Yes" : "No";

    case "date":
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }

      if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
          ? stringifyValue(value)
          : parsed.toLocaleDateString();
      }

      return stringifyValue(value);

    case "signature":
      // IMPORTANT: legal signing is Documenso, not this field
      return "Signed electronically";

    default:
      return stringifyValue(value);
  }
};

export function buildPdfViewModel({
  title,
  schema,
  answers,
  submittedAt,
}: {
  title: string;
  schema: FormField[];
  answers: Record<string, unknown>;
  submittedAt: Date;
}): PdfViewModel {
  const sections: PdfSection[] = [];
  let current: PdfSection | null = null;

  const walk = (fields: FormField[]) => {
    for (const field of fields) {
      if (field.type === "group") {
        current = {
          title: field.label,
          fields: [],
        };
        sections.push(current);
        walk(field.fields);
        current = null;
        continue;
      }

      if (!current) {
        current = {
          title: "Details",
          fields: [],
        };
        sections.push(current);
      }

      current.fields.push({
        label: field.label,
        value: formatValue(answers[field.id], field),
      });
    }
  };

  walk(schema);

  return {
    title,
    submittedAt: submittedAt.toISOString(),
    sections,
  };
}


const templatePath = path.join(__dirname, "../utils/formPDFTemplate.html");

function renderSections(vm: PdfViewModel): string {
  console.log("Rendering sections:", vm.sections);
  return vm.sections
    .map(
      (section) => `
        <h2>${section.title}</h2>
        ${section.fields
          .map(
            (f) => `
              <div class="field">
                <span class="label">${f.label}:</span>
                <span class="value">${f.value}</span>
              </div>
            `
          )
          .join("")}
      `
    )
    .join("");
}

function applyTemplate(vm: PdfViewModel): string {
  let html = fs.readFileSync(templatePath, "utf8");
  console.log("Applying template with VM:", vm.title);
  html = html.replaceAll("{{title}}", vm.title);
  html = html.replace("{{submittedAt}}", vm.submittedAt);
  html = html.replace("{{sections}}", renderSections(vm));

  return html;
}

export async function renderPdf(vm: PdfViewModel): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const html = applyTemplate(vm);

  await page.setContent(html, { waitUntil: "load" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();

  return pdf;
}

export async function generateFormSubmissionPdf({
  title,
  schema,
  answers,
  submittedAt,
}: {
  title: string;
  schema: FormField[];
  answers: Record<string, unknown>;
  submittedAt: Date;
}): Promise<Buffer> {
  const vm = buildPdfViewModel({
    title,
    schema,
    answers,
    submittedAt,
  });

  return renderPdf(vm);
}
