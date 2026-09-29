// src/features/chat/streamChatTheme.ts
//
// Warm-bone theme for the Stream Chat message list + input. Incoming bubbles
// sit on the secondary surface, outgoing bubbles on the dark CTA, and the send
// button is the dark CTA FAB. Colours come from the app theme so chat tracks
// the active (light/espresso) theme.

import type {DeepPartial, Theme as StreamTheme} from 'stream-chat-react-native';

import type {Theme} from '@/theme';

// Stream rebuilds `semantics` from its own defaults before applying the
// my-message theme, so both themes carry the full bubble palette.
const chatSemantics = (theme: Theme) => ({
  chatBgIncoming: theme.colors.screen2,
  chatBgOutgoing: theme.colors.cta,
  chatTextIncoming: theme.colors.inkBody,
  chatTextOutgoing: theme.colors.ctaText,
});

/**
 * Global Stream theme: receiver (incoming) bubble surface, asymmetric bubble
 * radii, warm input row, and the dark send button. Receiver text uses body ink.
 */
export const createStreamChatTheme = (
  theme: Theme,
): DeepPartial<StreamTheme> => ({
  semantics: chatSemantics(theme),
  messageItemView: {
    content: {
      container: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
      },
    },
  },
  messageComposer: {
    container: {
      backgroundColor: theme.colors.screen,
    },
    inputBox: {
      color: theme.colors.inkBody,
    },
    sendButton: {
      backgroundColor: theme.colors.cta,
    },
  },
});

/**
 * Applied only to the current user's messages so they keep the dark CTA
 * bubble with readable text.
 */
export const createMyMessageTheme = (
  theme: Theme,
): DeepPartial<StreamTheme> => ({
  semantics: chatSemantics(theme),
  messageItemView: {
    content: {
      container: {
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
      },
    },
  },
});
