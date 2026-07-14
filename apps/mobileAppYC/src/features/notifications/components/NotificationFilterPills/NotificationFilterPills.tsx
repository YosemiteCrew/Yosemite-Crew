import React, {useCallback, useMemo, useRef, useEffect} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {NotificationCategory} from '../../types';

interface NotificationFilterPillsProps {
  selectedFilter: NotificationCategory;
  onFilterChange: (filter: NotificationCategory) => void;
  unreadCounts?: Partial<Record<NotificationCategory, number>>;
}

const EMPTY_UNREAD_COUNTS: Partial<Record<NotificationCategory, number>> = {};

const FILTER_OPTIONS: Array<{id: NotificationCategory; label: string}> = [
  {id: 'all', label: 'All'},
  {id: 'appointments', label: 'Appointments'},
  {id: 'payment', label: 'Payments'},
  {id: 'health', label: 'Care & Health'},
  {id: 'messages', label: 'Messages / OTP'},
  {id: 'tasks', label: 'Tasks'},
  {id: 'documents', label: 'Documents'},
];

export const NotificationFilterPills: React.FC<
  NotificationFilterPillsProps
> = ({selectedFilter, onFilterChange, unreadCounts = EMPTY_UNREAD_COUNTS}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const containerWidthRef = useRef(0);
  const itemLayouts = useRef<
    Record<NotificationCategory, {x: number; width: number}>
  >({} as any);
  const currentScrollX = useRef(0);

  const centerSelectedPill = useCallback((filter: NotificationCategory) => {
    const layout = itemLayouts.current[filter];
    const containerWidth = containerWidthRef.current;
    if (!layout || containerWidth === 0) {
      return;
    }

    const targetX = Math.max(
      0,
      layout.x - (containerWidth / 2 - layout.width / 2),
    );

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
  }, []);

  // Center the selected pill whenever selection changes after layout is known.
  useEffect(() => {
    centerSelectedPill(selectedFilter);
  }, [centerSelectedPill, selectedFilter]);

  return (
    <View
      style={styles.container}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && containerWidthRef.current !== w) {
          containerWidthRef.current = w;
          centerSelectedPill(selectedFilter);
        }
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
        <View style={styles.contentRow}>
          {FILTER_OPTIONS.map(option => (
            <PressableOpacity
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
                if (option.id === selectedFilter) {
                  centerSelectedPill(option.id);
                }
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
                    {unreadCounts[option.id]! > 9
                      ? '9+'
                      : unreadCounts[option.id]}
                  </Text>
                </View>
              ) : null}
            </PressableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing['1'],
    },
    content: {
      paddingRight: theme.spacing['2'],
    },
    contentRow: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
    },
    pill: {
      minWidth: theme.spacing['20'],
      height: theme.spacing['9'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing['1.25'],
    },
    pillActive: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    pillText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
    },
    pillTextActive: {
      color: theme.colors.primary,
    },
    badge: {
      minWidth: theme.spacing['5'],
      height: theme.spacing['5'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['1'],
    },
    badgeActive: {
      backgroundColor: theme.colors.primary,
    },
    badgeText: {
      ...theme.typography.labelXs,
      color: theme.colors.white,
      fontWeight: '700',
    },
  });
