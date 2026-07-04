import { trustCenterData } from '@/app/features/legal/pages/trustCenterData';
import { CERT_BADGES } from '@/app/features/marketing/site';

describe('trustCenterData', () => {
  it('contains the hero eyebrow, title, subtitle and meta', () => {
    expect(trustCenterData.hero.eyebrow).toBe('Security');
    expect(trustCenterData.hero.title).toBe('Security, privacy and compliance');
    expect(trustCenterData.hero.subtitle).toContain(
      'Protecting the data of pet businesses and pet parents'
    );
    expect(trustCenterData.hero.meta).toBe('Updated February 2026 · support@yosemitecrew.com');
  });

  it('contains the seven table-of-contents entries', () => {
    expect(trustCenterData.toc).toHaveLength(7);
    expect(trustCenterData.toc.map((entry) => entry.id)).toEqual([
      'approach',
      'certifications',
      'controls',
      'residency',
      'subprocessors',
      'resources',
      'disclosure',
    ]);
  });

  it('lists the approach badge strip using CDN cert badges', () => {
    expect(trustCenterData.approachBadges).toHaveLength(5);
    expect(trustCenterData.approachBadges.map((b) => b.alt)).toEqual([
      'GDPR',
      'SOC 2',
      'ISO 27001',
      'FHIR',
      '21 CFR Part 11',
    ]);
    expect(trustCenterData.approachBadges[0].src).toBe(CERT_BADGES.gdpr);
  });

  it('contains nine certifications with correct statuses', () => {
    expect(trustCenterData.certifications).toHaveLength(9);

    const gdpr = trustCenterData.certifications.find((c) => c.name === 'GDPR');
    expect(gdpr?.status).toBe('COMPLIANT');
    expect(gdpr?.badge).toBe(CERT_BADGES.gdpr);

    const esign = trustCenterData.certifications.find((c) => c.name === 'ESIGN Act');
    expect(esign?.status).toBe('COMPLIANT');
    expect(esign?.icon).toBe('create-outline');

    const zertes = trustCenterData.certifications.find((c) => c.name === 'ZertES');
    expect(zertes?.status).toBe('PLANNED');

    const hipaa = trustCenterData.certifications.find((c) => c.name === 'HIPAA');
    expect(hipaa?.status).toBe('PLANNED');
    expect(hipaa?.icon).toBe('medkit-outline');
  });

  it('contains five security pillars with checklist items', () => {
    expect(trustCenterData.securityPillars).toHaveLength(5);

    const org = trustCenterData.securityPillars.find((p) => p.title === 'Organizational security');
    expect(org?.items).toContain('Regular internal security audits');

    const product = trustCenterData.securityPillars.find((p) => p.title === 'Product security');
    expect(product?.items).toContain('AES-256 encryption at rest');
  });

  it('contains four subprocessors with locations', () => {
    expect(trustCenterData.subProcessors).toHaveLength(4);

    const aws = trustCenterData.subProcessors.find((s) => s.name === 'Amazon Web Services');
    expect(aws?.location).toBe('Luxembourg (EU)');
    expect(aws?.service).toBe('Cloud infrastructure and storage');

    const supabase = trustCenterData.subProcessors.find((s) => s.name === 'Supabase, Inc.');
    expect(supabase?.location).toBe('Singapore');

    const posthog = trustCenterData.subProcessors.find((s) => s.name === 'PostHog');
    expect(posthog?.service).toBe('Product analytics (on consent)');
  });
});
