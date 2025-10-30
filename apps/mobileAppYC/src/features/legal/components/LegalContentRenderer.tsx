import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import type {
  LegalSection,
  LegalContentBlock,
  TextSegment,
  OrderedListItem,
} from '../data/legalContentTypes';

interface LegalContentRendererProps {
  sections: LegalSection[];
}

const renderSegments = (
  segments: TextSegment[],
  styles: ReturnType<typeof createStyles>,
) => (
  <Text style={styles.paragraphText}>
    {segments.map((segment, index) => (
      <Text
        key={`${segment.text}-${index}`}
        style={[
          segment.bold && styles.boldText,
          segment.underline && styles.underlineText,
        ]}>
        {segment.text}
      </Text>
    ))}
  </Text>
);

const renderOrderedListItems = (
  items: OrderedListItem[],
  styles: ReturnType<typeof createStyles>,
) => (
  <View style={styles.listContainer}>
    {items.map(item => (
      <View key={`${item.marker}-${item.segments.map(s => s.text).join('-')}`} style={styles.listRow}>
        <Text
          style={[
            styles.listMarker,
            item.markerBold && styles.boldText,
          ]}>
          {item.marker}
        </Text>
        <View style={styles.listContent}>{renderSegments(item.segments, styles)}</View>
      </View>
    ))}
  </View>
);

const renderBlock = (
  block: LegalContentBlock,
  styles: ReturnType<typeof createStyles>,
) => {
  if (block.type === 'paragraph') {
    return (
      <View key={block.segments.map(segment => segment.text).join('-')} style={styles.paragraph}>
        {renderSegments(block.segments, styles)}
      </View>
    );
  }

  if (block.type === 'ordered-list') {
    return (
      <View key={block.items.map(item => item.marker).join('-')} style={styles.paragraph}>
        {renderOrderedListItems(block.items, styles)}
      </View>
    );
  }

  return null;
};

export const LegalContentRenderer: React.FC<LegalContentRendererProps> = ({
  sections,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {sections.map(section => (
        <LiquidGlassCard
          key={section.id}
          glassEffect="regular"
          interactive
          style={styles.sectionCard}
          fallbackStyle={styles.cardFallback}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.blocks.map(block => renderBlock(block, styles))}
          </View>
        </LiquidGlassCard>
      ))}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
    },
    sectionCard: {
      gap: theme.spacing['3'],
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    sectionTitle: {
      ...theme.typography.h6,
      color: theme.colors.secondary,
    },
    sectionContent: {
      gap: theme.spacing['2'],
    },
    paragraph: {
      gap: theme.spacing['1'],
    },
    paragraphText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    boldText: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontWeight: theme.typography.paragraphBold.fontWeight,
    },
    underlineText: {
      textDecorationLine: 'underline',
    },
    listContainer: {
      gap: theme.spacing['2'],
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2'],
    },
    listMarker: {
      ...theme.typography.labelSmall,
      color: theme.colors.text,
      minWidth: 24,
    },
    listContent: {
      flex: 1,
    },
  });

export default LegalContentRenderer;
