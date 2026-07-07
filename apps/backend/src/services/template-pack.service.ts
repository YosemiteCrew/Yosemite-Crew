import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  buildListPage,
  keysetWhere,
  type ListPage,
} from "src/utils/cursor-pagination";
import { emitDeveloperEvent } from "src/utils/developer-events";

// Template packs (plan: developer-portal-plugin-registry.md, template slice).
// A pack is a validated manifest of config contributions: a publisher org
// bundles its PUBLISHED templates, pinning each at its current
// publishedVersion. Installing materializes each pinned TemplateVersion
// snapshot as a NEW DRAFT Template in the installing org - never published
// automatically (ADR 0005: config goes live only through the existing
// interactive publish flow). Uninstall deletes only the install record: the
// materialized drafts belong to the installing org from the moment they are
// created (the org may have edited or published them, and clinical records
// may reference them), so the registry never reaches back into org config.
// Suspension blocks NEW installs but never touches orgs that already
// installed (registry design promise, section 7).

export class TemplatePackServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TemplatePackServiceError";
  }
}

const PACK_SELECT = {
  id: true,
  publisherOrganisationId: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      templateId: true,
      snapshotVersion: true,
      addedAt: true,
    },
    orderBy: { addedAt: "asc" },
  },
} as const;

// Catalog rows never expose the publisher org id - only its display linkage
// through the pack itself (aggregate-only boundary, registry plan section 5).
const CATALOG_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  items: {
    select: { id: true, templateId: true, snapshotVersion: true },
    orderBy: { addedAt: "asc" },
  },
} as const;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === "P2002";

