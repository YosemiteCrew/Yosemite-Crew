import "dotenv/config";
import { prisma } from "src/config/prisma";
import { REGULATORY_AUTHORITY_SEED } from "src/scripts/regulatory-authority-seed.data";

/**
 * Populates the RegulatoryAuthority table, which tells a reporter where THEY
 * should file an adverse event. It is not a list of addresses for this platform
 * to submit to - see the header of regulatory-authority-seed.data.ts.
 *
 * Idempotent: upserts on iso2, so re-running after a source page changes
 * updates the row rather than duplicating it. Safe to run on every deploy.
 */
const main = async () => {
  let created = 0;
  let updated = 0;

  for (const authority of REGULATORY_AUTHORITY_SEED) {
    const existing = await prisma.regulatoryAuthority.findUnique({
      where: { iso2: authority.iso2 },
      select: { id: true },
    });

    await prisma.regulatoryAuthority.upsert({
      where: { iso2: authority.iso2 },
      create: {
        country: authority.country,
        iso2: authority.iso2,
        iso3: authority.iso3,
        authorityName: authority.authorityName,
        phone: authority.phone,
        email: authority.email,
        website: authority.website,
        notes: authority.notes,
        sourceUrl: authority.sourceUrl,
      },
      update: {
        country: authority.country,
        iso3: authority.iso3,
        authorityName: authority.authorityName,
        phone: authority.phone,
        email: authority.email,
        website: authority.website,
        notes: authority.notes,
        sourceUrl: authority.sourceUrl,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const withEmail = REGULATORY_AUTHORITY_SEED.filter((a) => a.email).length;
  const withWebsite = REGULATORY_AUTHORITY_SEED.filter((a) => a.website).length;

  console.log(
    `Regulatory authority seed complete. ${created} created, ${updated} updated, ` +
      `${REGULATORY_AUTHORITY_SEED.length} total (${withEmail} with an official email, ` +
      `${withWebsite} with an official portal).`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
