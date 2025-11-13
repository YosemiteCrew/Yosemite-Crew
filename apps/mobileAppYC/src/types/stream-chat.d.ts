import {
  DefaultAttachmentData,
  DefaultChannelData,
  DefaultCommandData,
  DefaultEventData,
  DefaultMemberData,
  DefaultMessageData,
  DefaultPollData,
  DefaultPollOptionData,
  DefaultReactionData,
  DefaultThreadData,
  DefaultUserData,
} from 'stream-chat';

declare module 'stream-chat' {
  interface CustomAttachmentData extends DefaultAttachmentData {}

  interface CustomChannelData extends DefaultChannelData {
    appointmentId?: string;
    appointmentTime?: string;
    petName?: string;
    activationMinutes?: number;
    status?: 'active' | 'ended';
    doctorName?: string;
  }

  interface CustomCommandData extends DefaultCommandData {}

  interface CustomEventData extends DefaultEventData {}

  interface CustomMemberData extends DefaultMemberData {}

  interface CustomMessageData extends DefaultMessageData {}

  interface CustomPollOptionData extends DefaultPollOptionData {}

  interface CustomPollData extends DefaultPollData {}

  interface CustomReactionData extends DefaultReactionData {}

  interface CustomThreadData extends DefaultThreadData {}

  interface CustomUserData extends DefaultUserData {
    role?: string;
  }
}
