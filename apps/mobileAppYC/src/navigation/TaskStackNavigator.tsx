import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {TaskStackParamList} from './types';

// Import screens
import {TasksMainScreen} from '@/screens/tasks/TasksMainScreen/TasksMainScreen';
import {TasksListScreen} from '@/screens/tasks/TasksListScreen/TasksListScreen';
import {AddTaskScreen} from '@/screens/tasks/AddTaskScreen/AddTaskScreen';
import {EditTaskScreen} from '@/screens/tasks/EditTaskScreen/EditTaskScreen';
import {TaskViewScreen} from '@/screens/tasks/TaskViewScreen/TaskViewScreen';
import {ObservationalToolScreen} from '@/screens/tasks/ObservationalToolScreen/ObservationalToolScreen';

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
