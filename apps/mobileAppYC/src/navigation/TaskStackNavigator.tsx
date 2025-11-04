import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {TaskStackParamList} from './types';

// Import screens
import {TasksMainScreen} from '@/features/tasks/screens/TasksMainScreen/TasksMainScreen';
import {TasksListScreen} from '@/features/tasks/screens/TasksListScreen/TasksListScreen';
import {AddTaskScreen} from '@/features/tasks/screens/AddTaskScreen/AddTaskScreen';
import {EditTaskScreen} from '@/features/tasks/screens/EditTaskScreen/EditTaskScreen';
import {TaskViewScreen} from '@/features/tasks/screens/TaskViewScreen/TaskViewScreen';
import {ObservationalToolScreen} from '@/features/tasks/screens/ObservationalToolScreen/ObservationalToolScreen';

const Stack = createNativeStackNavigator<TaskStackParamList>();

export const TaskStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="TasksMain" component={TasksMainScreen} />
      <Stack.Screen name="TasksList" component={TasksListScreen} />
      <Stack.Screen name="AddTask" component={AddTaskScreen} />
      <Stack.Screen name="EditTask" component={EditTaskScreen} />
      <Stack.Screen name="TaskView" component={TaskViewScreen} />
      <Stack.Screen name="ObservationalTool" component={ObservationalToolScreen} />
    </Stack.Navigator>
  );
};
