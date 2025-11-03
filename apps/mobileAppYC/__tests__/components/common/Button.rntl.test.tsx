import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';
import {Button} from '@/shared/components/common/Button/Button';
import {TouchableOpacity, Text} from 'react-native';

const withProviders = (ui: React.ReactElement) => <Provider store={store}>{ui}</Provider>;

const findTouchableWithText = (utils: ReturnType<typeof render>, label: string) => {
  const all = utils.UNSAFE_getAllByType(TouchableOpacity);
  const hasText = (node: any): boolean => {
    if (!node) return false;
    if (node.type === Text && node.props?.children === label) return true;
    const children = Array.isArray(node.children) ? node.children : [node.children];
    return children.some((c: any) => (c ? hasText(c) : false));
  };
  return all.find(t => hasText(t));
};

describe('Button (RNTL)', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const utils = render(withProviders(<Button title="Click me" onPress={onPress} />));

    const target = findTouchableWithText(utils, 'Click me');
    expect(target).toBeTruthy();
    if (target) fireEvent.press(target);
    expect(onPress).toHaveBeenCalled();
  });
});

