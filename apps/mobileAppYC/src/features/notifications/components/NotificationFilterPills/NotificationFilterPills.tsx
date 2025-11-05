import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks';
import type {NotificationCategory} from '../../types';

interface NotificationFilterPillsProps {
  selectedFilter: NotificationCategory;
  onFilterChange: (filter: NotificationCategory) => void;
  unreadCounts?: Partial<Record<NotificationCategory, number>>;
}

const FILTER_OPTIONS: Array<{id: NotificationCategory; label: string}> = [
  {id: 'all', label: 'All'},
  {id: 'messages', label: 'Messages'},
  {id: 'appointments', label: 'Appointments'},
  {id: 'tasks', label: 'Tasks'},
  {id: 'documents', label: 'Documents'},
  {id: 'health', label: 'Health'},
  {id: 'dietary', label: 'Dietary'},
  {id: 'hygiene', label: 'Hygiene'},
  {id: 'payment', label: 'Payment'},
];

export const NotificationFilterPills: React.FC<NotificationFilterPillsProps> = ({
  selectedFilter,
  onFilterChange,
  unreadCounts = {},
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}>
        {FILTER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.id}
            onPress={() => onFilterChange(option.id)}
            activeOpacity={0.8}
            style={[
              styles.pill,
              selectedFilter === option.id && styles.pillActive,
            ]}>
            <Text
              style={[
                styles.pillText,
                selectedFilter === option.id && styles.pillTextActive,
              ]}>
              {option.label}
            </Text>
            {unreadCounts[option.id] && unreadCounts[option.id]! > 0 && (
              <View
                style={[
                  styles.badge,
                  selectedFilter === option.id && styles.badgeActive,
                ]}>
                <Text style={styles.badgeText}>
                  {unreadCounts[option.id]! > 9 ? '9+' : unreadCounts[option.id]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing[1],
    },
    content: {
      gap: 8,
      paddingRight: 8,
    },
    pill: {
      minWidth: 80,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#302F2E',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    pillActive: {
      backgroundColor: theme.colors.primaryTint,
      borderColor: theme.colors.primary,
    },
    pillText: {
      ...theme.typography.labelSmallBold,
      color: '#302F2E',
      fontSize: 13,
    },
    pillTextActive: {
      color: theme.colors.primary,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#302F2E',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    badgeActive: {
      backgroundColor: theme.colors.primary,
    },
    badgeText: {
      ...theme.typography.labelXs,
      color: theme.colors.white,
      fontWeight: '700',
      fontSize: 10,
    },
  });
