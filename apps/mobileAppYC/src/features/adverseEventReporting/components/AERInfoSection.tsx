import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {RowButton, Separator} from '@/shared/components/common/FormRowComponents';

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
          <TouchableOpacity onPress={onEdit}>
            <Image source={Images.blackEdit} style={styles.editIcon} />
          </TouchableOpacity>
        ) : null}
      </View>

      <LiquidGlassCard
        glassEffect="clear"
        interactive
        style={styles.infoCard}
        fallbackStyle={styles.infoCardFallback}>
        <View style={styles.cardContent}>
          {rows.map((row, idx) => (
            <View key={`${row.label}-${idx}`}>
              <RowButton label={row.label} value={row.value} onPress={row.onPress || (() => {})} />
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
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginHorizontal: theme.spacing['2'],
    },
    infoCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing['6'],
      ...theme.shadows.sm,
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
    },
    cardContent: {
      paddingVertical: 0,
    },
    editIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      marginHorizontal: theme.spacing['2'],
    },
  });

export default AERInfoSection;
