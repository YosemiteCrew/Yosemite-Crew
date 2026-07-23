import {buildLegalFileName} from '../../../../src/features/legal/utils/legalFileName';

describe('buildLegalFileName', () => {
  it('sanitizes and joins label parts into a pdf file name', () => {
    expect(buildLegalFileName(['Terms & Conditions', 'v1'])).toBe(
      'Terms-Conditions-v1.pdf',
    );
  });

  it('collapses consecutive non-alphanumeric characters into a single dash', () => {
    expect(
      buildLegalFileName(['Test Clinic', 'Cancellation Policy', 'v2']),
    ).toBe('Test-Clinic-Cancellation-Policy-v2.pdf');
  });

  it('drops empty, null and undefined parts', () => {
    expect(buildLegalFileName(['Privacy Policy', '', null, undefined])).toBe(
      'Privacy-Policy.pdf',
    );
  });

  it('falls back to "document.pdf" when every part is empty', () => {
    expect(buildLegalFileName(['', null, undefined])).toBe('document.pdf');
  });

  it('strips leading and trailing dashes left over from sanitizing punctuation at the edges', () => {
    expect(buildLegalFileName(['!Terms!', '(v1)'])).toBe('Terms-v1.pdf');
  });
});
