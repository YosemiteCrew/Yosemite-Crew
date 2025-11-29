import React, {useMemo, useRef, useEffect, useState} from 'react';
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
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const itemLayouts = useRef<Record<NotificationCategory, {x: number; width: number}>>({} as any);
  const currentScrollX = useRef(0);
  const mounted = useRef(false);

  // Center the selected pill whenever selection or layout changes
  useEffect(() => {
    const layout = itemLayouts.current[selectedFilter];
    if (!layout || containerWidth === 0) return;

    const targetX = Math.max(0, layout.x - (containerWidth / 2 - layout.width / 2));

    // Defer to next frames to avoid initial jump; avoids deprecated InteractionManager signature
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dx = Math.abs(targetX - currentScrollX.current);
        if (dx > 4) {
          scrollRef.current?.scrollTo({x: targetX, animated: true});
          currentScrollX.current = targetX;
        }
      });
    });

    mounted.current = true;
  }, [selectedFilter, containerWidth]);

  return (
    <View
      style={styles.container}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && containerWidth === 0) setContainerWidth(w);
      }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={scrollRef}
        onScroll={e => {
          currentScrollX.current = e.nativeEvent.contentOffset.x;
        }}
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
            ]}
            onLayout={e => {
              itemLayouts.current[option.id] = {
                x: e.nativeEvent.layout.x,
                width: e.nativeEvent.layout.width,
              };
            }}>
            <Text
              style={[
                styles.pillText,
                selectedFilter === option.id && styles.pillTextActive,
              ]}>
              {option.label}
            </Text>
            {(unreadCounts[option.id] ?? 0) > 0 ? (
              <View
                style={[
                  styles.badge,
                  selectedFilter === option.id && styles.badgeActive,
                ]}>
                <Text style={styles.badgeText}>
                  {unreadCounts[option.id]! > 9 ? '9+' : unreadCounts[option.id]}
                </Text>
              </View>
            ) : null}
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
      backgroundColor: theme.colors.lightBlueBackground,
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
