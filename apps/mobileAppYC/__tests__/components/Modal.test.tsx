import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Text, TouchableOpacity} from 'react-native';
import {Modal} from '@/shared/components/common/Modal/Modal';
import {themeReducer} from '@/features/theme';

describe('Modal', () => {
  // Replace RN Modal with a simple View wrapper at runtime to avoid native internals
  const RN = require('react-native');
  RN.Modal = ({ children, ...props }: any) => React.createElement(RN.View, props, children);

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

  it('should render children when visible', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Modal visible={true} onClose={() => {}}>
            <Text>Modal Content</Text>
          </Modal>,
        ),
      );
    });
    expect(tree.root.findByType(Text).props.children).toBe('Modal Content');
  });

  it('should call onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Modal visible={true} onClose={onClose}>
            <Text>Content</Text>
          </Modal>,
        ),
      );
    });
    const backdrop = tree.root.findAllByType(TouchableOpacity)[0];
    backdrop.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });


  // Keep behavior tests simple to avoid RN Modal internals
});