export const TemplatePackService = {
  // Creates a DRAFT pack from the caller org's PUBLISHED templates. Every
  // template must belong to the publisher org and be PUBLISHED with a
  // publishedVersion - the pack pins that version (snapshotVersion) so later
  // edits to the source template never change what an install materializes.
  async create(input: {
    publisherOrganisationId: string;
    name: string;
    slug: string;
    description?: string;
    templateIds: string[];
  }) {
    const templates = await prisma.template.findMany({
      where: { id: { in: input.templateIds } },
      select: {
        id: true,
        organisationId: true,
        ownership: true,
        status: true,
        publishedVersion: true,
      },
    });
    const byId = new Map(templates.map((row) => [row.id, row]));
    for (const templateId of input.templateIds) {
      const template = byId.get(templateId);
      if (
        !template ||
        template.organisationId !== input.publisherOrganisationId ||
        template.ownership !== "ORG_TEMPLATE"
      ) {
        // Foreign / missing templates get the same answer - no existence leak.
        throw new TemplatePackServiceError(
          `Template not found: ${templateId}`,
          404,
          "not_found",
        );
      }
      if (template.status !== "PUBLISHED" || !template.publishedVersion) {
        throw new TemplatePackServiceError(
          `Template is not published: ${templateId}`,
          409,
          "template_not_published",
        );
      }
    }

    try {
      return await prisma.templatePack.create({
        data: {
          publisherOrganisationId: input.publisherOrganisationId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          items: {
            create: input.templateIds.map((templateId) => ({
              templateId,
              // Validated non-null above.
              snapshotVersion: byId.get(templateId)?.publishedVersion ?? 1,
            })),
          },
        },
        select: PACK_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new TemplatePackServiceError(
          "A template pack with this slug already exists",
          409,
          "slug_taken",
        );
      }
      throw error;
    }
  },

  async list(publisherOrganisationId: string) {
    return prisma.templatePack.findMany({
      where: { publisherOrganisationId },
      select: PACK_SELECT,
      orderBy: { createdAt: "desc" },
    });
  },

  // Publishes a DRAFT pack. SUSPENDED packs cannot be self-republished by the
  // publisher - suspension is an admin action and only an admin lifts it.
  async publish(publisherOrganisationId: string, packId: string) {
    const pack = await prisma.templatePack.findFirst({
      where: { id: packId, publisherOrganisationId },
      select: { id: true, status: true },
    });
    if (!pack) {
      throw new TemplatePackServiceError(
        "Template pack not found",
        404,
        "not_found",
      );
    }
    if (pack.status !== "DRAFT") {
      throw new TemplatePackServiceError(
        `Template pack cannot be published from status ${pack.status}`,
        409,
        "invalid_status",
      );
    }
    return prisma.templatePack.update({
      where: { id: pack.id },
      data: { status: "PUBLISHED" },
      select: PACK_SELECT,
    });
  },

  // Public catalog: PUBLISHED packs only, keyset-paginated on createdAt like
  // every other list surface.
  async catalog(input: {
    limit: number;
    cursor?: string;
  }): Promise<ListPage<unknown>> {
    const where: Prisma.TemplatePackWhereInput = { status: "PUBLISHED" };
    const keyset = keysetWhere("createdAt", input.cursor);
    const rows = await prisma.templatePack.findMany({
      where: keyset ? { ...where, AND: [keyset] } : where,
      select: CATALOG_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "createdAt");
  },

  // Install: materializes every pack item as a NEW DRAFT Template in the
  // installing org (ownership ORG_TEMPLATE, status DRAFT, version 1 carrying
  // the pinned TemplateVersion's snapshots). NEVER publishes anything - the
  // installing org reviews each draft and promotes it through the existing
  // publish machinery (ADR 0005 draft/promote gate).
  async install(input: {
    packId: string;
    organisationId: string;
    installedBy: string;
  }) {
    const pack = await prisma.templatePack.findUnique({
      where: { id: input.packId },
      select: {
        id: true,
        slug: true,
        status: true,
        publisherOrganisationId: true,
        items: { select: { templateId: true, snapshotVersion: true } },
      },
    });
    // DRAFT packs are invisible to non-publishers: same 404 as a missing id.
    if (!pack || pack.status === "DRAFT") {
      throw new TemplatePackServiceError(
        "Template pack not found",
        404,
        "not_found",
      );
    }
    if (pack.status === "SUSPENDED") {
      throw new TemplatePackServiceError(
        "Template pack is suspended and cannot be installed",
        409,
        "pack_suspended",
      );
    }
    const existing = await prisma.templatePackInstall.findUnique({
      where: {
        packId_organisationId: {
          packId: pack.id,
          organisationId: input.organisationId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new TemplatePackServiceError(
        "Template pack is already installed",
        409,
        "already_installed",
      );
    }

    const versions = await prisma.templateVersion.findMany({
      where: {
        OR: pack.items.map((item) => ({
          templateId: item.templateId,
          version: item.snapshotVersion,
        })),
      },
      select: {
        templateId: true,
        version: true,
        schemaSnapshot: true,
        renderConfigSnapshot: true,
        validationSnapshot: true,
        template: {
          select: {
            kind: true,
            name: true,
            description: true,
            scope: true,
            rules: true,
          },
        },
      },
    });
    const versionByKey = new Map(
      versions.map((row) => [`${row.templateId}:${row.version}`, row]),
    );

    const install = await prisma.$transaction(async (tx) => {
      const materializedTemplateIds: string[] = [];
      for (const item of pack.items) {
        const source = versionByKey.get(
          `${item.templateId}:${item.snapshotVersion}`,
        );
        if (!source) {
          throw new TemplatePackServiceError(
            "Template pack snapshot is missing a pinned version",
            409,
            "snapshot_missing",
          );
        }
        const created = await tx.template.create({
          data: {
            organisationId: input.organisationId,
            ownership: "ORG_TEMPLATE",
            kind: source.template.kind,
            name: source.template.name,
            description: source.template.description,
            status: "DRAFT",
            scope: source.template.scope,
            rules: source.template.rules ?? undefined,
            latestVersion: 1,
            publishedVersion: null,
            createdBy: input.installedBy,
            updatedBy: input.installedBy,
          },
        });
        await tx.templateVersion.create({
          data: {
            templateId: created.id,
            version: 1,
            schemaSnapshot: source.schemaSnapshot ?? {},
            renderConfigSnapshot: source.renderConfigSnapshot ?? undefined,
            validationSnapshot: source.validationSnapshot ?? undefined,
            createdBy: input.installedBy,
          },
        });
        materializedTemplateIds.push(created.id);
      }
      // Created last: the install row exists only once every draft committed.
      // The unique (packId, organisationId) makes a racing second install
      // fail its insert instead of double-materializing.
      return tx.templatePackInstall.create({
        data: {
          packId: pack.id,
          organisationId: input.organisationId,
          materializedTemplateIds,
        },
      });
    });

    // Emitted to the PUBLISHER org's stream. Aggregate-only boundary: the
    // installing org's identity never crosses to the publisher.
    emitDeveloperEvent(
      "template_pack.installed",
      pack.publisherOrganisationId,
      {
        packId: pack.id,
        slug: pack.slug,
      },
    );

    return install;
  },

  // Uninstall deletes ONLY the install record. The materialized drafts stay:
  // they became the installing org's own config at materialization time (the
  // org may have edited or published them, and FormSubmission /
  // TemplateInstance rows may reference them), so deleting them here could
  // destroy org work or orphan clinical records. The org prunes unwanted
  // drafts itself through the normal template lifecycle.
  async uninstall(input: { packId: string; organisationId: string }) {
    const result = await prisma.templatePackInstall.deleteMany({
      where: { packId: input.packId, organisationId: input.organisationId },
    });
    if (result.count === 0) {
      throw new TemplatePackServiceError(
        "Template pack install not found",
        404,
        "not_found",
      );
    }
  },
};
