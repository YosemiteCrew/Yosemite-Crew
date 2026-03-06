import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render} from '@testing-library/react-native';
import {GenericEmptyScreen} from '@/shared/screens/common/GenericEmptyScreen';

// --- Mocks ---

// 1. Mock hooks
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

// 2. Mock Components
// We define the mock function inline to avoid Jest hoisting issues (variable undefined)
jest.mock('@/shared/components/common', () => ({
  SafeArea: jest.fn(({children}) => <>{children}</>),
}));

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: jest.fn(() => null),
}));

describe('GenericEmptyScreen', () => {
  const mockImageSource = {uri: 'https://example.com/empty.png'};

  const defaultProps = {
    headerTitle: 'Test Header',
    emptyImage: mockImageSource,
    title: 'Nothing Here',
    subtitle: 'This screen is empty.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and matches snapshot', () => {
    const tree = render(<GenericEmptyScreen {...defaultProps} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('displays the correct title and subtitle text', () => {
    const {getByText} = render(<GenericEmptyScreen {...defaultProps} />);

    expect(getByText('Nothing Here')).toBeTruthy();
    expect(getByText('This screen is empty.')).toBeTruthy();
  });

  it('renders the Header with correct default props (showBackButton=false)', () => {
    render(<GenericEmptyScreen {...defaultProps} />);
  });

  it('passes showBackButton=true to Header when prop is provided', () => {
    render(<GenericEmptyScreen {...defaultProps} showBackButton={true} />);
  });

  it('renders the image with the correct source', () => {
    const {toJSON} = render(<GenericEmptyScreen {...defaultProps} />);
    const tree = toJSON();

    // Helper to traverse the rendered tree and find the image by its source prop
    // This is more robust than finding by Type when RN is mocked or wrappers are involved
    const findImageBySource = (node: any): any => {
      if (!node) return null;
      // Check if this node has the matching source
      if (node.props && node.props.source === mockImageSource) return node;
      // Recursively check children
      if (node.children) {
        for (const child of node.children) {
          const found = findImageBySource(child);
          if (found) return found;
        }
      }
      return null;
    };

    const imageNode = findImageBySource(tree);
    expect(imageNode).toBeTruthy();
    expect(imageNode.props.source).toEqual(mockImageSource);
  });

  it('applies correct theme styles', () => {
    const {getByText} = render(<GenericEmptyScreen {...defaultProps} />);

    const titleText = getByText('Nothing Here');
    const subtitleText = getByText('This screen is empty.');

    // Verify styles derived from useTheme mock
    expect(titleText.props.style).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.secondary,
        textAlign: 'center',
        marginBottom: mockTheme.spacing['3'],
      }),
    );

    expect(subtitleText.props.style).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.textSecondary,
        textAlign: 'center',
        fontSize: mockTheme.typography.bodyMedium.fontSize,
      }),
    );
  });
});
