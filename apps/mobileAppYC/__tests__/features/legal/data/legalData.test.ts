import {TERMS_SECTIONS} from '@/features/legal/data/termsData';
import {PRIVACY_POLICY_SECTIONS} from '@/features/legal/data/privacyPolicyData';

describe('mobile legal data updates', () => {
  it('includes trademark notice in terms and privacy sections', () => {
    const termsText = JSON.stringify(TERMS_SECTIONS);
    const privacyText = JSON.stringify(PRIVACY_POLICY_SECTIONS);

    expect(termsText).toContain('including but not limited to IDEXX, Merck');
    expect(privacyText).toContain('including but not limited to IDEXX, Merck');
  });

  it('uses Supabase details and removes MongoDB references', () => {
    const termsText = JSON.stringify(TERMS_SECTIONS);
    const privacyText = JSON.stringify(PRIVACY_POLICY_SECTIONS);
    const combined = `${termsText} ${privacyText}`;

    expect(combined).toContain('Supabase, Inc.');
    expect(combined).toContain(
      '65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513',
    );
    expect(combined).toContain('privacy@supabase.com');
    expect(combined).not.toContain('MongoDB');
  });
});
