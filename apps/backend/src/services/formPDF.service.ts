import { FormField } from "@yosemite-crew/types";
import fs from "node:fs";
import { chromium, type Browser } from "playwright";
import {
  addCachedPromise,
  type CachedPromise,
} from "src/utils/cached-promise-cache";
import {
  assertDocumentPdfTemplatePath,
  resolveDocumentPdfTemplate,
  type DocumentPdfTemplateKind,
} from "src/services/document-pdf-template-registry.service";
import logger from "src/utils/logger";

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
    .filter((line): line is string => Boolean(line?.trim()))
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

// Templates are static files on disk — cache their contents so repeated renders
// do not re-read them, and read asynchronously so the event loop is never blocked.
const TEMPLATE_CACHE_TTL_MS = 60 * 60 * 1000;
const TEMPLATE_CACHE_MAX_ENTRIES = 16;
const templateCache = new Map<string, CachedPromise<string>>();

const readTemplate = (templatePath: string): Promise<string> => {
  // Checked before the cache rather than inside the loader, so a path that
  // resolves outside the template directory never occupies a cache slot.
  assertDocumentPdfTemplatePath(templatePath);

  return addCachedPromise(
    templateCache,
    templatePath,
    TEMPLATE_CACHE_TTL_MS,
    () => fs.promises.readFile(templatePath, "utf8"),
    {
      maxEntries: TEMPLATE_CACHE_MAX_ENTRIES,
      pruneIntervalMs: TEMPLATE_CACHE_TTL_MS,
    },
  );
};

export const clearPdfTemplateCache = (): void => {
  templateCache.clear();
};

// Launching Chromium costs hundreds of milliseconds and hundreds of MB of RSS,
// so one browser is shared across renders; each render gets its own context,
// which gives the same isolation as a fresh browser at a fraction of the cost.
let sharedBrowserPromise: Promise<Browser> | null = null;

const launchSharedBrowser = (): Promise<Browser> => {
  const launched: Promise<Browser> = chromium
    .launch()
    .catch((error: unknown) => {
      // Do not cache a failed launch — the next render should retry.
      if (sharedBrowserPromise === launched) {
        sharedBrowserPromise = null;
      }
      throw error;
    });
  return launched;
};

const getSharedBrowser = async (): Promise<Browser> => {
  const existing = sharedBrowserPromise;
  if (existing) {
    const browser = await existing;
    if (browser.isConnected()) {
      return browser;
    }
    // The browser crashed or was closed externally — replace it, unless a
    // concurrent caller already has.
    if (sharedBrowserPromise === existing) {
      sharedBrowserPromise = null;
    }
  }
  sharedBrowserPromise ??= launchSharedBrowser();
  return sharedBrowserPromise;
};

export const closePdfBrowser = async (): Promise<void> => {
  const existing = sharedBrowserPromise;
  sharedBrowserPromise = null;
  if (!existing) return;
  try {
    const browser = await existing;
    await browser.close();
  } catch (error) {
    logger.warn("PDF browser was not closed cleanly", { error });
  }
};

export async function renderPdf(
  vm: PdfViewModel,
  options?: PdfRenderOptions,
): Promise<Buffer> {
  const templateKind = options?.templateKind ?? "FORM";
  const template = resolveDocumentPdfTemplate(templateKind);
  const templateHtml = await readTemplate(template.path);
  const browser = await getSharedBrowser();
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    await page.setContent(
      applyTemplate(vm, templateHtml, template.label, options),
      {
        waitUntil: "load",
      },
    );

    return await page.pdf({
      format: "A4",
      printBackground: true,
    });
  } finally {
    // Teardown must run even when rendering throws, or the Chromium resources
    // leak; a close failure must not mask the render error.
    try {
      await context.close();
    } catch (error) {
      logger.warn("PDF browser context was not closed cleanly", { error });
    }
  }
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
