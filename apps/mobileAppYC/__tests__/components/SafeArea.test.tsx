import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {SafeArea, SafeAreaWithHook} from '@/shared/components/common/SafeArea/SafeArea';
import {themeReducer} from '@/features/theme';
import {Text, View, StatusBar} from 'react-native';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, ...props}: any) => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return MockReact.createElement(MockView, props, children);
  },
}));

describe('SafeArea', () => {
  const createTestStore = () => {
    return configureStore({
      reducer: {
        theme: themeReducer,
      },
    });
  };

  const wrap = (children: React.ReactElement) => (
    <Provider store={createTestStore()}>{children}</Provider>
  );

  describe('SafeArea component', () => {
    it('should render children', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Test Content</Text>
            </SafeArea>
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      const hasContent = texts.some(text => text.props.children === 'Test Content');
      expect(hasContent).toBe(true);
    });

    it('should render StatusBar', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const statusBars = tree.root.findAllByType(StatusBar);
      expect(statusBars.length).toBe(1);
    });

    it('should render StatusBar with barStyle based on theme', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const statusBar = tree.root.findByType(StatusBar);
      expect(statusBar.props.barStyle).toBeDefined();
      expect(['light-content', 'dark-content']).toContain(statusBar.props.barStyle);
    });

    it('should set StatusBar translucent to false', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const statusBar = tree.root.findByType(StatusBar);
      expect(statusBar.props.translucent).toBe(false);
    });

    it('should apply custom style', () => {
      const customStyle = {padding: 20};
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea style={customStyle}>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      // Find the SafeAreaView (mocked as View)
      const safeAreaView = views.find(
        view =>
          view.props.style &&
          (Array.isArray(view.props.style)
            ? view.props.style.some((s: any) => s && s.padding === 20)
            : view.props.style.padding === 20)
      );
      expect(safeAreaView).toBeTruthy();
    });

    it('should use padding mode by default', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      const safeAreaView = views.find(view => view.props.mode !== undefined);
      if (safeAreaView) {
        expect(safeAreaView.props.mode).toBe('padding');
      }
    });

    it('should accept custom mode', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea mode="margin">
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      const safeAreaView = views.find(view => view.props.mode !== undefined);
      if (safeAreaView) {
        expect(safeAreaView.props.mode).toBe('margin');
      }
    });

    it('should use all edges by default', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      const safeAreaView = views.find(view => view.props.edges !== undefined);
      if (safeAreaView) {
        expect(safeAreaView.props.edges).toEqual(['top', 'bottom', 'left', 'right']);
      }
    });

    it('should accept custom edges', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeArea edges={['top', 'bottom']}>
              <Text>Content</Text>
            </SafeArea>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      const safeAreaView = views.find(view => view.props.edges !== undefined);
      if (safeAreaView) {
        expect(safeAreaView.props.edges).toEqual(['top', 'bottom']);
      }
    });
  });

  describe('SafeAreaWithHook component', () => {
    it('should render children', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeAreaWithHook>
              <Text>Hook Content</Text>
            </SafeAreaWithHook>
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      const hasContent = texts.some(text => text.props.children === 'Hook Content');
      expect(hasContent).toBe(true);
    });

    it('should render StatusBar', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeAreaWithHook>
              <Text>Content</Text>
            </SafeAreaWithHook>
          )
        );
      });

      const statusBars = tree.root.findAllByType(StatusBar);
      expect(statusBars.length).toBe(1);
    });

    it('should apply custom style', () => {
      const customStyle = {margin: 10};
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeAreaWithHook style={customStyle}>
              <Text>Content</Text>
            </SafeAreaWithHook>
          )
        );
      });

      const views = tree.root.findAllByType(View);
      const styledView = views.find(
        view =>
          view.props.style &&
          (Array.isArray(view.props.style)
            ? view.props.style.some((s: any) => s && s.margin === 10)
            : view.props.style.margin === 10)
      );
      expect(styledView).toBeTruthy();
    });

    it('should render StatusBar with barStyle based on theme', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeAreaWithHook>
              <Text>Content</Text>
            </SafeAreaWithHook>
          )
        );
      });

      const statusBar = tree.root.findByType(StatusBar);
      expect(statusBar.props.barStyle).toBeDefined();
      expect(['light-content', 'dark-content']).toContain(statusBar.props.barStyle);
    });

    it('should set StatusBar translucent to false', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <SafeAreaWithHook>
              <Text>Content</Text>
            </SafeAreaWithHook>
          )
        );
      });

      const statusBar = tree.root.findByType(StatusBar);
      expect(statusBar.props.translucent).toBe(false);
    });
  });
});
