import {
  createMyMessageTheme,
  createStreamChatTheme,
} from '@/features/chat/streamChatTheme';
import {mockTheme} from '../../setup/mockTheme';

describe('streamChatTheme', () => {
  it('puts incoming bubbles on the secondary surface and outgoing on the CTA', () => {
    const t = createStreamChatTheme(mockTheme as never);
    const content = t.messageSimple?.content;
    expect(content?.receiverMessageBackgroundColor).toBe(
      mockTheme.colors.screen2,
    );
    expect(content?.senderMessageBackgroundColor).toBe(mockTheme.colors.cta);
  });

  it('uses asymmetric bubble radii', () => {
    const content = createStreamChatTheme(mockTheme as never).messageSimple
      ?.content;
    expect(content?.container?.borderRadiusL).toBe(18);
    expect(content?.container?.borderRadiusS).toBe(6);
  });

  it('styles the input row and the dark send button', () => {
    const input = createStreamChatTheme(mockTheme as never).messageInput;
    expect(input?.container?.backgroundColor).toBe(mockTheme.colors.screen);
    expect(input?.sendButton?.backgroundColor).toBe(mockTheme.colors.cta);
    expect(input?.inputBox?.color).toBe(mockTheme.colors.inkBody);
  });

  it('colours receiver message text with body ink', () => {
    const md = createStreamChatTheme(mockTheme as never).messageSimple?.content
      ?.markdown as {text?: {color?: string}};
    expect(md?.text?.color).toBe(mockTheme.colors.inkBody);
  });

  it('overrides only the sender message text colour for readability on the CTA', () => {
    const md = createMyMessageTheme(mockTheme as never).messageSimple?.content
      ?.markdown as {text?: {color?: string}};
    expect(md?.text?.color).toBe(mockTheme.colors.ctaText);
  });
});
