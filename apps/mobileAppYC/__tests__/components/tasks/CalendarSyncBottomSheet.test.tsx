import React from 'react';
import {render, screen, act, waitFor} from '../../setup/testUtils';
// FIX 1: Update component import path
import {
  CalendarSyncBottomSheet,
  type CalendarSyncBottomSheetRef,
} from '@/features/tasks/components/CalendarSyncBottomSheet/CalendarSyncBottomSheet';
// FIX 3: Update type import path
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {View} from 'react-native';

// --- Mocks ---

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockImageComponent = (props: any) => (
    <MockView testID="calendar-provider-icon" {...props} />
  );
  MockImageComponent.displayName = 'Image';
  return MockImageComponent;
});

// FIX 4: Update hook mock path
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: require('../../setup/mockTheme').mockTheme, isDark: false}),
  useAppDispatch: () => jest.fn(),
  useAppSelector: jest.fn(),
}));

let mockGoogleCalendarIcon: string | undefined = 'google.png';
let mockICloudCalendarIcon: string | undefined = 'icloud.png';
let mockCalendarIcon: string | undefined = 'calendar.png';

jest.mock('@/assets/images', () => ({
  get Images() {
    return {
      googleCalendarIcon: mockGoogleCalendarIcon,
      iCloudCalendarIcon: mockICloudCalendarIcon,
      calendarIcon: mockCalendarIcon,
    };
  },
}));

// Mock react-native-calendar-events
const mockCheckPermissions = jest.fn();
const mockFindCalendars = jest.fn();

jest.mock('react-native-calendar-events', () => ({
  checkPermissions: () => mockCheckPermissions(),
  findCalendars: () => mockFindCalendars(),
}));

const mockSheetRef = {
  current: {
    open: jest.fn(),
    close: jest.fn(),
  },
};
// FIX 5: Update mocked component path
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactModule = require('react');
    const MockView = require('react-native').View;
    const MockGenericSelectBottomSheet = ReactModule.forwardRef(
      (props: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          open: mockSheetRef.current.open,
          close: mockSheetRef.current.close,
        }));
        return <MockView testID="mock-generic-sheet" {...props} />;
      },
    );
    MockGenericSelectBottomSheet.displayName = 'MockGenericSelectBottomSheet';
    return {
      GenericSelectBottomSheet: MockGenericSelectBottomSheet,
    };
  },
);

// useTheme is already mocked in @/hooks
// Redux Provider is handled by renderWithProviders from testUtils

// --- Mock Data ---

const mockDeviceCalendars = [
  {
    id: 'cal-google-1',
    title: 'My Google Calendar',
    source: 'com.google',
    allowsModifications: true,
  },
  {
    id: 'cal-icloud-1',
    title: 'My iCloud Calendar',
    source: 'com.apple.mobileme',
    allowsModifications: true,
  },
];

// Since Platform.OS defaults to 'ios' in tests, Google calendars are filtered out
const expectedDeviceCalendarItems: SelectItem[] = [
  {
    id: 'cal-icloud-1',
    label: 'My iCloud Calendar',
    icon: 'icloud.png',
    status: 'available',
  },
];

// --- Test Helper ---

const renderComponent = (
  props: Partial<React.ComponentProps<typeof CalendarSyncBottomSheet>> = {},
) => {
  // useTheme is already mocked in @/hooks
  const ref = React.createRef<CalendarSyncBottomSheetRef>();
  const onSelect = jest.fn();
  const defaultProps = {
    ref,
    onSelect,
    ...props,
  };
  const renderResult = render(
    <CalendarSyncBottomSheet {...defaultProps} />,
  );
  return {ref, onSelect, ...renderResult};
};

const RenderItemWrapper = ({element}: {element: React.ReactElement | null}) => {
  return element ? <View testID="item-wrapper">{element}</View> : null;
};

// --- Tests ---

