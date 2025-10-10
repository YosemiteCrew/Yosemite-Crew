import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Header} from '@/components/common/Header/Header';
import themeReducer from '@/store/slices/themeSlice';
import {TouchableOpacity, Text, View} from 'react-native';

describe('Header', () => {
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

  it('should render with title', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Header title="Test Title" />));
    });

    const texts = tree.root.findAllByType(Text);
    const hasTitle = texts.some(text => text.props.children === 'Test Title');
    expect(hasTitle).toBe(true);
  });

  it('should not render title when not provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Header />));
    });

    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBe(0);
  });

  it('should render back button when showBackButton is true', () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Header showBackButton={true} onBack={onBack} />)
      );
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThan(0);

    const backButtons = touchables.filter(
      touchable => touchable.props.onPress === onBack
    );
    expect(backButtons.length).toBe(1);
  });

  it('should not render back button by default', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Header title="Test" />));
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBe(0);
  });

  it('should call onBack when back button is pressed', () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Header showBackButton={true} onBack={onBack} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    TestRenderer.act(() => {
      touchable.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should render back arrow icon', () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Header showBackButton={true} onBack={onBack} />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasArrow = texts.some(text => text.props.children === '←');
    expect(hasArrow).toBe(true);
  });

  it('should render rightComponent when provided', () => {
    const RightComp = () => <Text>Right</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Header title="Test" rightComponent={<RightComp />} />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasRightComp = texts.some(text => text.props.children === 'Right');
    expect(hasRightComp).toBe(true);
  });

  it('should not render rightComponent when not provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Header title="Test" />));
    });

    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBe(1); // Only title
    expect(texts[0].props.children).toBe('Test');
  });

  it('should render all sections (left, center, right)', () => {
    const onBack = jest.fn();
    const RightComp = () => <Text>Right</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Header
            title="Center"
            showBackButton={true}
            onBack={onBack}
            rightComponent={<RightComp />}
          />
        )
      );
    });

    const views = tree.root.findAllByType(View);
    // Should have container + leftSection + centerSection + rightSection + back button wrapper + checkbox wrapper
    expect(views.length).toBeGreaterThan(3);
  });

  it('should have correct activeOpacity for back button', () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Header showBackButton={true} onBack={onBack} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.activeOpacity).toBe(0.7);
  });

  it('should render with all props combined', () => {
    const onBack = jest.fn();
    const RightComp = () => <Text>Menu</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Header
            title="My Title"
            showBackButton={true}
            onBack={onBack}
            rightComponent={<RightComp />}
          />
        )
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasTitle = texts.some(text => text.props.children === 'My Title');
    const hasArrow = texts.some(text => text.props.children === '←');
    const hasRightComp = texts.some(text => text.props.children === 'Menu');

    expect(hasTitle).toBe(true);
    expect(hasArrow).toBe(true);
    expect(hasRightComp).toBe(true);
  });
});
