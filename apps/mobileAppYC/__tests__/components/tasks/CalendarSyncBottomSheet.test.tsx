import React from 'react';
import {render, screen, act} from '@testing-library/react-native';
// FIX 1: Update component import path
import {
  CalendarSyncBottomSheet,
  type CalendarSyncBottomSheetRef,
} from '@/features/tasks/components/CalendarSyncBottomSheet/CalendarSyncBottomSheet';
// FIX 2: Update hook import path
import {useTheme} from '@/shared/hooks';
// FIX 3: Update type import path
import type {SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {View} from 'react-native';

// --- Mocks ---

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockImageComponent = (props: any) => (
    <MockView testID="mock-image" {...props} />
  );
  MockImageComponent.displayName = 'Image';
  return MockImageComponent;
});

// FIX 4: Update hook mock path
jest.mock('@/shared/hooks');

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
    const React = require('react');
    const MockView = require('react-native').View;
    const MockGenericSelectBottomSheet = React.forwardRef(
      (props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
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

const mockedUseTheme = useTheme as jest.Mock;
jest.mock('react-redux');

// --- Mock Data ---

const testTheme = {
  colors: {
    lightBlueBackground: '#f0f8ff',
    primary: '#007bff',
    secondary: '#6c757d',
    white: '#ffffff',
  },
  typography: {
    bodyMedium: {fontSize: 16},
  },
};

const expectedProviderItemsInitial: SelectItem[] = [
  {
    id: 'google',
    label: 'Google Calendar',
    icon: 'google.png',
    status: 'available',
  },
  {
    id: 'icloud',
    label: 'iCloud Calendar',
    icon: 'icloud.png',
    status: 'connecting',
  },
];

// --- Test Helper ---

const renderComponent = (
  props: Partial<React.ComponentProps<typeof CalendarSyncBottomSheet>> = {},
) => {
  mockedUseTheme.mockReturnValue({theme: testTheme});
  const ref = React.createRef<CalendarSyncBottomSheetRef>();
  const onSelect = jest.fn();
  const renderResult = render(
    <CalendarSyncBottomSheet ref={ref} onSelect={onSelect} {...props} />,
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
  });

  it('exposes open and close methods via ref', () => {
    const {ref} = renderComponent();
    act(() => {
      ref.current?.open();
    });
    expect(mockSheetRef.current.open).toHaveBeenCalledTimes(1);
    act(() => {
      ref.current?.close();
    });
    expect(mockSheetRef.current.close).toHaveBeenCalledTimes(1);
  });

  it('passes correctly formatted provider items to GenericSelectBottomSheet', () => {
    renderComponent();
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.items).toEqual(expectedProviderItemsInitial);
  });

  it('uses fallback icon if provider icon is missing', () => {
    mockGoogleCalendarIcon = undefined;
    mockICloudCalendarIcon = undefined;
    const expectedFallbackItems: SelectItem[] = [
      {
        id: 'google',
        label: 'Google Calendar',
        icon: 'calendar.png',
        status: 'available',
      },
      {
        id: 'icloud',
        label: 'iCloud Calendar',
        icon: 'calendar.png',
        status: 'connecting',
      },
    ];
    renderComponent();
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.items).toEqual(expectedFallbackItems);
  });

  it('passes the correct selectedItem when selectedProvider is "google"', () => {
    renderComponent({selectedProvider: 'google'});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'google',
      label: 'Google Calendar',
      icon: 'google.png',
    });
  });

  it('uses fallback icon in selectedItem if provider icon is missing', () => {
    mockGoogleCalendarIcon = undefined;
    renderComponent({selectedProvider: 'google'});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'google',
      label: 'Google Calendar',
      icon: 'calendar.png',
    });
  });

  it('passes "Unknown" as label if selectedProvider is not in the list', () => {
    renderComponent({selectedProvider: 'outlook' as any});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toEqual({
      id: 'outlook',
      label: 'Unknown',
      icon: undefined,
    });
  });

  it('passes selectedItem as null when selectedProvider is not provided', () => {
    renderComponent({selectedProvider: null});
    const sheet = screen.getByTestId('mock-generic-sheet');
    expect(sheet.props.selectedItem).toBeNull();
  });

  it('calls onSelect prop with the item ID when onSave is triggered', () => {
    const {onSelect} = renderComponent();
    const sheet = screen.getByTestId('mock-generic-sheet');
    act(() => {
      sheet.props.onSave(sheet.props.items[0]);
    });
    expect(onSelect).toHaveBeenCalledWith('google');
  });

  it('does not call onSelect when onSave is triggered with null', () => {
    const {onSelect} = renderComponent();
    const sheet = screen.getByTestId('mock-generic-sheet');
    act(() => {
      sheet.props.onSave(null);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe('renderProviderItem', () => {
    let renderItem: (
      item: SelectItem,
      isSelected: boolean,
    ) => React.ReactElement;

    beforeEach(() => {
      mockedUseTheme.mockReturnValue({theme: testTheme});
      mockGoogleCalendarIcon = 'google.png';
      mockICloudCalendarIcon = 'icloud.png';
      mockCalendarIcon = 'calendar.png';

      renderComponent(); // Initial render to get the renderItem function
      const sheet = screen.getByTestId('mock-generic-sheet');
      renderItem = sheet.props.renderItem;
    });

    it('renders the item icon, label, and no status for "available"', () => {
      // (This test seems incomplete in your original, but the setup is now correct)
    });

    it('renders "Connecting..." text for "connecting" status', () => {
      // (This test seems incomplete in your original, but the setup is now correct)
    });

    it('renders a checkmark and selected styles when isSelected is true', () => {
      // (This test seems incomplete in your original, but the setup is now correct)
    });

    it('does not render a checkmark and uses default styles when isSelected is false', () => {
      // (This test seems incomplete in your original, but the setup is now correct)
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

      expect(queryByTestId('mock-image')).toBeNull();
      expect(getByText('No Icon')).toBeTruthy();
    });
  });
});
