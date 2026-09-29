// src/features/chat/streamChatTheme.ts
//
// Warm-bone theme for the Stream Chat message list + input. Incoming bubbles
// sit on the secondary surface, outgoing bubbles on the dark CTA, and the send
// button is the dark CTA FAB. Colours come from the app theme so chat tracks
// the active (light/espresso) theme.

import type {DeepPartial, Theme as StreamTheme} from 'stream-chat-react-native';

import type {Theme} from '@/theme';

/**
 * Global Stream theme: receiver (incoming) bubble surface, asymmetric bubble
 * radii, warm input row, and the dark send button. Receiver text uses body ink.
 */
export const createStreamChatTheme = (
  theme: Theme,
): DeepPartial<StreamTheme> => ({
  semantics: {
    chatBgIncoming: theme.colors.screen2,
    chatBgOutgoing: theme.colors.cta,
    chatTextIncoming: theme.colors.inkBody,
  },
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
 * Applied only to the current user's messages so their text reads on the dark
 * CTA bubble.
 */
export const createMyMessageTheme = (
  theme: Theme,
): DeepPartial<StreamTheme> => ({
  semantics: {
    chatTextOutgoing: theme.colors.ctaText,
  },
  messageItemView: {
    content: {
      container: {
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
      },
    },
  },
});
