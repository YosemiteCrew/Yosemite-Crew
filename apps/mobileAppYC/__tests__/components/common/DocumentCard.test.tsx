import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {Pressable} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  DocumentCard,
  DocumentCardProps,
} from '../../../src/shared/components/common/DocumentCard/DocumentCard';

// react-native's Pressable is wrapped in React.memo; UNSAFE_getByType must
// match against the memoized inner component, not the memo wrapper.
const PressableType = (Pressable as any).type;

// --- Mocks ---

// Mock SwipeableActionCard (Wrapper)
jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => {
    const {View: RNView} = require('react-native');
    return {
      SwipeableActionCard: (props: any) => (
        <RNView testID="swipeable-card" {...props} />
      ),
    };
  },
);

// Mock helpers (formatLabel returns the label as-is, falling back when empty)
jest.mock('@/shared/utils/helpers', () => ({
  formatLabel: (label: string, fallback: string) => label || fallback,
}));

// Mock hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Mock cardStyles
jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: () => ({
    card: {backgroundColor: 'white'},
    fallback: {backgroundColor: 'gray'},
  }),
}));

describe('DocumentCard Component', () => {
  const defaultProps: DocumentCardProps = {
    title: 'Vaccination Report',
    businessName: 'Happy Vet Clinic',
    visitType: 'Checkup',
    issueDate: '2023-01-15T00:00:00.000Z',
    onPress: jest.fn(),
    onPressView: jest.fn(),
    onPressEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders the title, the joined meta line, and the swipeable wrapper', () => {
    const {getByText, getByTestId} = render(<DocumentCard {...defaultProps} />);

    expect(getByTestId('swipeable-card')).toBeTruthy();
    expect(getByText('Vaccination Report')).toBeTruthy();
    // Meta line: visit type · business · issue date (single node)
    expect(
      getByText(/Checkup\s+·\s+Happy Vet Clinic\s+·\s+Jan 15, 2023/),
    ).toBeTruthy();
  });

  it('renders the default document icon tile and trailing ellipsis icon', () => {
    const {getByTestId} = render(<DocumentCard {...defaultProps} />);

    expect(getByTestId('icon-document-text-outline')).toBeTruthy();
    expect(getByTestId('icon-ellipsis-horizontal')).toBeTruthy();
  });

  it('falls back to "Document" and renders no meta line when fields are empty', () => {
    const {getByText, queryByText} = render(
      <DocumentCard
        {...defaultProps}
        title=""
        businessName=""
        visitType=""
        issueDate=""
      />,
    );

    expect(getByText('Document')).toBeTruthy();
    // No segments -> no separator anywhere on the row
    expect(queryByText(/·/)).toBeNull();
  });

  it('omits empty segments in the meta line but keeps the rest', () => {
    const {getByText, queryByText} = render(
      <DocumentCard {...defaultProps} businessName="" />,
    );

    // Business omitted; visit type and date remain, joined by the separator
    expect(getByText(/^Checkup\s+·\s+Jan 15, 2023$/)).toBeTruthy();
    expect(queryByText(/Happy Vet Clinic/)).toBeNull();
  });

  // ===========================================================================
  // 2. Date Formatting Logic
  // ===========================================================================

  it('formats a valid ISO date string into the meta line', () => {
    const {getByText} = render(
      <DocumentCard {...defaultProps} issueDate="2023-12-25" />,
    );
    expect(
      getByText(/Checkup\s+·\s+Happy Vet Clinic\s+·\s+Dec 25, 2023/),
    ).toBeTruthy();
  });

  it('omits the date segment when the date is invalid', () => {
    const {getByText, queryByText} = render(
      <DocumentCard {...defaultProps} issueDate="invalid-date-string" />,
    );
    // Invalid date -> segment dropped; visit type + business remain
    expect(getByText(/^Checkup\s+·\s+Happy Vet Clinic$/)).toBeTruthy();
    expect(queryByText(/—/)).toBeNull();
  });

  // ===========================================================================
  // 3. Synced Pill
  // ===========================================================================

  it('renders the SYNCED pill only when synced is true', () => {
    const {getByTestId, getByText} = render(
      <DocumentCard {...defaultProps} synced />,
    );
    expect(getByTestId('document-synced-pill')).toBeTruthy();
    expect(getByText('SYNCED')).toBeTruthy();
  });

  it('hides the SYNCED pill when synced is false', () => {
    const {queryByTestId} = render(
      <DocumentCard {...defaultProps} synced={false} />,
    );
    expect(queryByTestId('document-synced-pill')).toBeNull();
  });

  it('hides the SYNCED pill by default when synced is omitted', () => {
    const {queryByTestId} = render(<DocumentCard {...defaultProps} />);
    expect(queryByTestId('document-synced-pill')).toBeNull();
  });

  // ===========================================================================
  // 4. Interaction
  // ===========================================================================

  it('calls onPress when card is pressed', () => {
    const {UNSAFE_getByType} = render(<DocumentCard {...defaultProps} />);
    const touchable = UNSAFE_getByType(PressableType);

    fireEvent.press(touchable);
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('passes action props to SwipeableActionCard', () => {
    const {getByTestId} = render(
      <DocumentCard {...defaultProps} showEditAction={false} />,
    );
    const card = getByTestId('swipeable-card');

    expect(card.props.onPressView).toBe(defaultProps.onPressView);
    expect(card.props.onPressEdit).toBe(defaultProps.onPressEdit);
    expect(card.props.showEditAction).toBe(false);
  });

  it('disables interaction if onPress is not provided', () => {
    const {UNSAFE_getByType} = render(
      <DocumentCard {...defaultProps} onPress={undefined} />,
    );
    const touchable = UNSAFE_getByType(PressableType);
    expect(touchable.props.disabled).toBe(true);
  });
});
