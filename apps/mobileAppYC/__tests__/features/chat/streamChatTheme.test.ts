import {
  createMyMessageTheme,
  createStreamChatTheme,
} from '@/features/chat/streamChatTheme';
import {mockTheme} from '../../setup/mockTheme';

describe('streamChatTheme', () => {
  it('puts incoming bubbles on the secondary surface and outgoing on the CTA', () => {
    const t = createStreamChatTheme(mockTheme as never);
    expect(t.semantics?.chatBgIncoming).toBe(mockTheme.colors.screen2);
    expect(t.semantics?.chatBgOutgoing).toBe(mockTheme.colors.cta);
  });

  it('uses asymmetric bubble radii', () => {
    const content = createStreamChatTheme(mockTheme as never).messageItemView
      ?.content?.container;
    expect(content?.borderTopLeftRadius).toBe(18);
    expect(content?.borderTopRightRadius).toBe(18);
    expect(content?.borderBottomLeftRadius).toBe(6);
  });

  it('styles the input row and the dark send button', () => {
    const input = createStreamChatTheme(mockTheme as never).messageComposer;
    expect(input?.container?.backgroundColor).toBe(mockTheme.colors.screen);
    expect(input?.sendButton?.backgroundColor).toBe(mockTheme.colors.cta);
    expect(input?.inputBox?.color).toBe(mockTheme.colors.inkBody);
  });

  it('colours receiver message text with body ink', () => {
    const semantics = createStreamChatTheme(mockTheme as never).semantics;
    expect(semantics?.chatTextIncoming).toBe(mockTheme.colors.inkBody);
  });

  it('pairs the CTA outgoing bubble with CTA text in the global theme', () => {
    const semantics = createStreamChatTheme(mockTheme as never).semantics;
    expect(semantics?.chatTextOutgoing).toBe(mockTheme.colors.ctaText);
  });

  it('keeps the CTA bubble and its text colour on the sender message theme', () => {
    // Stream swaps in its default semantics before merging this theme, so the
    // outgoing bubble colour has to be repeated here.
    const themeOverride = createMyMessageTheme(mockTheme as never);
    expect(themeOverride.semantics?.chatBgOutgoing).toBe(mockTheme.colors.cta);
    expect(themeOverride.semantics?.chatTextOutgoing).toBe(
      mockTheme.colors.ctaText,
    );
    expect(
      themeOverride.messageItemView?.content?.container
        ?.borderBottomRightRadius,
    ).toBe(6);
  });
});
