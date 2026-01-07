import React from 'react';
import {SearchDropdownWithBackdrop} from '@/shared/components/common/SearchDropdownOverlay/SearchDropdownWithBackdrop';
import type {BusinessSearchResult} from '../types';

type Props = {
  visible: boolean;
  top?: number;
  items: ReadonlyArray<BusinessSearchResult>;
  onSelect: (item: BusinessSearchResult) => void;
  onDismiss: () => void;
  maxHeight?: number;
};

export const BusinessSearchDropdown: React.FC<Props> = ({
  visible,
  top,
  items,
  onSelect,
  onDismiss,
  maxHeight,
}) => (
  <SearchDropdownWithBackdrop
    visible={visible}
    top={top}
    items={items}
    keyExtractor={item => item.id}
    onPress={onSelect}
    title={item => item.name}
    subtitle={item => item.address}
    initials={item => item.name}
    useGlassCard
    glassEffect="regular"
    onDismiss={onDismiss}
    maxHeight={maxHeight}
  />
);

export default BusinessSearchDropdown;
