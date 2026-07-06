import React, {useRef, useEffect} from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks';
import {useLazyRef} from '@/shared/hooks/useLazyRef';

export interface FilterOption<T> {
  readonly id: T;
  readonly label: string;
}

interface FilterPillsProps<T> {
  readonly options: readonly FilterOption<T>[];
  readonly selected: T;
  readonly onSelect: (id: T) => void;
  readonly containerStyle?: object;
}

export function FilterPills<T>({
  options,
  selected,
  onSelect,
  containerStyle,
}: Readonly<FilterPillsProps<T>>) {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView | null>(null);
  const pillRefs = useLazyRef(() => new Map<string, View>());

  useEffect(() => {
    const selectedKey = String(selected ?? 'default');
    const pillView = pillRefs.current.get(selectedKey);
    if (pillView && scrollRef.current) {
      pillView.measureLayout(
        scrollRef.current as any,
        x => {
          scrollRef.current?.scrollTo({x: x - 20, animated: true});
        },
        () => {},
      );
    }
  }, [pillRefs, selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.pillsContent, containerStyle]}>
      <View style={styles.pillsRow}>
        {options.map(option => {
          const isActive = option.id === selected;
          const key = String(option.id ?? 'default');
          return (
            <TouchableOpacity
              key={key}
              ref={node => {
                if (node) {
                  pillRefs.current.set(key, node);
                }
              }}
              style={[styles.pill, isActive && styles.pillActive]}
              activeOpacity={0.8}
              onPress={() => onSelect(option.id)}>
              <Text
                style={[styles.pillText, isActive && styles.pillTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    pillsContent: {
      paddingRight: theme.spacing['2'],
      paddingHorizontal: theme.spacing['6'],
    },
    pillsRow: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
    },
    pill: {
      minWidth: 80,
      height: 40,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1.25'],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.text,
      backgroundColor: theme.colors.white,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pillActive: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    pillText: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.text,
    },
    pillTextActive: {
      color: theme.colors.primary,
    },
  });
