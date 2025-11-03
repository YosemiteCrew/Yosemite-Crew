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
  segments: TextSegment[] | undefined,
  styles: ReturnType<typeof createStyles>,
  isCenter = false,
) => {
  if (!Array.isArray(segments)) return null;

  return (
    <Text style={[styles.paragraphText, isCenter ? styles.paragraphTextCenter : undefined]}>
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
};

const renderOrderedListItems = (
  items: OrderedListItem[] | undefined,
  styles: ReturnType<typeof createStyles>,
  isCenter = false,
) => {
  if (!Array.isArray(items)) return null;

  return (
    <View style={styles.listContainer}>
      {items.map(item => (
        <View key={`${item.marker}-${(item.segments || []).map(s => s.text).join('-')}`} style={styles.listRow}>
          <Text
            style={[
              styles.listMarker,
              item.markerBold && styles.boldText,
            ]}>
            {item.marker}
          </Text>
          <View style={styles.listContent}>{renderSegments(item.segments, styles, isCenter)}</View>
        </View>
      ))}
    </View>
  );
};

const renderBlock = (
  block: LegalContentBlock,
  styles: ReturnType<typeof createStyles>,
  isCenter = false,
) => {
  if (block.type === 'paragraph') {
    const key = Array.isArray(block.segments) ? block.segments.map(segment => segment.text).join('-') : 'paragraph';
    return (
      <View key={key} style={styles.paragraph}>
        {renderSegments(block.segments, styles, isCenter)}
      </View>
    );
  }

  if (block.type === 'ordered-list') {
    const key = Array.isArray(block.items) ? block.items.map(item => item.marker).join('-') : 'ordered-list';
    return (
      <View key={key} style={styles.paragraph}>
        {renderOrderedListItems(block.items, styles, isCenter)}
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
  const safeSections = Array.isArray(sections) ? sections : [];
  if (__DEV__) {
    try {
      console.log('LegalContentRenderer: sections length=', safeSections.length, 'firstTitle=', safeSections[0]?.title);
    } catch {
      /* ignore */
    }
  }
  return (
    <View style={styles.container}>
      {safeSections.length > 0 && safeSections
        // filter out empty sections (no title and no non-empty blocks)
        .filter(section => {
          const hasTitle = typeof section.title === 'string' && section.title.trim().length > 0;
          const hasBlocks = Array.isArray(section.blocks) && section.blocks.some(b => {
            if (b.type === 'paragraph') return Array.isArray(b.segments) && b.segments.some(s => typeof s.text === 'string' && s.text.trim().length > 0);
            if (b.type === 'ordered-list') return Array.isArray(b.items) && b.items.length > 0;
            return false;
          });
          return hasTitle || hasBlocks;
        })
        .map(section => {
          const isCenter = section.align === 'center';
          return (
            <LiquidGlassCard
              key={section.id}
              glassEffect="regular"
              interactive
              style={[styles.sectionCard, isCenter && styles.sectionCardCenter]}
              fallbackStyle={styles.cardFallback}>
              {section.title ? <Text style={[styles.sectionTitle, isCenter && styles.sectionTitleCenter]}>{section.title}</Text> : null}
              <View style={styles.sectionContent}>
                {Array.isArray(section.blocks) ? section.blocks.map(block => renderBlock(block, styles, isCenter)).filter(Boolean) : null}
              </View>
            </LiquidGlassCard>
          );
        })}
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
      // Subtitle Bold 14
      fontFamily: theme.typography.subtitleBold14?.fontFamily || theme.typography.SATOSHI_BOLD,
      fontSize: theme.typography.subtitleBold14?.fontSize || 14,
      lineHeight: theme.typography.subtitleBold14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleBold14?.fontWeight || '700',
      color: theme.colors.text,
    },
    sectionTitleCenter: {
      textAlign: 'center',
    },
    sectionContent: {
      gap: theme.spacing['2'],
    },
    paragraph: {
      gap: theme.spacing['1'],
    },
    paragraphText: {
      // Subtitle Regular 14
      fontFamily: theme.typography.subtitleRegular14?.fontFamily || theme.typography.SATOSHI_REGULAR,
      fontSize: theme.typography.subtitleRegular14?.fontSize || 14,
      lineHeight: theme.typography.subtitleRegular14?.lineHeight || 14 * 1.2,
      fontWeight: theme.typography.subtitleRegular14?.fontWeight || '400',
      color: theme.colors.text,
    },
    paragraphTextCenter: {
      textAlign: 'center',
    },
    sectionCardCenter: {
      alignItems: 'center',
    },
    boldText: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontWeight: theme.typography.paragraphBold.fontWeight,
    },
    underlineText: {
      textDecorationLine: 'underline',
    },
    listContainer: {
      gap: theme.spacing['1'],
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['1'],
    },
    listMarker: {
      ...theme.typography.labelSmall,
      color: theme.colors.text,
      minWidth: 18,
      marginRight: 4,
    },
    listContent: {
      flex: 1,
    },
  });

export default LegalContentRenderer;
