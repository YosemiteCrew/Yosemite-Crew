import React from 'react';
import TestRenderer from 'react-test-renderer';
import {AppointmentsScreen} from '@/screens/appointments/AppointmentsScreen';
import {DocumentsScreen} from '@/screens/documents/DocumentsScreen';
import {TasksScreen} from '@/screens/tasks/TasksScreen';
import {Provider} from 'react-redux';
import {store} from '@/app/store';

describe('Placeholder Screens', () => {
  describe('AppointmentsScreen', () => {
    it('should render without crashing', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <AppointmentsScreen />
          </Provider>,
        );
      });
      expect(tree).toBeTruthy();
    });

    it('should render placeholder content', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <AppointmentsScreen />
          </Provider>,
        );
      });
      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('DocumentsScreen', () => {
    it('should render without crashing', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <DocumentsScreen />
          </Provider>,
        );
      });
      expect(tree).toBeTruthy();
    });

    it('should render placeholder content', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <DocumentsScreen />
          </Provider>,
        );
      });
      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('TasksScreen', () => {
    it('should render without crashing', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <TasksScreen />
          </Provider>,
        );
      });
      expect(tree).toBeTruthy();
    });

    it('should render placeholder content', () => {
      let tree: any;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          <Provider store={store}>
            <TasksScreen />
          </Provider>,
        );
      });
      expect(tree.toJSON()).toBeTruthy();
    });
  });
});