describe('CalendarSyncBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleCalendarIcon = 'google.png';
    mockICloudCalendarIcon = 'icloud.png';
    mockCalendarIcon = 'calendar.png';

    // Default: return unauthorized to use default providers
    mockCheckPermissions.mockResolvedValue('denied');
    mockFindCalendars.mockResolvedValue([]);
  });

  it('exposes open and close methods via ref', async () => {
    const {ref} = renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    act(() => {
      ref.current?.open();
    });
    expect(mockSheetRef.current.open).toHaveBeenCalledTimes(1);
    act(() => {
      ref.current?.close();
    });
    expect(mockSheetRef.current.close).toHaveBeenCalledTimes(1);
  });

  it('passes correctly formatted provider items to GenericSelectBottomSheet', async () => {
    renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    // Default mock has permissions denied, so calendar list is empty
    expect(sheet.props.items).toEqual([]);
  });

  it('uses fallback icon if provider icon is missing', async () => {
    mockGoogleCalendarIcon = undefined;
    mockICloudCalendarIcon = undefined;
    mockCheckPermissions.mockResolvedValue('authorized');
    mockFindCalendars.mockResolvedValue(mockDeviceCalendars);

    renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    // On iOS, only iCloud calendar with fallback icon
    const expectedFallbackItems: SelectItem[] = [
      {
        id: 'cal-icloud-1',
        label: 'My iCloud Calendar',
        icon: 'calendar.png',
        status: 'available',
      },
    ];
    expect(sheet.props.items).toEqual(expectedFallbackItems);
  });

  it('passes the correct selectedItem when selectedProvider exists in calendars', async () => {
    mockCheckPermissions.mockResolvedValue('authorized');
    mockFindCalendars.mockResolvedValue(mockDeviceCalendars);

    renderComponent({selectedProvider: 'cal-icloud-1'});

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'cal-icloud-1',
      label: 'My iCloud Calendar',
      icon: 'icloud.png',
    });
  });

  it('uses fallback icon in selectedItem if provider icon is missing', async () => {
    mockICloudCalendarIcon = undefined;
    mockCheckPermissions.mockResolvedValue('authorized');
    mockFindCalendars.mockResolvedValue(mockDeviceCalendars);

    renderComponent({selectedProvider: 'cal-icloud-1'});

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'cal-icloud-1',
      label: 'My iCloud Calendar',
      icon: 'calendar.png',
    });
  });

  it('passes "Unknown" as label if selectedProvider is not in the list', async () => {
    renderComponent({selectedProvider: 'outlook' as any});

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'outlook',
      label: 'Unknown',
      icon: undefined,
    });
  });

  it('passes selectedItem as null when selectedProvider is not provided', async () => {
    renderComponent({selectedProvider: null});

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toBeNull();
  });

  it('calls onSelect prop with the item ID and name when onSave is triggered', async () => {
    mockCheckPermissions.mockResolvedValue('authorized');
    mockFindCalendars.mockResolvedValue(mockDeviceCalendars);

    const {onSelect} = renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    act(() => {
      sheet.props.onSave(sheet.props.items[0]);
    });
    // On iOS, first item is iCloud calendar
    expect(onSelect).toHaveBeenCalledWith('cal-icloud-1', 'My iCloud Calendar');
  });

  it('does not call onSelect when onSave is triggered with null', async () => {
    const {onSelect} = renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items[0]?.id).not.toBe('loading');
    });

    const sheet = screen.getByTestId('mock-generic-sheet');
    act(() => {
      sheet.props.onSave(null);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect when onSave is triggered with loading item', async () => {
    const {onSelect} = renderComponent();

    // Get the loading state
    const sheet = screen.getByTestId('mock-generic-sheet');
    const loadingItem = sheet.props.items.find((item: SelectItem) => item.id === 'loading');

    if (loadingItem) {
      act(() => {
        sheet.props.onSave(loadingItem);
      });
      expect(onSelect).not.toHaveBeenCalled();
    }

    // Wait for loading to complete to prevent act warnings
    await waitFor(() => {
      const updatedSheet = screen.getByTestId('mock-generic-sheet');
      expect(updatedSheet.props.items[0]?.id).not.toBe('loading');
    });
  });

  describe('device calendar integration', () => {
    it('fetches device calendars when permissions are authorized', async () => {
      mockCheckPermissions.mockResolvedValue('authorized');
      mockFindCalendars.mockResolvedValue(mockDeviceCalendars);

      renderComponent();

      // Wait for calendars to load
      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items).toEqual(expectedDeviceCalendarItems);
      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(mockFindCalendars).toHaveBeenCalled();
    });

    it('uses empty calendar list when permissions are denied', async () => {
      mockCheckPermissions.mockResolvedValue('denied');

      renderComponent();

      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      // When permissions are denied, availableCalendars is empty
      expect(sheet.props.items).toEqual([]);
      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(mockFindCalendars).not.toHaveBeenCalled();
    });

    it('uses empty calendar list when no writable calendars are found', async () => {
      mockCheckPermissions.mockResolvedValue('authorized');
      mockFindCalendars.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      // When no calendars are found, availableCalendars is empty
      expect(sheet.props.items).toEqual([]);
    });

    it('filters out read-only calendars', async () => {
      mockCheckPermissions.mockResolvedValue('authorized');
      mockFindCalendars.mockResolvedValue([
        ...mockDeviceCalendars,
        {
          id: 'cal-readonly',
          title: 'Read Only Calendar',
          source: 'com.readonly',
          allowsModifications: false,
        },
      ]);

      renderComponent();

      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      expect(sheet.props.items).toHaveLength(1); // Only iCloud on iOS
      expect(sheet.props.items).toEqual(expectedDeviceCalendarItems);
    });

    it('calls onCalendarsLoaded callback when calendars are loaded', async () => {
      mockCheckPermissions.mockResolvedValue('authorized');
      mockFindCalendars.mockResolvedValue(mockDeviceCalendars);
      const onCalendarsLoaded = jest.fn();

      renderComponent({onCalendarsLoaded});

      await waitFor(() => {
        expect(onCalendarsLoaded).toHaveBeenCalled();
      });

      // On iOS, only iCloud calendar should be loaded (Google is filtered out)
      expect(onCalendarsLoaded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'cal-icloud-1',
            name: 'My iCloud Calendar',
          }),
        ])
      );
    });

    it('handles calendar fetch errors gracefully', async () => {
      mockCheckPermissions.mockResolvedValue('authorized');
      mockFindCalendars.mockRejectedValue(new Error('Calendar API error'));
      const onCalendarsLoaded = jest.fn();

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderComponent({onCalendarsLoaded});

      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      // When there's an error, availableCalendars is set to empty array
      expect(sheet.props.items).toEqual([]);
      expect(onCalendarsLoaded).toHaveBeenCalledWith([]);

      consoleSpy.mockRestore();
    });
  });

  describe('renderProviderItem', () => {
    let renderItem: (
      item: SelectItem,
      isSelected: boolean,
    ) => React.ReactElement;

    beforeEach(async () => {
      // useTheme is already mocked in @/hooks
      mockGoogleCalendarIcon = 'google.png';
      mockICloudCalendarIcon = 'icloud.png';
      mockCalendarIcon = 'calendar.png';

      renderComponent(); // Initial render to get the renderItem function

      // Wait for loading to complete
      await waitFor(() => {
        const sheet = screen.getByTestId('mock-generic-sheet');
        expect(sheet.props.items[0]?.id).not.toBe('loading');
      });

      const sheet = screen.getByTestId('mock-generic-sheet');
      renderItem = sheet.props.renderItem;
    });

    it('renders the item icon, label, and no status for "available"', () => {
      const availableItem: SelectItem = {
        id: 'test',
        label: 'Test Calendar',
        icon: 'calendar.png',
        status: 'available',
      };
      const element = renderItem(availableItem, false);
      const {getByTestId, getByText, queryByText} = render(
        <RenderItemWrapper element={element} />,
      );

      expect(getByTestId('calendar-provider-icon')).toBeTruthy();
      expect(getByText('Test Calendar')).toBeTruthy();
      expect(queryByText('Connecting...')).toBeNull();
    });

    it('renders "Connecting..." text for "connecting" status', () => {
      const connectingItem: SelectItem = {
        id: 'test',
        label: 'Test Calendar',
        icon: 'calendar.png',
        status: 'connecting',
      };
      const element = renderItem(connectingItem, false);
      const {getByText} = render(
        <RenderItemWrapper element={element} />,
      );

      expect(getByText('Test Calendar')).toBeTruthy();
      expect(getByText('Connecting...')).toBeTruthy();
    });

    it('renders a checkmark and selected styles when isSelected is true', () => {
      const item: SelectItem = {
        id: 'test',
        label: 'Test Calendar',
        icon: 'calendar.png',
        status: 'available',
      };
      const element = renderItem(item, true);
      const {getByText} = render(
        <RenderItemWrapper element={element} />,
      );

      expect(getByText('Test Calendar')).toBeTruthy();
      expect(getByText('✓')).toBeTruthy();
    });

    it('does not render a checkmark and uses default styles when isSelected is false', () => {
      const item: SelectItem = {
        id: 'test',
        label: 'Test Calendar',
        icon: 'calendar.png',
        status: 'available',
      };
      const element = renderItem(item, false);
      const {getByText, queryByText} = render(
        <RenderItemWrapper element={element} />,
      );

      expect(getByText('Test Calendar')).toBeTruthy();
      expect(queryByText('✓')).toBeNull();
    });

    it('renders item without an icon if item.icon is missing', () => {
      const noIconItem: SelectItem = {
        id: 'test',
        label: 'No Icon',
        icon: undefined,
      };
      const element = renderItem(noIconItem, false);
      const {queryByTestId, getByText} = render(
        <RenderItemWrapper element={element} />,
      );

      expect(queryByTestId('calendar-provider-icon')).toBeNull();
      expect(getByText('No Icon')).toBeTruthy();
    });
  });
});
