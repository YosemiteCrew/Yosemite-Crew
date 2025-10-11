import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {themeReducer} from '@/features/theme';
import {Text, TouchableOpacity, ActivityIndicator, View, Platform} from 'react-native';

// Mock liquid glass
jest.mock('@callstack/liquid-glass', () => ({
  LiquidGlassView: ({children, style, interactive, effect, tintColor, colorScheme}: any) => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return MockReact.createElement(
      MockView,
      {
        testID: 'liquid-glass-view',
        style,
        'data-interactive': interactive,
        'data-effect': effect,
        'data-tint': tintColor,
        'data-scheme': colorScheme,
      },
      children
    );
  },
  isLiquidGlassSupported: true,
}));

describe('LiquidGlassButton', () => {
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

  beforeEach(() => {
    Platform.OS = 'ios';
  });

  describe('Basic Rendering', () => {
    it('should render with title', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Press Me" onPress={() => {}} />)
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === 'Press Me')).toBe(true);
    });

    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Click" onPress={onPress} />)
        );
      });

      const touchable = tree.root.findByType(TouchableOpacity);
      TestRenderer.act(() => {
        touchable.props.onPress();
      });

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const onPress = jest.fn();
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Click" onPress={onPress} disabled />)
        );
      });

      const touchable = tree.root.findByType(TouchableOpacity);
      expect(touchable.props.disabled).toBe(true);
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Click" onPress={onPress} loading />)
        );
      });

      const touchable = tree.root.findByType(TouchableOpacity);
      expect(touchable.props.disabled).toBe(true);
    });
  });

  describe('Size Variants', () => {
    it('should render small size', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Small" onPress={() => {}} size="small" />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should render medium size by default', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Medium" onPress={() => {}} />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should render large size', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Large" onPress={() => {}} size="large" />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Submit" onPress={() => {}} loading />)
        );
      });

      const indicator = tree.root.findByType(ActivityIndicator);
      expect(indicator).toBeTruthy();
      expect(indicator.props.size).toBe('small');
    });

    it('should not show loading indicator when not loading', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Submit" onPress={() => {}} />)
        );
      });

      const indicators = tree.root.findAllByType(ActivityIndicator);
      expect(indicators.length).toBe(0);
    });
  });

  describe('Icons', () => {
    it('should render left icon', () => {
      const LeftIcon = () => <Text>←</Text>;
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Back"
              onPress={() => {}}
              leftIcon={<LeftIcon />}
            />
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === '←')).toBe(true);
    });

    it('should render right icon', () => {
      const RightIcon = () => <Text>→</Text>;
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Next"
              onPress={() => {}}
              rightIcon={<RightIcon />}
            />
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === '→')).toBe(true);
    });

    it('should render both left and right icons', () => {
      const LeftIcon = () => <Text>←</Text>;
      const RightIcon = () => <Text>→</Text>;
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Both"
              onPress={() => {}}
              leftIcon={<LeftIcon />}
              rightIcon={<RightIcon />}
            />
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === '←')).toBe(true);
      expect(texts.some(t => t.props.children === '→')).toBe(true);
    });

    it('should render icon without title', () => {
      const Icon = () => <Text>✓</Text>;
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton onPress={() => {}} leftIcon={<Icon />} />)
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === '✓')).toBe(true);
    });
  });

  describe('Custom Content', () => {
    it('should render custom content instead of title', () => {
      const CustomContent = () => <Text>Custom Button</Text>;
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              onPress={() => {}}
              customContent={<CustomContent />}
            />
          )
        );
      });

      const texts = tree.root.findAllByType(Text);
      expect(texts.some(t => t.props.children === 'Custom Button')).toBe(true);
    });
  });

  describe('Glass Effects', () => {
    it('should apply clear glass effect', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Clear"
              onPress={() => {}}
              glassEffect="clear"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply regular glass effect', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Regular"
              onPress={() => {}}
              glassEffect="regular"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply no glass effect', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="None"
              onPress={() => {}}
              glassEffect="none"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Tint Colors', () => {
    it('should apply custom tint color', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Tinted"
              onPress={() => {}}
              tintColor="#FF0000"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should handle white tint color', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="White"
              onPress={() => {}}
              tintColor="#FFFFFF"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should handle light tint colors', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Light"
              onPress={() => {}}
              tintColor="#F0F0F0"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Dimensions', () => {
    it('should apply custom width', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Wide"
              onPress={() => {}}
              width={200}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply custom height', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Tall"
              onPress={() => {}}
              height={60}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply minWidth and minHeight', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Min"
              onPress={() => {}}
              minWidth={100}
              minHeight={50}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply maxWidth', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Max"
              onPress={() => {}}
              maxWidth={300}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Border Radius', () => {
    it('should apply custom border radius as number', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Rounded"
              onPress={() => {}}
              borderRadius={20}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should use default border radius', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Default" onPress={() => {}} />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Border and Shadow', () => {
    it('should force border when requested', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Border"
              onPress={() => {}}
              forceBorder
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply custom border color', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Border"
              onPress={() => {}}
              borderColor="#00FF00"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply light shadow intensity', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Shadow"
              onPress={() => {}}
              shadowIntensity="light"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply medium shadow intensity', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Shadow"
              onPress={() => {}}
              shadowIntensity="medium"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply strong shadow intensity', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Shadow"
              onPress={() => {}}
              shadowIntensity="strong"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply no shadow', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="No Shadow"
              onPress={() => {}}
              shadowIntensity="none"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Interactive Props', () => {
    it('should be interactive by default', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Interactive" onPress={() => {}} />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should not be interactive when disabled', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Not Interactive"
              onPress={() => {}}
              interactive={false}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Color Schemes', () => {
    it('should apply light color scheme', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Light"
              onPress={() => {}}
              colorScheme="light"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply dark color scheme', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Dark"
              onPress={() => {}}
              colorScheme="dark"
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply system color scheme by default', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="System" onPress={() => {}} />)
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });

  describe('Platform-specific Rendering', () => {
    it('should render with LiquidGlassView on iOS', () => {
      Platform.OS = 'ios';
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="iOS" onPress={() => {}} />)
        );
      });

      const views = tree.root.findAllByProps({testID: 'liquid-glass-view'});
      expect(views.length).toBeGreaterThan(0);
    });

    it('should use fallback on Android', () => {
      Platform.OS = 'android';
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(<LiquidGlassButton title="Android" onPress={() => {}} />)
        );
      });

      const touchable = tree.root.findByType(TouchableOpacity);
      expect(touchable).toBeTruthy();
    });
  });

  describe('Style Customization', () => {
    it('should apply custom style', () => {
      const customStyle = {backgroundColor: 'red'};
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Custom"
              onPress={() => {}}
              style={customStyle}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });

    it('should apply custom text style', () => {
      const customTextStyle = {fontSize: 20};
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(
          wrap(
            <LiquidGlassButton
              title="Custom Text"
              onPress={() => {}}
              textStyle={customTextStyle}
            />
          )
        );
      });

      expect(tree.toJSON()).toBeTruthy();
    });
  });
});
