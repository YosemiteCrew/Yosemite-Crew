import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {RowButton} from '@/shared/components/common/RowButton';
import {Separator} from '@/shared/components/common/Separator';

export interface AERInfoRow {
  label: string;
  value: string;
  onPress?: () => void;
}

interface Props {
  title: string;
  rows: AERInfoRow[];
  onEdit?: () => void;
}

export const AERInfoSection: React.FC<Props> = ({title, rows, onEdit}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onEdit ? (
          <PressableOpacity
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}>
            <Image source={Images.blackEdit} style={styles.editIcon} />
          </PressableOpacity>
        ) : null}
      </View>

      <LiquidGlassCard
        glassEffect="clear"
        interactive
        style={styles.infoCard}
        fallbackStyle={styles.infoCardFallback}>
        <View style={styles.cardContent}>
          {rows.map((row, idx) => (
            <View key={`${row.label}-${row.value}`}>
              <RowButton
                label={row.label}
                value={row.value}
                onPress={row.onPress || (() => {})}
              />
              {idx < rows.length - 1 ? <Separator /> : null}
            </View>
          ))}
        </View>
      </LiquidGlassCard>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing['4'],
    },
    sectionTitle: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginHorizontal: theme.spacing['2'],
      flex: 1,
    },
    infoCard: {
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen,
      marginBottom: theme.spacing['6'],
      ...theme.shadows.card,
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.screen,
    },
    cardContent: {
      paddingVertical: 0,
    },
    editIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      marginHorizontal: theme.spacing['2'],
      tintColor: theme.colors.inkMuted,
    },
  });

export default AERInfoSection;
