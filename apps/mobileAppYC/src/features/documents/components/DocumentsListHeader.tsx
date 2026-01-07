import React from 'react';
import type {ImageSourcePropType, ViewStyle} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';

type DocumentsListHeaderProps = {
  title: string;
  searchPlaceholder: string;
  onSearchPress: () => void;
  searchContainerStyle?: ViewStyle;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: ImageSourcePropType;
  onRightPress?: () => void;
};

export const DocumentsListHeader: React.FC<DocumentsListHeaderProps> = ({
  title,
  searchPlaceholder,
  onSearchPress,
  searchContainerStyle,
  showBackButton = false,
  onBack,
  rightIcon,
  onRightPress,
}) => {
  return (
    <>
      <Header
        title={title}
        showBackButton={showBackButton}
        onBack={onBack}
        rightIcon={rightIcon}
        onRightPress={onRightPress}
        glass={false}
      />
      <SearchBar
        placeholder={searchPlaceholder}
        mode="readonly"
        onPress={onSearchPress}
        containerStyle={searchContainerStyle}
      />
    </>
  );
};
