import {typography, fonts} from '@/theme/typography';

describe('serif display typography', () => {
  it('registers the Newsreader family constants', () => {
    expect(fonts.NEWSREADER_REGULAR).toBe('Newsreader-Regular');
    expect(fonts.NEWSREADER_ITALIC).toBe('Newsreader-Italic');
  });

  it('uses Newsreader for greetings, titles, heroes and empty states', () => {
    expect(typography.serifTitle.fontFamily).toBe(fonts.NEWSREADER_REGULAR);
    expect(typography.serifTitleSmall.fontFamily).toBe(
      fonts.NEWSREADER_REGULAR,
    );
    expect(typography.emptyStateTitle.fontFamily).toBe(
      fonts.NEWSREADER_REGULAR,
    );
    expect(typography.amountHero.fontFamily).toBe(fonts.NEWSREADER_REGULAR);
    expect(typography.onboardingHeadline.fontFamily).toBe(
      fonts.NEWSREADER_REGULAR,
    );
  });

  it('renders the greeting line in italic Newsreader', () => {
    expect(typography.greeting.fontFamily).toBe(fonts.NEWSREADER_ITALIC);
    expect(typography.greeting.fontStyle).toBe('italic');
    expect(typography.greeting.fontSize).toBe(17);
  });

  it('sizes the serif titles per the handoff', () => {
    expect(typography.serifTitle.fontSize).toBe(30);
    expect(typography.emptyStateTitle.fontSize).toBe(24);
    expect(typography.amountHero.fontSize).toBe(34);
  });

  it('renders the eyebrow as an uppercase Satoshi caps style', () => {
    expect(typography.eyebrow.textTransform).toBe('uppercase');
    expect(typography.eyebrow.fontFamily).toBe(fonts.SATOSHI_BOLD);
    expect(typography.eyebrow.fontSize).toBe(12);
  });

  it('preserves the existing Satoshi body scale', () => {
    expect(typography.body.fontFamily).toBe(fonts.SATOSHI_REGULAR);
    expect(typography.h1).toBeDefined();
    expect(typography.tabLabel).toBeDefined();
  });
});
