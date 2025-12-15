import React from 'react';
import {render} from '@testing-library/react-native';
// Path: 5 levels up from __tests__/features/tasks/screens/EmptyTasksScreen/ to project root
import {EmptyTasksScreen} from '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen';
import {Images} from '@/assets/images';

// --- Mocks ---

// 1. Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    emptyDocuments: {uri: 'test-empty-image-uri'},
  },
}));

// 2. Mock GenericEmptyScreen
// We use a mock function to verify props passed to it
const MockGenericEmptyScreen = jest.fn(
  ({title, subtitle, headerTitle}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="generic-empty-screen">
        <Text>{headerTitle}</Text>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </View>
    );
  },
);

jest.mock('@/shared/screens/common/GenericEmptyScreen', () => ({
  GenericEmptyScreen: (props: any) => MockGenericEmptyScreen(props),
}));

describe('EmptyTasksScreen', () => {
  beforeEach(() => {
    MockGenericEmptyScreen.mockClear();
  });

  it('renders correctly using GenericEmptyScreen', () => {
    const {getByTestId, getByText} = render(<EmptyTasksScreen />);

    // Verify the wrapper component is rendered
    expect(getByTestId('generic-empty-screen')).toBeTruthy();

    // Verify visible text content
    expect(getByText('Tasks')).toBeTruthy(); // headerTitle
    expect(getByText('No tasks yet!')).toBeTruthy(); // title

    // Verify exact props passed to the component
    // This ensures image, subtitle logic, and flags are correct
    expect(MockGenericEmptyScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        headerTitle: 'Tasks',
        emptyImage: Images.emptyDocuments,
        title: 'No tasks yet!',
        // Verify the raw string exactly as defined in the component
        subtitle: String.raw`Add a companion first to start creating tasks\nfor their health, hygiene, and care!`,
        showBackButton: false,
      }),
    );
  });
});
