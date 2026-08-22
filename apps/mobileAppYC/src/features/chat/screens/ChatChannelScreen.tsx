/**
 * ChatChannelScreen
 *
 * Real-time chat screen for appointment-based conversations
 * between pet owners and veterinarians using Stream Chat.
 */

import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {StyleSheet, View, Text, Alert} from 'react-native';
import {
  Channel,
  MessageList,
  Chat,
  OverlayProvider,
  MessageInput,
} from 'stream-chat-react-native';
import type {Channel as StreamChannel} from 'stream-chat';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {
  getChatClient,
  connectStreamUser,
  getAppointmentChannel,
} from '../services/streamChatService';
import {useTheme} from '@/hooks';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {GifLoader} from '@/shared/components/common';
import {selectAuthUser} from '@/features/auth/selectors';
import {CustomAttachment} from '../components/CustomAttachment';
import {ChatEmptyState} from '../components/ChatEmptyState';
import {ChatTypingIndicator} from '../components/ChatTypingIndicator';
import type {TabParamList} from '@/navigation/types';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {
  createMyMessageTheme,
  createStreamChatTheme,
} from '@/features/chat/streamChatTheme';

import i18next from 'i18next';
type RouteParams = {
  appointmentId: string;
  vetId: string;
  appointmentTime: string;
  doctorName: string;
  petName?: string;
};

const getInitials = (name: string): string => {
  const cleaned = name.replace(/^dr\.?\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
  return initials || '?';
};

const ChatChannelHeader: React.FC<{
  doctorName: string;
  petName?: string;
  isTyping?: boolean;
  onBack: () => void;
}> = ({doctorName, petName, isTyping, onBack}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createHeaderStyles(theme), [theme]);
  const initials = useMemo(() => getInitials(doctorName), [doctorName]);
  const subtitle = petName ? `About ${petName}` : undefined;

  let statusNode: React.ReactNode = null;
  if (isTyping) {
    statusNode = (
      <Text style={styles.typingStatus} numberOfLines={1}>
        typing...
      </Text>
    );
  } else if (subtitle) {
    statusNode = (
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    );
  }

  return (
    <View style={styles.header} testID="Header">
      <PressableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="HeaderBackButton">
        <Ionicons name="chevron-back" size={18} color={theme.colors.inkBody} />
      </PressableOpacity>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
        <View style={styles.presenceDot} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {doctorName}
        </Text>
        {statusNode}
      </View>
    </View>
  );
};

