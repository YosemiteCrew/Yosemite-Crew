import React, {useMemo, useState} from 'react';
import {FlatList, View, Text, StyleSheet, TextInput, TouchableOpacity} from 'react-native';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {useNavigation} from '@react-navigation/native';
import {nanoid} from '@reduxjs/toolkit';

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
    <SafeArea>
      <Header title="Dr. David Brown" showBackButton onBack={() => navigation.goBack()} />
      <FlatList
        contentContainerStyle={styles.list}
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
        <TextInput style={styles.input} placeholder="Type a message" value={text} onChangeText={setText} />
        <TouchableOpacity style={styles.send} onPress={send}><Text style={styles.sendText}>→</Text></TouchableOpacity>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  list: {padding: 16, gap: 8},
  bubble: {maxWidth: '80%', padding: 12, borderRadius: 14, marginVertical: 6},
  you: {alignSelf: 'flex-end', backgroundColor: '#E6F0FE'},
  vet: {alignSelf: 'flex-start', backgroundColor: '#F0F0F0'},
  text: {...theme.typography.bodySmall, color: theme.colors.secondary},
  time: {...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 4},
  composer: {flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderColor: theme.colors.border},
  input: {flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground},
  send: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.colors.secondary},
  sendText: {...theme.typography.buttonSmall, color: theme.colors.white},
});

export default ChatScreen;
