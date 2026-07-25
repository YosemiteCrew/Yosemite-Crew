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
  messageSimple: {
    content: {
      receiverMessageBackgroundColor: theme.colors.screen2,
      senderMessageBackgroundColor: theme.colors.cta,
      container: {
        borderRadiusL: 18,
        borderRadiusS: 6,
      },
      markdown: {
        text: {
          color: theme.colors.inkBody,
        },
      },
    },
  },
  messageInput: {
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
  messageSimple: {
    content: {
      markdown: {
        text: {
          color: theme.colors.ctaText,
        },
      },
    },
  },
});
