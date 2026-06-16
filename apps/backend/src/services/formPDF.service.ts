import { FormField } from "@yosemite-crew/types";
import fs from "node:fs";
import { chromium } from "playwright";
import {
  resolveDocumentPdfTemplate,
  type DocumentPdfTemplateKind,
} from "src/services/document-pdf-template-registry.service";

export interface PdfField {
  label: string;
  value: string;
}

export interface PdfSection {
  title: string;
  fields: PdfField[];
}

export interface PdfBranding {
  organizationName: string;
  addressLines: string[];
  logoUrl?: string | null;
  phoneNo?: string | null;
  website?: string | null;
}

export interface PdfViewModel {
  title: string;
  submittedAt: string;
  sections: PdfSection[];
}

export type PdfTemplateKind = DocumentPdfTemplateKind;

export interface PdfRenderOptions {
  templateKind?: PdfTemplateKind;
  branding?: PdfBranding | null;
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

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderBranding = (branding?: PdfBranding | null): string => {
  if (!branding) {
    return "";
  }

  const addressLines = branding.addressLines
    .filter((line) => line.trim().length > 0)
    .map((line) => `<div class="brand-address-line">${escapeHtml(line)}</div>`)
    .join("");

  const logo = branding.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.organizationName)} logo" />`
    : "";

  const contactLines = [branding.phoneNo, branding.website]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => `<div class="brand-contact-line">${escapeHtml(line)}</div>`)
    .join("");

  return `
    <div class="brand">
      ${logo ? `<div class="brand-logo-wrap">${logo}</div>` : ""}
      <div class="brand-copy">
        <div class="brand-name">${escapeHtml(branding.organizationName)}</div>
        ${addressLines ? `<div class="brand-address">${addressLines}</div>` : ""}
        ${contactLines ? `<div class="brand-contact">${contactLines}</div>` : ""}
      </div>
    </div>
  `;
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

function renderSections(vm: PdfViewModel): string {
  return vm.sections
    .map(
      (section) => `
        <h2>${escapeHtml(section.title)}</h2>
        ${section.fields
          .map(
            (f) => `
              <div class="field">
                <span class="label">${escapeHtml(f.label)}:</span>
                <span class="value">${escapeHtml(f.value).replaceAll("\n", "<br />")}</span>
              </div>
            `,
          )
          .join("")}
      `,
    )
    .join("");
}

function applyTemplate(
  vm: PdfViewModel,
  templateHtml: string,
  templateLabel: string,
  options?: PdfRenderOptions,
): string {
  let html = templateHtml;

  html = html.replaceAll("{{title}}", escapeHtml(vm.title));
  html = html.replaceAll("{{submittedAt}}", escapeHtml(vm.submittedAt));
  html = html.replaceAll("{{templateLabel}}", escapeHtml(templateLabel));
  html = html.replaceAll("{{brandSection}}", renderBranding(options?.branding));
  html = html.replaceAll("{{sections}}", renderSections(vm));

  return html;
}

export async function renderPdf(
  vm: PdfViewModel,
  options?: PdfRenderOptions,
): Promise<Buffer> {
  const templateKind = options?.templateKind ?? "FORM";
  const template = resolveDocumentPdfTemplate(templateKind);
  const templateHtml = fs.readFileSync(template.path, "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(
    applyTemplate(vm, templateHtml, template.label, options),
    {
      waitUntil: "load",
    },
  );

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
  return renderPdf(buildPdfViewModel({ title, schema, answers, submittedAt }), {
    templateKind: "FORM",
  });
}
