import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {View, Image, Text, StyleSheet} from 'react-native';
import {GenericSelectBottomSheet, type SelectItem} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface CalendarSyncBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CalendarSyncBottomSheetProps {
  selectedProvider?: 'google' | 'icloud' | null;
  onSelect: (provider: 'google' | 'icloud') => void;
}

type CalendarProvider = {
  id: 'google' | 'icloud';
  name: string;
  icon: any;
  status?: 'available' | 'connecting';
};

export const CalendarSyncBottomSheet = forwardRef<
  CalendarSyncBottomSheetRef,
  CalendarSyncBottomSheetProps
>(({selectedProvider, onSelect}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<any>(null);

  const providers: CalendarProvider[] = useMemo(() => [
    {
      id: 'google',
      name: 'Google Calendar',
      icon: Images.googleCalendarIcon || Images.calendarIcon,
      status: 'available',
    },
    {
      id: 'icloud',
      name: 'iCloud Calendar',
      icon: Images.iCloudCalendarIcon || Images.calendarIcon,
      status: 'connecting',
    },
  ], []);

  const providerItems: SelectItem[] = useMemo(() =>
    providers.map(provider => ({
      id: provider.id,
      label: provider.name,
      icon: provider.icon,
      status: provider.status,
    })), [providers]
  );

  const selectedItem = selectedProvider ? {
    id: selectedProvider,
    label: providers.find(p => p.id === selectedProvider)?.name || 'Unknown',
    icon: providers.find(p => p.id === selectedProvider)?.icon,
  } : null;

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSelect(item.id as 'google' | 'icloud');
    }
  };

  const renderProviderItem = (item: SelectItem, isSelected: boolean) => {
    const containerStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: isSelected ? theme.colors.lightBlueBackground : 'transparent',
      borderRadius: 8,
    };

    const iconStyle = {width: 24, height: 24, resizeMode: 'contain' as const};
    const nameTextStyle = {
      color: isSelected ? theme.colors.primary : theme.colors.secondary,
      fontWeight: isSelected ? '600' as const : '500' as const,
      fontSize: 16,
    };
    const statusTextStyle = {
      color: theme.colors.primary,
      fontStyle: 'italic' as const,
      fontSize: 12,
      marginTop: 2,
    };
    const checkmarkContainerStyle = {
      width: 20,
      height: 20,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const checkmarkTextStyle = {color: 'white', fontSize: 12, fontWeight: '700' as const};

    return (
      <View style={containerStyle}>
        {item.icon && (
          <Image source={item.icon} style={iconStyle} />
        )}
        <View style={styles.flexOne}>
          <Text style={nameTextStyle}>
            {item.label}
          </Text>
          {item.status === 'connecting' && (
            <Text style={statusTextStyle}>
              Connecting...
            </Text>
          )}
        </View>
        {isSelected && (
          <View style={checkmarkContainerStyle}>
            <Text style={checkmarkTextStyle}>✓</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Sync with your calendar"
      items={providerItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      renderItem={renderProviderItem}
      snapPoints={['30%', '40%']}
      emptyMessage="No calendar providers available"
    />
  );
});

CalendarSyncBottomSheet.displayName = 'CalendarSyncBottomSheet';

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
});

export default CalendarSyncBottomSheet;
