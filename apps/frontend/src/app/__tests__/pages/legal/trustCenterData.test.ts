import { trustCenterData } from "@/app/features/legal/pages/trustCenterData";

describe("trustCenterData", () => {
  it("should contain the correct Hero section data", () => {
    expect(trustCenterData.hero).toBeDefined();
    expect(trustCenterData.hero.title).toBe("Security, Privacy, and Compliance");
    expect(trustCenterData.hero.subtitle).toContain("At Yosemite Crew");
    expect(trustCenterData.hero.lastUpdated).toBe("February 2026");
    expect(trustCenterData.hero.email).toBe("support@yosemitecrew.com");
    expect(trustCenterData.hero.privacyLink).toBe("/privacy-policy");
  });

  it("should contain the correct Tabs", () => {
    expect(trustCenterData.tabs).toHaveLength(4);
    expect(trustCenterData.tabs).toEqual(["Overview", "Resources", "Controls", "Subprocessors"]);
  });

  it("should contain the correct Certifications & Compliance data", () => {
    expect(trustCenterData.certifications).toHaveLength(9);

    const gdpr = trustCenterData.certifications.find((c) => c.name === "GDPR");
    expect(gdpr).toBeDefined();
    expect(gdpr?.status).toBe("Compliant");
    expect(gdpr?.icon).toContain("gdpr.png");

    const fda = trustCenterData.certifications.find((c) => c.name === "21 CFR Part 11");
    expect(fda?.icon).toBe("📜");

    const esign = trustCenterData.certifications.find((c) => c.name === "ESIGN Act");
    expect(esign?.icon).toBe("🇺🇸");

    const hipaa = trustCenterData.certifications.find((c) => c.name === "HIPAA");
    expect(hipaa?.status).toBe("Planned");
    expect(hipaa?.icon).toBe("🏥");
  });

  it("should contain the correct Resources data", () => {
    expect(trustCenterData.resources).toHaveLength(4);

    const socReport = trustCenterData.resources.find((r) => r.id === "res_soc2_2025");
    expect(socReport?.locked).toBe(true);
    expect(socReport?.type).toBe("Audit Report");

    const dpa = trustCenterData.resources.find((r) => r.id === "res_dpa");
    expect(dpa?.locked).toBe(false);
    expect(dpa?.link).toBe("/terms-and-conditions");
  });

  it("should contain the correct Security Pillars (Controls)", () => {
    expect(trustCenterData.securityPillars).toHaveLength(5);

    const orgSecurity = trustCenterData.securityPillars.find(
      (p) => p.title === "Organizational Security"
    );
    expect(orgSecurity).toBeDefined();
    expect(orgSecurity?.items.length).toBeGreaterThan(0);
    expect(orgSecurity?.items).toContain("Regular Internal Security Audits");

    const infraSecurity = trustCenterData.securityPillars.find(
      (p) => p.title === "Infrastructure Security"
    );
    expect(infraSecurity?.description).toContain("Fortified cloud environment");
  });

  it("should contain the correct Subprocessors data", () => {
    expect(trustCenterData.subProcessors).toHaveLength(4);

    const aws = trustCenterData.subProcessors.find((s) => s.name === "Amazon Web Services");
    expect(aws?.location).toBe("Luxembourg (EU)");

    const postgres = trustCenterData.subProcessors.find((s) => s.name === "PostgreSQL");
    expect(postgres).toBeDefined();
    expect(postgres?.service).toBe("Relational Database");
    expect(postgres?.location).toBe("Ireland (EU)");
    expect(postgres?.logo).toContain("Postgresql_elephant.svg");
  });
});