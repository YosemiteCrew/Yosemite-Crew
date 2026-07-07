import { getCalEmbedUrl } from '@/app/ui/overlays/calEmbedUtils';

describe('getCalEmbedUrl', () => {
  it('builds the embed url for a demo link', () => {
    const url = getCalEmbedUrl('yosemitecrew/demo');
    expect(url).toBe(
      'https://app.cal.com/yosemitecrew/demo/embed?theme=light&layout=month_view&embedType=inline&embed=30min'
    );
  });

  it('builds the embed url for an onboarding link', () => {
    const url = getCalEmbedUrl('yosemitecrew/onboarding');
    expect(url).toContain('https://app.cal.com/yosemitecrew/onboarding/embed?');
    expect(url).toContain('embed=30min');
  });
});
