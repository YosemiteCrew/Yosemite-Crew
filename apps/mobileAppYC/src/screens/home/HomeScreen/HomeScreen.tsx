import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks';
import {HomeStackParamList} from '@/navigation/types';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '@/contexts/AuthContext';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const companions = [
  {id: '1', name: 'Kizie', meta: '3 Tasks'},
  {id: '2', name: 'Oscar', meta: '4 Tasks'},
  {id: '3', name: 'Ranger', meta: '2 Tasks'},
];

const quickActions = [
  {id: 'health', label: 'Manage health', glyph: '❤'},
  {id: 'hygiene', label: 'Hygiene maintenance', glyph: '🧴'},
  {id: 'diet', label: 'Dietary plans', glyph: '🍽'},
];

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {user} = useAuth();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const firstName = user?.firstName || 'Sky';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Account')}
            activeOpacity={0.85}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text
              style={styles.greetingName}
              numberOfLines={2}
              ellipsizeMode="tail">
              Hello, <Text style={styles.greetingNameBold}>{firstName}</Text>
            </Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionIcon} activeOpacity={0.8}>
              <Text style={styles.headerGlyphAlert}>✚</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon} activeOpacity={0.8}>
              <Text style={styles.headerGlyphPrimary}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.searchBar} activeOpacity={0.9}>
          <Text style={styles.searchGlyph}>🔍</Text>
          <Text style={styles.searchPlaceholder}>
            Search hospitals, groomers, boarders…
          </Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.companionRow}>
          {companions.map(item => (
            <View key={item.id} style={styles.companionCard}>
              <View style={styles.companionAvatar}>
                <Text style={styles.companionInitials}>
                  {item.name.charAt(0)}
                </Text>
              </View>
              <Text style={styles.companionName}>{item.name}</Text>
              <Text style={styles.companionMeta}>{item.meta}</Text>
            </View>
          ))}
          <View style={[styles.companionCard, styles.addCompanionCard]}>
            <View style={[styles.companionAvatar, styles.addCompanionAvatar]}>
              <Text style={styles.addCompanionGlyph}>＋</Text>
            </View>
            <Text style={styles.companionName}>Add companion</Text>
          </View>
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>No upcoming tasks</Text>
            <Text style={styles.placeholderSubtitle}>
              Add a companion to start managing their tasks
            </Text>
          </View>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>No upcoming appointments</Text>
            <Text style={styles.placeholderSubtitle}>
              Add a companion to start managing their appointments
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>No expenses recorded</Text>
            <Text style={styles.placeholderSubtitle}>
              Add a companion to start managing their expenses
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickRow}>
            {quickActions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickCard}
                activeOpacity={0.9}>
                <View style={styles.quickIcon}>
                  <Text style={styles.quickGlyph}>{action.glyph}</Text>
                </View>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 120,
      gap: 24,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarInitials: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    greetingName: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      textAlign: 'left',
    },
    greetingNameBold: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.xs,
    },
    headerGlyphAlert: {
      fontSize: 16,
      color: '#EA3729',
    },
    headerGlyphPrimary: {
      fontSize: 16,
      color: theme.colors.secondary,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      paddingVertical: 14,
      paddingHorizontal: 16,
      ...theme.shadows.xs,
    },
    searchGlyph: {
      fontSize: 16,
      marginRight: 12,
      color: theme.colors.textSecondary,
    },
    searchPlaceholder: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    companionRow: {
      gap: 16,
      paddingVertical: 4,
    },
    companionCard: {
      width: 92,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      alignItems: 'center',
      paddingVertical: 12,
      gap: 6,
      ...theme.shadows.xs,
    },
    companionAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companionInitials: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    companionName: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    companionMeta: {
      ...theme.typography.paragraph,
      color: theme.colors.primary,
      textAlign: 'center',
      fontSize: 12,
    },
    addCompanionCard: {
      borderStyle: 'dashed',
      borderColor: theme.colors.primary,
    },
    addCompanionAvatar: {
      backgroundColor: theme.colors.primary,
    },
    addCompanionGlyph: {
      fontSize: 18,
      color: theme.colors.white,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      ...theme.typography.screenTitle,
      color: theme.colors.secondary,
      textAlign: 'left',
    },
    placeholderCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: 20,
      gap: 6,
      ...theme.shadows.xs,
    },
    placeholderTitle: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    placeholderSubtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 12,
    },
    quickCard: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
      ...theme.shadows.xs,
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickGlyph: {
      fontSize: 18,
      color: theme.colors.white,
    },
    quickLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });
