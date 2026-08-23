import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
// Path: 5 levels up to __tests__, then into setup
import {mockTheme} from '../../../../../setup/mockTheme';
// Path: 6 levels up to project root, then to src
import {
  ViewField,
  ViewTouchField,
} from '../../../../../../src/features/tasks/screens/TaskViewScreen/components/ViewField';

// --- Mocks ---

// The warm-bone DetailRow reads styling tokens from useTheme(). Provide the
// shared mock theme so styling never crashes on missing tokens.
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

describe('ViewField Components', () => {
  describe('ViewField', () => {
    const defaultProps = {
      label: 'Test Label',
      value: 'Test Value',
    };

    it('renders the label and value text', () => {
      const {getByText} = render(<ViewField {...defaultProps} />);

      expect(getByText('Test Label')).toBeTruthy();
      expect(getByText('Test Value')).toBeTruthy();
    });

    it('renders a top hairline divider for non-first rows', () => {
      const {getByTestId} = render(<ViewField {...defaultProps} />);

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.borderTopWidth).toBe(1);
      expect(rowStyle.borderTopColor).toBe(mockTheme.colors.hairline);
    });

    it('drops the top divider for the first row in a group', () => {
      const {getByTestId} = render(<ViewField {...defaultProps} first />);

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.borderTopWidth).toBeUndefined();
    });

    it('uses a single-line right-aligned layout by default', () => {
      const {getByTestId, getByText} = render(<ViewField {...defaultProps} />);

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.flexDirection).toBe('row');

      const valueStyle = StyleSheet.flatten(
        getByText('Test Value').props.style,
      );
      expect(valueStyle.textAlign).toBe('right');
      expect(valueStyle.color).toBe(mockTheme.colors.inkBody);
    });

    it('applies a stacked layout when multiline is set', () => {
      const {getByTestId, getByText} = render(
        <ViewField {...defaultProps} multiline />,
      );

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.flexDirection).toBe('column');

      const valueStyle = StyleSheet.flatten(
        getByText('Test Value').props.style,
      );
      expect(valueStyle.textAlign).toBe('left');
    });

    it('styles the label with the muted ink token', () => {
      const {getByText} = render(<ViewField {...defaultProps} />);

      const labelStyle = StyleSheet.flatten(
        getByText('Test Label').props.style,
      );
      expect(labelStyle.color).toBe(mockTheme.colors.inkMuted);
    });
  });

  describe('ViewTouchField', () => {
    const defaultProps = {
      label: 'Touch Label',
      value: 'Touch Value',
    };

    it('renders the label and value text', () => {
      const {getByText} = render(<ViewTouchField {...defaultProps} />);

      expect(getByText('Touch Label')).toBeTruthy();
      expect(getByText('Touch Value')).toBeTruthy();
    });

    it('renders a top hairline divider for non-first rows', () => {
      const {getByTestId} = render(<ViewTouchField {...defaultProps} />);

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.borderTopWidth).toBe(1);
      expect(rowStyle.borderTopColor).toBe(mockTheme.colors.hairline);
    });

    it('drops the top divider for the first row in a group', () => {
      const {getByTestId} = render(<ViewTouchField {...defaultProps} first />);

      const rowStyle = StyleSheet.flatten(
        getByTestId('detail-row').props.style,
      );
      expect(rowStyle.borderTopWidth).toBeUndefined();
    });

    it('renders identically to a read-only value row (no icon or press affordance)', () => {
      const {getByText} = render(<ViewTouchField {...defaultProps} />);

      const valueStyle = StyleSheet.flatten(
        getByText('Touch Value').props.style,
      );
      expect(valueStyle.textAlign).toBe('right');
      expect(valueStyle.color).toBe(mockTheme.colors.inkBody);
    });
  });
});
