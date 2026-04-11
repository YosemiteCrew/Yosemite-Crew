import React, {forwardRef, useImperativeHandle, useRef, useMemo, useState, useEffect} from 'react';
import {View, Image, Text, StyleSheet, Platform} from 'react-native';
import RNCalendarEvents from 'react-native-calendar-events';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface CalendarSyncBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CalendarSyncBottomSheetProps {
  selectedProvider?: string | null;
  onSelect: (providerId: string, providerName: string) => void;
  onSheetChange?: (index: number) => void;
  onCalendarsLoaded?: (calendars: CalendarProvider[]) => void;
}

export type CalendarProvider = {
  id: string;
  name: string;
  icon: any;
  status?: 'available' | 'connecting';
  sourceType?: string;
};

const determineCalendarIcon = (source: string, title: string) => {
  const sourceLower = source?.toLowerCase() || '';
  const titleLower = title?.toLowerCase() || '';

  if (sourceLower.includes('google') || titleLower.includes('google')) {
    return Images.googleCalendarIcon || Images.calendarIcon;
  }
  if (sourceLower.includes('icloud') || sourceLower.includes('apple') || titleLower.includes('icloud')) {
    return Images.iCloudCalendarIcon || Images.calendarIcon;
  }
  return Images.calendarIcon;
};

const isProviderSupportedOnPlatform = (source: string) => {
  const sourceLower = source?.toLowerCase?.() || '';

  if (Platform.OS === 'ios') {
    return !sourceLower.includes('google'); // Hide Google calendars on iOS
  }

  return !sourceLower.includes('icloud') && !sourceLower.includes('apple'); // Hide iCloud/Apple calendars on Android
};

export const CalendarSyncBottomSheet = forwardRef<
  CalendarSyncBottomSheetRef,
  CalendarSyncBottomSheetProps
>(({selectedProvider, onSelect, onSheetChange, onCalendarsLoaded}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<any>(null);
  const [availableCalendars, setAvailableCalendars] = useState<CalendarProvider[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [loading, setLoading] = useState(true);
  const permissionGranted = permissionStatus === 'authorized';

  useEffect(() => {
    const fetchDeviceCalendars = async () => {
      try {
        setLoading(true);

        const status = await RNCalendarEvents.checkPermissions();
        const resolvedStatus =
          status === 'authorized'
            ? status
            : await RNCalendarEvents.requestPermissions().catch(() => status);

        setPermissionStatus(resolvedStatus);

        if (resolvedStatus !== 'authorized') {
          setAvailableCalendars([]);
          setLoading(false);
          return;
        }

        const calendars = await RNCalendarEvents.findCalendars();
        const writableCalendars = calendars
          .filter(cal => cal.allowsModifications)
          .filter(cal => isProviderSupportedOnPlatform(cal.source || ''));

        const providers: CalendarProvider[] = writableCalendars.map(cal => ({
          id: cal.id,
          name: cal.title,
          icon: determineCalendarIcon(cal.source, cal.title),
          status: 'available',
          sourceType: cal.source,
        }));

        // If no platform-appropriate calendars are writable, fall back to safe defaults
        const calendarsToSet = providers.length > 0 ? providers : [];
        setAvailableCalendars(calendarsToSet);
        onCalendarsLoaded?.(calendarsToSet);
      } catch (error) {
        console.warn('[CalendarSync] Failed to fetch calendars:', error);
        setAvailableCalendars([]);
        onCalendarsLoaded?.([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceCalendars();
  }, [onCalendarsLoaded]);

  const providerItems: SelectItem[] = useMemo(() => {
    if (loading) {
      return [{
        id: 'loading',
        label: 'Loading calendars...',
        icon: Images.calendarIcon,
        status: 'connecting',
      }];
    }

    return availableCalendars.map(provider => ({
      id: provider.id,
      label: provider.name,
      icon: provider.icon,
      status: provider.status,
    }));
  }, [availableCalendars, loading]);

  const selectedItem = selectedProvider ? {
    id: selectedProvider,
    label: availableCalendars.find(p => p.id === selectedProvider)?.name || 'Unknown',
    icon: availableCalendars.find(p => p.id === selectedProvider)?.icon,
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
    if (item && item.id !== 'loading') {
      const selectedCal = availableCalendars.find(p => p.id === item.id);
      onSelect(item.id, selectedCal?.name || item.label);
    }
  };

  const renderProviderItem = (item: SelectItem, isSelected: boolean) => {
    const containerStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing['3'],
      flex: 1,
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: isSelected ? theme.colors.lightBlueBackground : 'transparent',
      borderRadius: theme.borderRadius.sm,
    };

    const iconStyle = {width: 24, height: 24, resizeMode: 'contain' as const};
    const nameTextStyle = {
      ...theme.typography.bodyMedium,
      color: isSelected ? theme.colors.primary : theme.colors.secondary,
      fontWeight: isSelected ? '600' as const : '500' as const,
    };
    const statusTextStyle = {
      ...theme.typography.labelSmall,
      color: theme.colors.primary,
      fontStyle: 'italic' as const,
      marginTop: theme.spacing['1'],
    };
    const checkmarkContainerStyle = {
      width: 20,
      height: 20,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const checkmarkTextStyle = {...theme.typography.labelSmall, color: theme.colors.white, fontWeight: '700' as const};

    return (
      <View style={containerStyle}>
        {item.icon && (
          <Image
            testID="calendar-provider-icon"
            source={item.icon}
            style={iconStyle}
          />
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

  const getEmptyMessage = () => {
    if (loading) {
      return 'Loading calendars...';
    }
    if (permissionGranted) {
      return 'No writable calendars found';
    }
    return 'Enable calendar permission to pick a calendar';
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
      snapPoints={['50%', '60%']}
      emptyMessage={getEmptyMessage()}
      onSheetChange={onSheetChange}
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
