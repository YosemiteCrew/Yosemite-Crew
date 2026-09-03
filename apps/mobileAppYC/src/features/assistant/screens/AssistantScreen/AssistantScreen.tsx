import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import {useAppDispatch, useAppSelector} from '@/app/hooks';
import type {Theme} from '@/theme';
import type {HomeStackParamList, RootStackParamList} from '@/navigation/types';
import type {AssistantMessage} from '@/features/assistant/types';
import {
  ActionResultCard,
  AssistantComposer,
  MessageBubble,
  ModelStatusBanner,
  SuggestionChips,
} from '@/features/assistant/components';
import {
  selectAssistantError,
  selectAssistantMessages,
  selectAssistantStatus,
  selectModelAvailability,
} from '@/features/assistant/selectors';
import {askAssistant, probeOnDeviceModel} from '@/features/assistant/thunks';
import {transcriptCleared} from '@/features/assistant/assistantSlice';
import {resolveHandoffTarget} from '@/features/assistant/services/handoffNavigation';
import {useResolvedUserCurrency} from '@/shared/hooks/useResolvedUserCurrency';

type Navigation = NativeStackNavigationProp<HomeStackParamList, 'Assistant'>;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {flex: 1, backgroundColor: theme.colors.background},
    flex: {flex: 1},
    list: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['4'],
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['6'],
      gap: theme.spacing['2'],
    },
    emptyTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    error: {
      ...theme.typography.labelSmall,
      color: theme.colors.dangerText,
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['2'],
    },
  });

export const AssistantScreen: React.FC = () => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Navigation>();
  // A second view of the same navigation object, typed for the root stack:
  // `navigate` walks up until it finds the navigator owning the route.
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The screen renders with the navigator header hidden, so it owns its own
  // insets: without them the title sits under the notch and the composer sits
  // on the home indicator.
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const [draft, setDraft] = useState('');

  const messages = useAppSelector(selectAssistantMessages);
  const status = useAppSelector(selectAssistantStatus);
  const error = useAppSelector(selectAssistantError);
  const availability = useAppSelector(selectModelAvailability);
  const currencyCode = useResolvedUserCurrency();

  useEffect(() => {
    dispatch(probeOnDeviceModel());
  }, [dispatch]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({animated: true});
    }
  }, [messages.length]);

  const handleSubmit = useCallback(
    (text: string) => {
      setDraft('');
      dispatch(askAssistant({utterance: text, t, currencyCode}));
    },
    [currencyCode, dispatch, t],
  );

  const handleOpen = useCallback(
    (deepLink: string) => {
      const target = resolveHandoffTarget(deepLink);
      if (!target) {
        return;
      }
      // Addressed to the navigator that owns 'Main', which is the root stack.
      // `getParent()` here is the tab navigator, which has no such route, so
      // naming it as the target only worked by accident of bubbling.
      //
      // The cast is unavoidable: a handoff target names a screen in whichever
      // stack owns it, so it is a plain string rather than a key of any one
      // param list. `resolveHandoffTarget` is the thing that guarantees the
      // pair is real, and it is exhaustively tested.
      rootNavigation.navigate('Main', {
        screen: target.tab,
        params: target.nested
          ? {screen: target.screen, params: target.nested}
          : {screen: target.screen, params: target.params},
      } as never);
    },
    [rootNavigation],
  );

  const renderItem = useCallback(
    ({item}: {item: AssistantMessage}) => (
      <View>
        <MessageBubble message={item} />
        {item.result ? (
          <ActionResultCard result={item.result} onOpen={handleOpen} />
        ) : null}
      </View>
    ),
    [handleOpen],
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.empty} testID="assistant-empty">
        <Text style={styles.emptyTitle}>{t('assistant.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('assistant.emptyBody')}</Text>
      </View>
    ),
    [styles, t],
  );

  return (
    <View style={[styles.screen, {paddingTop: insets.top}]}>
      <Header
        title={t('assistant.title')}
        showBackButton
        onBack={() => navigation.goBack()}
        // Header only renders its right slot when it has an icon, so passing
        // just onRightPress left the clear action invisible.
        rightIcon={messages.length > 0 ? Images.closeIcon : undefined}
        rightAccessibilityLabel={t('assistant.clear')}
        onRightPress={() => dispatch(transcriptCleared())}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          testID="assistant-transcript"
          // Without flex the list sizes to its content and overflows its slot,
          // which let the newest reply render underneath the suggestion chips.
          style={styles.flex}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={listEmpty}
          keyboardShouldPersistTaps="handled"
        />
        <ModelStatusBanner availability={availability} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SuggestionChips onSelect={setDraft} />
        <View style={{paddingBottom: insets.bottom}}>
          <AssistantComposer
            value={draft}
            onChangeText={setDraft}
            onSubmit={handleSubmit}
            busy={status === 'thinking'}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
