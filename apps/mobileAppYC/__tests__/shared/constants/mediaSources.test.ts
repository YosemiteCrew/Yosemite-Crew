import {ycCdn, ycOrgCdn, MEDIA_SOURCES} from '@/shared/constants/mediaSources';

describe('mediaSources', () => {
  it('builds curated media CDN urls and strips leading slashes', () => {
    expect(ycCdn('avatar/dog.png')).toBe(
      'https://d2il6osz49gpup.cloudfront.net/avatar/dog.png',
    );
    expect(ycCdn('/avatar/dog.png')).toBe(
      'https://d2il6osz49gpup.cloudfront.net/avatar/dog.png',
    );
  });

  it('builds org CDN urls for uploaded content', () => {
    expect(ycOrgCdn('uploads/doc.pdf')).toBe(
      'https://d2kyjiikho62xx.cloudfront.net/uploads/doc.pdf',
    );
  });

  it('catalogs integration logos on the curated CDN', () => {
    expect(MEDIA_SOURCES.integrations.merckLogo).toBe(
      'https://d2il6osz49gpup.cloudfront.net/integrations/merckLogo.png',
    );
    expect(MEDIA_SOURCES.integrations.msdLogo).toBe(
      'https://d2il6osz49gpup.cloudfront.net/integrations/MSDLogo.png',
    );
  });

  it('catalogs species portraits and onboarding media', () => {
    expect(MEDIA_SOURCES.species.horse).toContain('/avatar/horse.png');
    expect(MEDIA_SOURCES.onboarding.slide1.video).toBe(
      'https://d2il6osz49gpup.cloudfront.net/mobile/videos/loop-cat.mp4',
    );
    expect(MEDIA_SOURCES.onboarding.slide2.video).toBe(
      'https://d2il6osz49gpup.cloudfront.net/mobile/videos/loop-dog.mp4',
    );
    expect(MEDIA_SOURCES.onboarding.slide3.video).toBe(
      'https://d2il6osz49gpup.cloudfront.net/mobile/videos/loop-care.mp4',
    );
  });
});
