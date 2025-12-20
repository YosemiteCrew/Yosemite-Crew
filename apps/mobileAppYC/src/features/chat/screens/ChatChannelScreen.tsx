/**
 * ChatChannelScreen
 *
 * Real-time chat screen for appointment-based conversations
 * between pet owners and veterinarians using Stream Chat.
 */

import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import {
  Channel,
  MessageList,
  Chat,
  OverlayProvider,
  MessageInput,
} from 'stream-chat-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
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
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {selectAuthUser} from '@/features/auth/selectors';
import {CustomAttachment} from '../components/CustomAttachment';
import type {TabParamList} from '@/navigation/types';

type RouteParams = {
  appointmentId: string;
  vetId: string;
  appointmentTime: string;
  doctorName: string;
  petName?: string;
};

export const ChatChannelScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const route = useRoute();
  const authUser = useSelector(selectAuthUser);
  const {appointmentId, vetId, appointmentTime, doctorName, petName} =
    route.params as RouteParams;

  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);

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
        Alert.alert('Chat unavailable', missingUserMessage, [
          {text: 'Go Back', onPress: () => navigation.goBack()},
        ]);
        return;
      }

      const displayName =
        [authUser.firstName, authUser.lastName].filter(Boolean).join(' ').trim() ||
        authUser.email ||
        'Pet Owner';
      const avatar = authUser.profilePicture ?? undefined;
      const chatUserId = authUser.parentId ?? authUser.id;

      console.log('[Chat] Connecting as user:', chatUserId);

      // 2. Connect to Stream
      const chatClient = getChatClient();
      await connectStreamUser(
        chatUserId,
        displayName,
        avatar,
      );

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
        (typeof err?.message === 'string' && err.message.length > 0
          ? err.message
          : 'Failed to load chat. Please try again.');

      if (err.message?.includes('API key')) {
        errorMessage =
          'Chat is not configured. Please contact support.';
      } else if (err.message?.includes('network')) {
        errorMessage =
          'Network error. Please check your connection and try again.';
      }

      setError(errorMessage);
      setLoading(false);

      // Show alert
      Alert.alert('Chat Error', errorMessage, [
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

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title={doctorName}
          showBackButton
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <GifLoader />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !channel || !client) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title={doctorName}
          showBackButton
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>
            {error || 'Unable to load chat'}
          </Text>
          <Text style={styles.errorSubtext}>
            {!error && 'Please check your connection and try again'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Chat UI
  return (
    <SafeAreaView style={styles.root}>
      <Header
        title={doctorName}
        showBackButton
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation
              .getParent<NavigationProp<TabParamList> | undefined>()
              ?.navigate?.('Appointments', {screen: 'MyAppointments'});
          }
        }}
      />
      <View style={styles.chatWrapper}>
        <OverlayProvider>
          <Chat client={client}>
            <Channel
              channel={channel}
              Attachment={CustomAttachment}
            >
              <MessageList
                onThreadSelect={threadMessage => {
                  if (threadMessage?.id) {
                    console.log('[Chat] Thread selected:', threadMessage.id);
                  }
                }}
              />
              <MessageInput
              />
            </Channel>
          </Chat>
        </OverlayProvider>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    // Main SafeAreaView - takes full screen including safe areas
    root: {
      flex: 1,
      backgroundColor: theme.colors.background || '#fff',
      flexDirection: 'column',
    },
    // Chat container - takes remaining space after header
    chatWrapper: {
      flex: 1,
      backgroundColor: theme.colors.background || '#fff',
    },
    // Loading/Error states
    container: {
      flex: 1,
      backgroundColor: theme.colors.background || '#fff',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['5'],
    },
    loadingText: {
      marginTop: theme.spacing['4'],
      ...theme.typography.body,
      color: theme.colors.textSecondary,
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
