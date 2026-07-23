import React from 'react';
import {Image} from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {AERBusinessSelectCard} from '../../../../src/features/adverseEventReporting/components/AERBusinessSelectCard';
import {fetchGooglePlacesImage} from '../../../../src/features/linkedBusinesses/thunks';

// --- Mocks ---

// Redux dispatch
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// Google Places image thunk
jest.mock('../../../../src/features/linkedBusinesses/thunks', () => ({
  fetchGooglePlacesImage: jest.fn(),
}));

// Theme
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const baseBusiness: any = {
  id: 'biz-1',
  companionId: 'comp-1',
  businessName: 'Happy Paws Clinic',
  category: 'hospital',
  address: '42 Wellness Ave, Petville',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const makeBusiness = (overrides: Partial<any> = {}) => ({
  ...baseBusiness,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockImplementation(action => action);
  (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
    unwrap: jest.fn().mockResolvedValue({photoUrl: null}),
  });
});

describe('AERBusinessSelectCard', () => {
  it('renders the business name, address meta and default (hospital) avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness()}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Happy Paws Clinic')).toBeTruthy();
    expect(screen.getByText('42 Wellness Ave, Petville')).toBeTruthy();
    // hospital falls into the default branch -> medkit-outline glyph
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
    // not selected -> no checkmark chip
    expect(screen.queryByTestId('icon-checkmark')).toBeNull();
    // no placeId -> no image fetch dispatched
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('renders the boarder avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({category: 'boarder'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('icon-home-outline')).toBeTruthy();
  });

  it('renders the breeder avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({category: 'breeder'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('icon-paw-outline')).toBeTruthy();
  });

  it('renders the groomer avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({category: 'groomer'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('icon-cut-outline')).toBeTruthy();
  });

  it('shows the checkmark chip and applies selected styling when selected', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness()}
        isSelected
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('icon-checkmark')).toBeTruthy();
  });

  it('calls onSelect with the business id when pressed', () => {
    const onSelect = jest.fn();
    render(
      <AERBusinessSelectCard
        business={makeBusiness()}
        isSelected={false}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByLabelText('Happy Paws Clinic'));
    expect(onSelect).toHaveBeenCalledWith('biz-1');
  });

  it('falls back to the capitalized category as meta when address is missing', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({address: undefined, category: 'groomer'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Groomer')).toBeTruthy();
  });

  it('renders no meta line when both address and category are empty', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({address: '', category: ''})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    // name still renders; meta ternary hits the null branch (no address text)
    expect(screen.getByText('Happy Paws Clinic')).toBeTruthy();
    expect(screen.queryByText('42 Wellness Ave, Petville')).toBeNull();
  });

  it('renders the local string photo instead of the avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({photo: 'file://local-photo.jpg'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );

    const images = screen.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({uri: 'file://local-photo.jpg'});
    // photo present -> no fallback avatar icon
    expect(screen.queryByTestId('icon-medkit-outline')).toBeNull();
  });

  it('ignores a non-string photo and renders the avatar icon', () => {
    render(
      <AERBusinessSelectCard
        business={makeBusiness({photo: {uri: 'obj-photo'}})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );
    // object photo is not a string -> avatar icon fallback
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('fetches and renders the Google Places photo when a placeId is present', async () => {
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest
        .fn()
        .mockResolvedValue({photoUrl: 'https://places/photo.jpg'}),
    });

    render(
      <AERBusinessSelectCard
        business={makeBusiness({placeId: 'place-123'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );

    expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place-123');

    await waitFor(() => {
      const images = screen.UNSAFE_getAllByType(Image);
      expect(images).toHaveLength(1);
      expect(images[0].props.source).toEqual({
        uri: 'https://places/photo.jpg',
      });
    });
  });

  it('keeps the avatar icon when the Google Places result has no photoUrl', async () => {
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: null}),
    });

    render(
      <AERBusinessSelectCard
        business={makeBusiness({placeId: 'place-456'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place-456');
    });
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
  });

  it('falls back to the avatar icon when the Google Places fetch rejects', async () => {
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('places down')),
    });

    render(
      <AERBusinessSelectCard
        business={makeBusiness({placeId: 'place-789'})}
        isSelected={false}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place-789');
    });
    expect(screen.getByTestId('icon-medkit-outline')).toBeTruthy();
  });
});
