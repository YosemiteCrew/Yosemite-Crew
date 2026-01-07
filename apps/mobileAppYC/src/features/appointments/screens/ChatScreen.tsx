import React, {useMemo, useState} from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {useNavigation} from '@react-navigation/native';
import {nanoid} from '@reduxjs/toolkit';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Message = { id: string; sender: 'you' | 'vet'; text: string; time: string };

const initialMessages: Message[] = [
  {id: 'm1', sender: 'you', text: "Hi Dr., Kizie's been limping slightly on her right leg.", time: '16:46'},
  {id: 'm2', sender: 'vet', text: 'Thanks for letting me know. Has she had any recent injuries?', time: '16:47'},
  {id: 'm3', sender: 'you', text: "No injuries; we went on hikes last week. She's more tired than usual.", time: '16:50'},
];

export const ChatScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {id: nanoid(), sender: 'you', text, time: 'now'}]);
    setText('');
  };

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Dr. David Brown"
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['1']}>
      {contentPaddingStyle => (
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <FlatList
            contentContainerStyle={[styles.list, contentPaddingStyle]}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({item}) => (
              <View style={[styles.bubble, item.sender === 'you' ? styles.you : styles.vet]}>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
            )}
          />
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message"
              value={text}
              onChangeText={setText}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <TouchableOpacity style={styles.send} onPress={send}><Text style={styles.sendText}>→</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  keyboardAvoiding: {flex: 1},
  list: {padding: theme.spacing['4'], gap: theme.spacing['2'], paddingBottom: theme.spacing['10']},
  bubble: {maxWidth: '80%', padding: theme.spacing['3'], borderRadius: theme.borderRadius.md, marginVertical: theme.spacing['2']},
  you: {alignSelf: 'flex-end', backgroundColor: theme.colors.lightBlueBackground},
  vet: {alignSelf: 'flex-start', backgroundColor: theme.colors.surface},
  text: {...theme.typography.bodySmall, color: theme.colors.secondary},
  time: {...theme.typography.caption, color: theme.colors.textSecondary, marginTop: theme.spacing['1']},
  composer: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing['2'], padding: theme.spacing['3'], borderTopWidth: 1, borderColor: theme.colors.border},
  input: {flex: 1, paddingVertical: theme.spacing['2.5'], paddingHorizontal: theme.spacing['3'], borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground},
  send: {paddingHorizontal: theme.spacing['4'], paddingVertical: theme.spacing['2.5'], borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.secondary},
  sendText: {...theme.typography.buttonSmall, color: theme.colors.white},
});

export default ChatScreen;
