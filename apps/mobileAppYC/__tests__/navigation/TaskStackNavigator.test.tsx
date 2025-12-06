import React from 'react';
import {View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {render, waitFor} from '@testing-library/react-native';
import {TaskStackNavigator} from '@/navigation/TaskStackNavigator';

// --- Mocks ---

// 1. Navigation Mock
// We mock createNativeStackNavigator to render a simple view hierarchy we can test against.
// Using require('react-native') inside prevents hoisting errors.
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: any) => {
      const {View} = require('react-native');
      return <View testID="MockNavigator">{children}</View>;
    },
    Screen: ({name}: any) => {
      const {View} = require('react-native');
      return <View testID={`Screen-${name}`} />;
    },
  }),
}));

// 2. Screen Component Mocks
// Mocking these components is crucial. If we let them render, we'd need to mock
// all their dependencies (Redux, specific hooks, route params), making this test brittle.
jest.mock('@/features/tasks/screens/TasksMainScreen/TasksMainScreen', () => ({
  TasksMainScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/tasks/screens/TasksListScreen/TasksListScreen', () => ({
  TasksListScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/tasks/screens/AddTaskScreen/AddTaskScreen', () => ({
  AddTaskScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/tasks/screens/EditTaskScreen/EditTaskScreen', () => ({
  EditTaskScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/tasks/screens/TaskViewScreen/TaskViewScreen', () => ({
  TaskViewScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock(
  '@/features/tasks/screens/ObservationalToolScreen/ObservationalToolScreen',
  () => ({
    ObservationalToolScreen: () => {
      const {View} = require('react-native');
      return <View />;
    },
  }),
);

// --- Tests ---

describe('TaskStackNavigator', () => {
  const renderNavigator = () => {
    return render(
      <NavigationContainer>
        <TaskStackNavigator />
      </NavigationContainer>,
    );
  };

  it('renders the navigator container', async () => {
    const {getByTestId} = renderNavigator();

    // Wait for navigation container to mount
    await waitFor(() => {
      expect(getByTestId('MockNavigator')).toBeTruthy();
    });
  });

  it('defines all required screens in the stack', async () => {
    const {getByTestId} = renderNavigator();

    await waitFor(() => {
      // Check that all expected routes are registered in the stack
      // The MockNavigator renders its children, which are our mocked Screens with these testIDs
      expect(getByTestId('Screen-TasksMain')).toBeTruthy();
      expect(getByTestId('Screen-TasksList')).toBeTruthy();
      expect(getByTestId('Screen-AddTask')).toBeTruthy();
      expect(getByTestId('Screen-EditTask')).toBeTruthy();
      expect(getByTestId('Screen-TaskView')).toBeTruthy();
      expect(getByTestId('Screen-ObservationalTool')).toBeTruthy();
    });
  });
});