export const ChatChannelScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chatTheme = useMemo(() => createStreamChatTheme(theme), [theme]);
  const myMessageTheme = useMemo(() => createMyMessageTheme(theme), [theme]);
  const navigation = useNavigation();
  const route = useRoute();
  const authUser = useSelector(selectAuthUser);
  const {appointmentId, vetId, appointmentTime, doctorName, petName} =
    route.params as RouteParams;

  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  const currentChatUserId = useMemo(
    () => authUser?.parentId ?? authUser?.id,
    [authUser],
  );

  const renderEmptyState = useCallback(
    () => <ChatEmptyState petName={petName} />,
    [petName],
  );
  const renderTypingIndicator = useCallback(() => <ChatTypingIndicator />, []);

  const initChat = useCallback(async () => {
    try {
      console.log('[Chat] Initializing chat for appointment:', appointmentId);

      // Note: Time check is now handled in MyAppointmentsScreen before navigation
      // This allows "Mock Chat" button to bypass time restrictions for testing

      if (!authUser?.id) {
        const missingUserMessage =
          'You must be signed in to chat with your vet. Please log in and try again.';
        setError(missingUserMessage);
        setLoading(false);
        Alert.alert(
          i18next.t('alerts.shared.chatUnavailable'),
          missingUserMessage,
          [{text: 'Go Back', onPress: () => navigation.goBack()}],
        );
        return;
      }

      const displayName =
        [authUser.firstName, authUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        authUser.email ||
        'Pet Parent';
      const avatar = authUser.profilePicture ?? undefined;
      const chatUserId = authUser.parentId ?? authUser.id;

      console.log('[Chat] Connecting as user:', chatUserId);

      // 2. Connect to Stream
      const chatClient = getChatClient();
      await connectStreamUser(chatUserId, displayName, avatar);

      setClient(chatClient);

      // 3. Get or create appointment channel
      console.log('[Chat] Getting appointment channel...');
      const appointmentChannel = await getAppointmentChannel(
        appointmentId,
        vetId,
        {
          doctorName,
          dateTime: appointmentTime,
          petName,
        },
      );

      console.log('[Chat] Channel ready');
      setChannel(appointmentChannel);
      setLoading(false);
    } catch (err: any) {
      console.error('[Chat] Initialization error:', err);

      // User-friendly error messages
      let errorMessage =
        typeof err?.message === 'string' && err.message.length > 0
          ? err.message
          : 'Failed to load chat. Please try again.';

      if (err.message?.includes('API key')) {
        errorMessage = 'Chat is not configured. Please contact support.';
      } else if (err.message?.includes('network')) {
        errorMessage =
          'Network error. Please check your connection and try again.';
      }

      setError(errorMessage);
      setLoading(false);

      // Show alert
      Alert.alert(i18next.t('alerts.chat.chatError'), errorMessage, [
        {
          text: 'Go Back',
          onPress: () => navigation.goBack(),
        },
        {
          text: 'Retry',
          onPress: () => {
            setLoading(true);
            setError(null);
            initChat();
          },
        },
      ]);
    }
  }, [
    appointmentId,
    appointmentTime,
    authUser,
    doctorName,
    navigation,
    petName,
    vetId,
  ]);

  useEffect(() => {
    initChat();

    // Cleanup function
    return () => {
      // Note: We don't disconnect user here as they might have other channels open
      // Disconnect should happen on app logout
    };
  }, [initChat]);

  // Live "typing..." status for the other participant in the header.
  useEffect(() => {
    if (!channel) {
      return;
    }
    const handleTypingStart = (event: any) => {
      if (event.user?.id && event.user.id !== currentChatUserId) {
        setIsTyping(true);
      }
    };
    const handleTypingStop = (event: any) => {
      if (event.user?.id && event.user.id !== currentChatUserId) {
        setIsTyping(false);
      }
    };
    const startSub = channel.on('typing.start', handleTypingStart);
    const stopSub = channel.on('typing.stop', handleTypingStop);
    return () => {
      startSub.unsubscribe();
      stopSub.unsubscribe();
      setIsTyping(false);
    };
  }, [channel, currentChatUserId]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation
        .getParent<NavigationProp<TabParamList> | undefined>()
        ?.navigate?.('Appointments', {screen: 'MyAppointments'});
    }
  }, [navigation]);

  // Loading state
  if (loading) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <ChatChannelHeader
            doctorName={doctorName}
            petName={petName}
            onBack={handleBackPress}
          />
        }
        useSafeAreaView
        containerStyle={styles.container}
        showBottomFade={false}>
        {() => (
          <View style={styles.contentWrapper}>
            <View style={styles.centerContainer}>
              <GifLoader />
            </View>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  // Error state
  if (error || !channel || !client) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <ChatChannelHeader
            doctorName={doctorName}
            petName={petName}
            onBack={handleBackPress}
          />
        }
        useSafeAreaView
        containerStyle={styles.container}
        showBottomFade={false}>
        {() => (
          <View style={styles.contentWrapper}>
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>
                {error || 'Unable to load chat'}
              </Text>
              <Text style={styles.errorSubtext}>
                {!error && 'Please check your connection and try again'}
              </Text>
            </View>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  // Chat UI
  return (
    <LiquidGlassHeaderScreen
      header={
        <ChatChannelHeader
          doctorName={doctorName}
          petName={petName}
          isTyping={isTyping}
          onBack={handleBackPress}
        />
      }
      useSafeAreaView
      containerStyle={styles.container}
      showBottomFade={false}>
      {() => (
        <View style={styles.contentWrapper}>
          <View style={styles.chatWrapper}>
            <OverlayProvider>
              <Chat client={client} style={chatTheme}>
                <Channel
                  channel={channel}
                  Attachment={CustomAttachment}
                  EmptyStateIndicator={renderEmptyState}
                  TypingIndicator={renderTypingIndicator}
                  myMessageTheme={myMessageTheme}>
                  <MessageList
                    onThreadSelect={threadMessage => {
                      if (threadMessage?.id) {
                        console.log(
                          '[Chat] Thread selected:',
                          threadMessage.id,
                        );
                      }
                    }}
                  />
                  <MessageInput />
                </Channel>
              </Chat>
            </OverlayProvider>
          </View>
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createHeaderStyles = (theme: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['3'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.hairline,
    },
    backButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: theme.spacing['11'],
      height: theme.spacing['11'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.avatarVioletBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.avatarVioletInk,
    },
    presenceDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 11,
      height: 11,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
      borderWidth: 2,
      borderColor: theme.colors.screen,
    },
    titleBlock: {
      flex: 1,
    },
    name: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.ink,
    },
    subtitle: {
      ...theme.typography.caption,
      color: theme.colors.inkFaint,
    },
    typingStatus: {
      ...theme.typography.captionBold,
      color: theme.colors.blueText,
    },
  });

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentWrapper: {
      flex: 1,
    },
    chatWrapper: {
      flex: 1,
      paddingBottom: theme.spacing['6'],
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['5'],
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    errorSubtext: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default ChatChannelScreen;
